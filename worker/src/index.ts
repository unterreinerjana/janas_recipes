/**
 * Cloudflare Worker — janas-recipes backend
 *
 * Accepts POST /api/save-recipe with a Bearer token in Authorization header.
 * On success, commits the recipe Markdown file to the GitHub repo via the
 * GitHub API, which triggers the GitHub Actions deploy workflow.
 *
 * Required Worker secrets (set via `wrangler secret put`):
 *   ADMIN_PASSWORD  — must match the password stored in the frontend localStorage
 *   GITHUB_TOKEN    — GitHub Personal Access Token with `repo` scope
 */

interface Env {
  ADMIN_PASSWORD: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string; // set in wrangler.toml, e.g. "unterreinerjana/janas_recipes"
  RATE_LIMIT: KVNamespace;
}

const MAX_SAVES_PER_DAY = 35;

const ALLOWED_ORIGIN = 'https://unterreinerjana.github.io';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // Verify Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.ADMIN_PASSWORD}`) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Parse body
    let content: string;
    try {
      const body = await request.json() as { content?: unknown };
      if (typeof body.content !== 'string' || !body.content) {
        return new Response('Missing content field', { status: 400, headers: corsHeaders });
      }
      content = body.content;
    } catch {
      return new Response('Invalid JSON body', { status: 400, headers: corsHeaders });
    }

    // Derive filename from title in frontmatter
    const titleMatch = content.match(/^title:\s*(.+)$/m);
    if (!titleMatch) {
      return new Response('Missing title in frontmatter', { status: 400, headers: corsHeaders });
    }

    const title = titleMatch[1].trim();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const filename = `${slug}.md`;
    const path = `recipes/${filename}`;

    const githubHeaders = {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'User-Agent': 'janas-recipes-worker',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // Check if file already exists (needed for update — requires sha)
    let sha: string | undefined;
    const checkRes = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
      { headers: githubHeaders }
    );
    if (checkRes.ok) {
      const existing = await checkRes.json() as { sha: string };
      sha = existing.sha;
    }

    // Base64-encode content for GitHub API
    const encodedContent = btoa(
      encodeURIComponent(content).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );

    // Check daily rate limit
    const today = new Date().toISOString().slice(0, 10);
    const currentCount = parseInt((await env.RATE_LIMIT.get(today)) ?? '0', 10);
    if (currentCount >= MAX_SAVES_PER_DAY) {
      return new Response('Too Many Requests', { status: 429, headers: corsHeaders });
    }

    // Commit file via GitHub API
    const commitRes = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: githubHeaders,
        body: JSON.stringify({
          message: `Add recipe: ${title}`,
          content: encodedContent,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!commitRes.ok) {
      const errorText = await commitRes.text();
      return new Response(`GitHub API error: ${errorText}`, { status: 502, headers: corsHeaders });
    }

    // Increment daily save counter after successful commit
    await env.RATE_LIMIT.put(today, String(currentCount + 1), { expirationTtl: 172800 }); // 48h TTL

    return new Response(JSON.stringify({ slug, filename }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
