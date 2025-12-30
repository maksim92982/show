/**
 * Vercel Serverless Function: GET /api/github-status
 *
 * Returns repo metadata if env vars are set and token can access the repo.
 *
 * Env vars:
 * - GITHUB_TOKEN
 * - GITHUB_OWNER
 * - GITHUB_REPO
 * - GITHUB_BRANCH (optional)
 */

const getEnv = name => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const githubHeaders = token => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = getEnv('GITHUB_TOKEN');
    const owner = getEnv('GITHUB_OWNER');
    const repo = getEnv('GITHUB_REPO');
    const branch = process.env.GITHUB_BRANCH || 'main';

    const api = `https://api.github.com/repos/${owner}/${repo}`;
    const r = await fetch(api, { headers: githubHeaders(token) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = typeof data?.message === 'string' ? data.message : `HTTP ${r.status}`;
      res.status(500).json({ error: `GitHub API error: ${msg}` });
      return;
    }

    res.status(200).json({
      owner,
      repo,
      branch,
      defaultBranch: data?.default_branch ?? null,
      private: data?.private ?? null,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}


