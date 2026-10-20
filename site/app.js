/**
 * Minimal front end for the contentful-demo space.
 *
 * Reads published blog posts directly from the Contentful Delivery API using
 * the space ID, environment, and delivery token from config.js. Hash-based
 * routing (#/ and #/post/<slug>) keeps it working on static hosts such as
 * GitHub Pages without any rewrite rules.
 */
const config = window.CONTENTFUL_CONFIG;
const app = document.getElementById('app');
const envLabel = document.getElementById('env-label');

if (!config || !config.spaceId || !config.deliveryToken) {
  renderError(
    'Missing configuration. Copy site/config.example.js to site/config.js, or run <code>npm run build:site</code> ' +
      'with CONTENTFUL_SPACE_ID and CONTENTFUL_DELIVERY_TOKEN set.',
  );
} else {
  envLabel.textContent = `${config.spaceId} / ${config.environment || 'master'}`;
  window.addEventListener('hashchange', route);
  route();
}

function baseUrl() {
  return `https://cdn.contentful.com/spaces/${encodeURIComponent(config.spaceId)}/environments/${encodeURIComponent(
    config.environment || 'master',
  )}`;
}

async function cdaGet(path, params = {}) {
  const url = new URL(`${baseUrl()}${path}`);
  url.searchParams.set('access_token', config.deliveryToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json()).message || '';
    } catch {
      /* ignore */
    }
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}

/** Resolves linked entries from the `includes` block into a lookup by ID. */
function buildEntryMap(payload) {
  const map = new Map();
  for (const entry of [...(payload.items || []), ...(payload.includes?.Entry || [])]) {
    map.set(entry.sys.id, entry);
  }
  return map;
}

function authorName(post, entries) {
  const link = post.fields.author;
  if (!link) return null;
  return entries.get(link.sys.id)?.fields?.name ?? null;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

async function route() {
  const hash = window.location.hash || '#/';
  const match = hash.match(/^#\/post\/([^/]+)$/);
  try {
    if (match) {
      await renderPost(decodeURIComponent(match[1]));
    } else {
      await renderList();
    }
  } catch (error) {
    renderError(`Couldn't load content from Contentful. ${escapeHtml(error.message)}`);
  }
}

async function renderList() {
  app.innerHTML = '<p class="muted">Loading posts…</p>';
  const payload = await cdaGet('/entries', {
    content_type: 'blogPost',
    order: '-fields.publishDate',
    include: '1',
  });
  const entries = buildEntryMap(payload);
  if (payload.items.length === 0) {
    app.innerHTML = '<p class="muted">No published posts yet. Run <code>npm run setup</code> to seed some.</p>';
    return;
  }
  const items = payload.items
    .map((post) => {
      const { title, slug, body, publishDate } = post.fields;
      const author = authorName(post, entries);
      const excerpt = (body || '').split('\n')[0].slice(0, 160);
      return `
        <li class="card">
          <h2><a href="#/post/${encodeURIComponent(slug)}">${escapeHtml(title)}</a></h2>
          <p class="meta">${escapeHtml(formatDate(publishDate))}${author ? ` · ${escapeHtml(author)}` : ''}</p>
          <p>${escapeHtml(excerpt)}</p>
        </li>`;
    })
    .join('');
  app.innerHTML = `<ul class="post-list">${items}</ul>`;
}

async function renderPost(slug) {
  app.innerHTML = '<p class="muted">Loading post…</p>';
  const payload = await cdaGet('/entries', {
    content_type: 'blogPost',
    'fields.slug': slug,
    include: '1',
    limit: '1',
  });
  const post = payload.items[0];
  if (!post) {
    app.innerHTML = `<a class="back" href="#/">← All posts</a><p>No post found for <code>${escapeHtml(slug)}</code>.</p>`;
    return;
  }
  const entries = buildEntryMap(payload);
  const { title, body, publishDate } = post.fields;
  const author = authorName(post, entries);
  app.innerHTML = `
    <a class="back" href="#/">← All posts</a>
    <article>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(formatDate(publishDate))}${author ? ` · ${escapeHtml(author)}` : ''}</p>
      <div class="body">${escapeHtml(body || '')}</div>
    </article>`;
  document.title = `${title} · Contentful demo`;
}

function renderError(html) {
  app.innerHTML = `<div class="error">${html}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
