/**
 * Minimal builders for Contentful rich text documents.
 *
 *   doc(h2('Title'), p('Plain text and ', bold('bold text'), '.'), ul('One', 'Two'))
 *
 * Inline arguments may be strings or nodes returned by `bold`.
 */

const text = (value, marks = []) => ({ nodeType: 'text', value, marks, data: {} });

const inline = (parts) => parts.map((part) => (typeof part === 'string' ? text(part) : part));

const block = (nodeType, content) => ({ nodeType, data: {}, content });

/** A bold inline text node. */
export const bold = (value) => text(value, [{ type: 'bold' }]);

/** A paragraph from strings and inline nodes. */
export const p = (...parts) => block('paragraph', inline(parts));

/** A level 2 heading. */
export const h2 = (value) => block('heading-2', inline([value]));

/** A level 3 heading. */
export const h3 = (value) => block('heading-3', inline([value]));

/** An unordered list; each item is a string or an array of inline parts. */
export const ul = (...items) =>
  block(
    'unordered-list',
    items.map((item) => block('list-item', [p(...(Array.isArray(item) ? item : [item]))])),
  );

/** The document root. */
export const doc = (...blocks) => ({ nodeType: 'document', data: {}, content: blocks });
