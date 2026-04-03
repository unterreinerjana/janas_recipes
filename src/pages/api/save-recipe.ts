import type { APIRoute } from 'astro';
import { writeFileSync } from 'fs';
import { join } from 'path';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const adminPassword = import.meta.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return new Response('Server misconfigured: ADMIN_PASSWORD not set', { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let content: string;
  try {
    const body = await request.json();
    content = body.content;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!content || typeof content !== 'string') {
    return new Response('Missing content field', { status: 400 });
  }

  const titleMatch = content.match(/^title:\s*(.+)$/m);
  if (!titleMatch) {
    return new Response('Missing title in frontmatter', { status: 400 });
  }

  const title = titleMatch[1].trim();
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const filename = `${slug}.md`;
  const filePath = join(process.cwd(), 'recipes', filename);

  try {
    writeFileSync(filePath, content, 'utf-8');
    return new Response(JSON.stringify({ slug, filename }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Failed to write recipe file', { status: 500 });
  }
};
