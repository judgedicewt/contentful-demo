/**
 * Renders a Contentful rich text document to HTML.
 *
 * Supported nodes: document, paragraph, heading-1 to heading-6, text (with
 * bold, italic, underline, code, superscript, subscript marks), hyperlink,
 * asset-hyperlink, entry-hyperlink, unordered-list, ordered-list, list-item,
 * blockquote, hr, embedded-asset-block, embedded-entry-block and
 * embedded-entry-inline. Unknown nodes render their children. All text is
 * escaped.
 *
 * Options:
 *   assetUrl(asset, params)  → URL for an asset (default: file.url)
 *   entryHref(entry)         → href for entry hyperlinks (default: '#')
 *   renderEntry(entry)       → HTML string for embedded entries (default: '')
 */
import { escapeHtml } from './dom.js';

const MARK_TAGS = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  code: 'code',
  superscript: 'sup',
  subscript: 'sub',
};

function defaultAssetUrl(asset) {
  const url = asset?.fields?.file?.url || '';
  return url.startsWith('//') ? `https:${url}` : url;
}

function safeHref(href) {
  const value = String(href || '').trim();
  if (!value) return '#';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(value)) return value;
  return '#';
}

/** Renders a rich text document (or a plain string) to an HTML string. */
export function renderRichText(doc, options = {}) {
  if (!doc) return '';
  if (typeof doc === 'string') {
    return doc
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
  const ctx = {
    assetUrl: options.assetUrl || defaultAssetUrl,
    entryHref: options.entryHref || (() => '#'),
    renderEntry: options.renderEntry || (() => ''),
  };
  return renderNode(doc, ctx);
}

function renderChildren(node, ctx) {
  return (node.content || []).map((child) => renderNode(child, ctx)).join('');
}

function renderText(node) {
  let out = escapeHtml(node.value || '').replace(/\n/g, '<br>');
  for (const mark of node.marks || []) {
    const tag = MARK_TAGS[mark.type];
    if (tag) out = `<${tag}>${out}</${tag}>`;
  }
  return out;
}

function renderAsset(asset, ctx) {
  if (!asset || !asset.fields) return '';
  const url = ctx.assetUrl(asset);
  if (!url) return '';
  const title = asset.fields.title || '';
  const description = asset.fields.description || '';
  const alt = escapeHtml(description || title);
  const isImage = /^image\//.test(asset.fields.file?.contentType || '') || /\.(svg|png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);
  if (!isImage) {
    return `<p class="richtext-file"><a href="${escapeHtml(url)}">${escapeHtml(title || url)}</a></p>`;
  }
  const caption = description ? `<figcaption>${escapeHtml(description)}</figcaption>` : '';
  return `<figure class="richtext-figure"><img src="${escapeHtml(url)}" alt="${alt}" loading="lazy">${caption}</figure>`;
}

function renderNode(node, ctx) {
  if (!node || typeof node !== 'object') return '';
  switch (node.nodeType) {
    case 'document':
      return renderChildren(node, ctx);
    case 'text':
      return renderText(node);
    case 'paragraph': {
      const inner = renderChildren(node, ctx);
      return inner.trim() === '' ? '' : `<p>${inner}</p>`;
    }
    case 'heading-1':
    case 'heading-2':
    case 'heading-3':
    case 'heading-4':
    case 'heading-5':
    case 'heading-6': {
      const level = node.nodeType.slice(-1);
      return `<h${level}>${renderChildren(node, ctx)}</h${level}>`;
    }
    case 'unordered-list':
      return `<ul>${renderChildren(node, ctx)}</ul>`;
    case 'ordered-list':
      return `<ol>${renderChildren(node, ctx)}</ol>`;
    case 'list-item':
      return `<li>${renderChildren(node, ctx)}</li>`;
    case 'blockquote':
      return `<blockquote>${renderChildren(node, ctx)}</blockquote>`;
    case 'hr':
      return '<hr>';
    case 'hyperlink': {
      const href = safeHref(node.data?.uri);
      const external = /^https?:\/\//i.test(href);
      const rel = external ? ' rel="noopener"' : '';
      return `<a href="${escapeHtml(href)}"${rel}>${renderChildren(node, ctx)}</a>`;
    }
    case 'asset-hyperlink': {
      const href = safeHref(ctx.assetUrl(node.data?.target));
      return `<a href="${escapeHtml(href)}">${renderChildren(node, ctx)}</a>`;
    }
    case 'entry-hyperlink': {
      const target = node.data?.target;
      const href = target ? safeHref(ctx.entryHref(target)) : '#';
      return `<a href="${escapeHtml(href)}">${renderChildren(node, ctx)}</a>`;
    }
    case 'embedded-asset-block':
      return renderAsset(node.data?.target, ctx);
    case 'embedded-entry-block': {
      const out = ctx.renderEntry(node.data?.target);
      return out ? `<div class="richtext-embed">${out}</div>` : '';
    }
    case 'embedded-entry-inline':
      return ctx.renderEntry(node.data?.target) || '';
    case 'table':
      return `<table>${renderChildren(node, ctx)}</table>`;
    case 'table-row':
      return `<tr>${renderChildren(node, ctx)}</tr>`;
    case 'table-header-cell':
      return `<th>${renderChildren(node, ctx)}</th>`;
    case 'table-cell':
      return `<td>${renderChildren(node, ctx)}</td>`;
    default:
      return renderChildren(node, ctx);
  }
}

/** Plain text of a rich text document (for excerpts and meta descriptions). */
const INLINE_NODES = new Set(['text', 'hyperlink', 'asset-hyperlink', 'entry-hyperlink', 'embedded-entry-inline']);

export function richTextToPlain(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (doc.nodeType === 'text') return doc.value || '';
  const children = doc.content || [];
  const inline = children.every((child) => INLINE_NODES.has(child?.nodeType));
  const parts = children.map((child) => richTextToPlain(child));
  if (inline) return parts.join('');
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');
}
