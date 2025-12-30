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

const getRefAsync = async (owner, repo, branch, token) => {
  const res = await fetch(ghUrl(owner, repo, `/git/ref/heads/${encodeURIComponent(branch)}`), {
    headers: githubHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`;
    throw new Error(`GitHub get ref failed: ${msg}`);
  }
  const sha = data?.object?.sha;
  if (typeof sha !== 'string') throw new Error('GitHub get ref failed: missing sha');
  return sha;
};

const getCommitAsync = async (owner, repo, sha, token) => {
  const res = await fetch(ghUrl(owner, repo, `/git/commits/${encodeURIComponent(sha)}`), {
    headers: githubHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`;
    throw new Error(`GitHub get commit failed: ${msg}`);
  }
  const treeSha = data?.tree?.sha;
  if (typeof treeSha !== 'string') throw new Error('GitHub get commit failed: missing tree sha');
  return { treeSha };
};

const createBlobAsync = async (owner, repo, buf, token) => {
  const body = {
    content: buf.toString('base64'),
    encoding: 'base64',
  };
  const res = await fetch(ghUrl(owner, repo, '/git/blobs'), {
    method: 'POST',
    headers: { ...githubHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`;
    throw new Error(`GitHub create blob failed: ${msg}`);
  }
  const sha = data?.sha;
  if (typeof sha !== 'string') throw new Error('GitHub create blob failed: missing sha');
  return sha;
};

const createTreeAsync = async (owner, repo, baseTreeSha, entries, token) => {
  const body = {
    base_tree: baseTreeSha,
    tree: entries,
  };
  const res = await fetch(ghUrl(owner, repo, '/git/trees'), {
    method: 'POST',
    headers: { ...githubHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`;
    throw new Error(`GitHub create tree failed: ${msg}`);
  }
  const sha = data?.sha;
  if (typeof sha !== 'string') throw new Error('GitHub create tree failed: missing sha');
  return sha;
};

const createCommitAsync = async (owner, repo, message, treeSha, parentSha, token) => {
  const body = {
    message,
    tree: treeSha,
    parents: [parentSha],
  };
  const res = await fetch(ghUrl(owner, repo, '/git/commits'), {
    method: 'POST',
    headers: { ...githubHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`;
    throw new Error(`GitHub create commit failed: ${msg}`);
  }
  const sha = data?.sha;
  if (typeof sha !== 'string') throw new Error('GitHub create commit failed: missing sha');
  return sha;
};

const updateRefAsync = async (owner, repo, branch, newSha, token) => {
  const body = { sha: newSha, force: false };
  const res = await fetch(ghUrl(owner, repo, `/git/refs/heads/${encodeURIComponent(branch)}`), {
    method: 'PATCH',
    headers: { ...githubHeaders(token), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.message === 'string' ? data.message : `HTTP ${res.status}`;
    throw new Error(`GitHub update ref failed: ${msg}`);
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

const collectImagesAndRewriteContent = content => {
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

  return uploads;
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

    // Prepare a SINGLE commit with all assets + updated content.json.
    const uploads = collectImagesAndRewriteContent(contentCopy);

    // Compute file paths first and rewrite content to reference them.
    const now = Date.now();
    /** @type {Array<{ path: string, buf: Buffer }>} */
    const filesToWrite = [];
    for (let i = 0; i < uploads.length; i += 1) {
      const u = uploads[i];
      const filename = `${now}-${i}.${u.ext}`;
      const path = `${UPLOAD_DIR}/${filename}`;
      u.assign(path);
      filesToWrite.push({ path, buf: u.buf });
    }
    filesToWrite.push({ path: 'content.json', buf: Buffer.from(json(contentCopy), 'utf-8') });

    // Create commit via Git Data API
    const parentSha = await getRefAsync(owner, repo, branch, token);
    const { treeSha: baseTreeSha } = await getCommitAsync(owner, repo, parentSha, token);

    /** @type {Array<{ path: string, mode: string, type: string, sha: string }>} */
    const treeEntries = [];
    for (const f of filesToWrite) {
      const blobSha = await createBlobAsync(owner, repo, f.buf, token);
      treeEntries.push({ path: f.path, mode: '100644', type: 'blob', sha: blobSha });
    }

    const newTreeSha = await createTreeAsync(owner, repo, baseTreeSha, treeEntries, token);
    const newCommitSha = await createCommitAsync(owner, repo, commitMessage, newTreeSha, parentSha, token);
    await updateRefAsync(owner, repo, branch, newCommitSha, token);

    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommitSha}`;
    res.status(200).json({ ok: true, commitUrl });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}


