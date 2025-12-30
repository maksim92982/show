/**
 * Vercel Serverless Function: POST /api/publish
 *
 * Security model:
 * - GitHub token is stored as Vercel env var (never sent to browser).
 * - Client sends content JSON; server uploads images to repo and commits content.json.
 *
 * Required env vars on Vercel:
 * - GITHUB_TOKEN (fine-grained PAT with Contents: Read/Write for the repo)
 * - GITHUB_OWNER (e.g. "myuser")
 * - GITHUB_REPO (e.g. "bakery-site")
 * Optional:
 * - GITHUB_BRANCH (default "main")
 */

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6MB per image (safety)
const UPLOAD_DIR = 'assets/uploads';

const json = obj => JSON.stringify(obj, null, 2);

const getEnv = name => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const safeFileExt = mime => {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return null;
  }
};

const parseDataUrlImage = dataUrl => {
  if (typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  const ext = safeFileExt(mime);
  if (!ext) return null;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large (${buf.length} bytes). Limit is ${MAX_IMAGE_BYTES}.`);
  }
  return { mime, ext, buf };
};

const githubHeaders = token => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
});

const ghUrl = (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}${path}`;

const getFileShaAndContentAsync = async (owner, repo, branch, path, token) => {
  const res = await fetch(
    ghUrl(owner, repo, `/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`),
    { headers: githubHeaders(token) },
  );
  if (res.status === 404) return { sha: null, content: null };
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub get content failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const sha = typeof data?.sha === 'string' ? data.sha : null;
  const contentB64 = typeof data?.content === 'string' ? data.content : null;
  const content =
    contentB64 && typeof data?.encoding === 'string' && data.encoding === 'base64'
      ? Buffer.from(contentB64, 'base64').toString('utf-8')
      : null;
  return { sha, content };
};

const putFileAsync = async (owner, repo, branch, path, token, message, contentBufOrString, sha) => {
  const contentB64 = Buffer.isBuffer(contentBufOrString)
    ? contentBufOrString.toString('base64')
    : Buffer.from(String(contentBufOrString), 'utf-8').toString('base64');

  const body = {
    message,
    content: contentB64,
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(ghUrl(owner, repo, `/contents/${encodeURIComponent(path)}`), {
    method: 'PUT',
    headers: { ...githubHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message ? String(data.message) : `HTTP ${res.status}`;
    throw new Error(`GitHub put content failed: ${msg}`);
  }
  return data;
};

const walkBlocks = (blocks, fn) => {
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    fn(b);
    if (b.type === 'grid' && b.grid && Array.isArray(b.grid.cells)) {
      walkBlocks(b.grid.cells, fn);
    }
  }
};

const uploadImagesAndRewriteContentAsync = async (content, owner, repo, branch, token, commitMessage) => {
  /** @type {Array<{ buf: Buffer, ext: string, assign: (path: string) => void }>} */
  const uploads = [];

  // site background image
  if (content?.site?.background?.type === 'image') {
    const parsed = parseDataUrlImage(content.site.background.imageDataUrl);
    if (parsed) {
      uploads.push({
        buf: parsed.buf,
        ext: parsed.ext,
        assign: path => {
          content.site.background.imageDataUrl = `/${path}`;
        },
      });
    }
  }

  // block images + backgrounds
  if (Array.isArray(content?.blocks)) {
    walkBlocks(content.blocks, b => {
      if (b?.image?.src) {
        const parsed = parseDataUrlImage(b.image.src);
        if (parsed) {
          uploads.push({
            buf: parsed.buf,
            ext: parsed.ext,
            assign: path => {
              b.image.src = `/${path}`;
            },
          });
        }
      }
      if (b?.background?.type === 'image') {
        const parsed = parseDataUrlImage(b.background.imageDataUrl);
        if (parsed) {
          uploads.push({
            buf: parsed.buf,
            ext: parsed.ext,
            assign: path => {
              b.background.imageDataUrl = `/${path}`;
            },
          });
        }
      }
    });
  }

  // Upload assets first (each as separate commit in the same branch).
  // Then commit content.json.
  for (let i = 0; i < uploads.length; i += 1) {
    const u = uploads[i];
    const filename = `${Date.now()}-${i}.${u.ext}`;
    const path = `${UPLOAD_DIR}/${filename}`;
    const { sha } = await getFileShaAndContentAsync(owner, repo, branch, path, token);
    await putFileAsync(owner, repo, branch, path, token, `${commitMessage} (asset ${i + 1}/${uploads.length})`, u.buf, sha);
    u.assign(path);
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = getEnv('GITHUB_TOKEN');
    const owner = getEnv('GITHUB_OWNER');
    const repo = getEnv('GITHUB_REPO');
    const branch = process.env.GITHUB_BRANCH || 'main';

    const body = req.body;
    const content = body?.content;
    if (!content || typeof content !== 'object') {
      res.status(400).json({ error: 'Missing content' });
      return;
    }

    const commitMessage = `Publish content (${new Date().toISOString()})`;

    // Clone content object for safe mutation
    const contentCopy = JSON.parse(JSON.stringify(content));

    await uploadImagesAndRewriteContentAsync(contentCopy, owner, repo, branch, token, commitMessage);

    const targetPath = 'content.json';
    const { sha } = await getFileShaAndContentAsync(owner, repo, branch, targetPath, token);
    const putRes = await putFileAsync(owner, repo, branch, targetPath, token, commitMessage, json(contentCopy), sha);

    const commitUrl = putRes?.commit?.html_url || null;
    res.status(200).json({ ok: true, commitUrl });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}


