/**
 * Content model provisioned by `npm run setup`.
 * Edit this file to change what the demo creates in the space.
 */
export const CONTENT_TYPES = [
  {
    id: 'author',
    name: 'Author',
    displayField: 'name',
    fields: [
      { id: 'name', name: 'Name', type: 'Symbol', required: true },
      { id: 'bio', name: 'Bio', type: 'Text' },
    ],
  },
  {
    id: 'blogPost',
    name: 'Blog post',
    displayField: 'title',
    fields: [
      { id: 'title', name: 'Title', type: 'Symbol', required: true },
      {
        id: 'slug',
        name: 'Slug',
        type: 'Symbol',
        required: true,
        validations: [{ unique: true }],
      },
      { id: 'body', name: 'Body', type: 'Text' },
      { id: 'publishDate', name: 'Publish date', type: 'Date' },
      {
        id: 'author',
        name: 'Author',
        type: 'Link',
        linkType: 'Entry',
        validations: [{ linkContentType: ['author'] }],
      },
    ],
  },
];

/**
 * Sample entries, keyed by a stable entry ID so re-running setup updates
 * rather than duplicates. `links` names fields that reference other
 * sample entries by their ID.
 */
export const ENTRIES = [
  {
    id: 'demo-author-ada',
    contentType: 'author',
    fields: {
      name: 'Ada Lovelace',
      bio: 'Mathematician and the first computer programmer.',
    },
  },
  {
    id: 'demo-post-hello',
    contentType: 'blogPost',
    fields: {
      title: 'Hello, Contentful',
      slug: 'hello-contentful',
      body: 'This entry was created by the contentful-demo setup script.',
      publishDate: '2026-10-20T00:00:00Z',
    },
    links: { author: 'demo-author-ada' },
  },
  {
    id: 'demo-post-modeling',
    contentType: 'blogPost',
    fields: {
      title: 'Modeling content with the Management API',
      slug: 'modeling-content-with-the-management-api',
      body: 'Content types and entries are both just JSON. This post links to an author entry.',
      publishDate: '2026-10-21T00:00:00Z',
    },
    links: { author: 'demo-author-ada' },
  },
];
