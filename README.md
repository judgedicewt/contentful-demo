# contentful-demo

Small Node.js project that talks to the Contentful space
[za8ljzyomqr0](https://app.contentful.com/spaces/za8ljzyomqr0/home). It
verifies credentials, provisions a content model, and seeds sample entries.

## Prerequisites

- Node.js 18 or later.
- A Contentful Management API token and a Delivery API token for the space.

## Configuration

The scripts read these environment variables. Values already present in the
process environment take precedence over `.env`.

| Name | Purpose |
| --- | --- |
| `CONTENTFUL_SPACE_ID` | Space to operate on. Defaults to `za8ljzyomqr0` in `.env`. |
| `CONTENTFUL_ENVIRONMENT` | Environment within the space. Defaults to `master` in `.env`. |
| `CONTENTFUL_MANAGEMENT_TOKEN` | Used by `setup` to create and publish content. |
| `CONTENTFUL_DELIVERY_TOKEN` | Used by `check` and `fetch` to read published content. |
| `CONTENTFUL_PREVIEW_TOKEN` | Optional. Reserved for reading draft content. |

To change the non-secret defaults, edit `.env`. Don't put tokens in `.env`
if the file is committed. `.env` is listed in `.gitignore`; `.env.example`
documents the expected shape.

## Scripts

```sh
npm install
npm run check    # Verifies env vars and that both APIs accept the tokens.
npm run setup    # Creates or updates the content model and sample entries.
npm run fetch    # Reads the blog posts back through the Delivery API.
npm run dev      # Generates site/config.js and serves the front end on :4173.
```

`setup` is idempotent. Content types and entries use fixed IDs, so running it
again updates and republishes them instead of creating duplicates.

## What `setup` creates

Content types:

- `author` with `name` and `bio`.
- `blogPost` with `title`, a unique `slug`, `body`, `publishDate`, and an
  `author` link restricted to `author` entries.

Entries:

- One author, `demo-author-ada`.
- Two blog posts, `demo-post-hello` and `demo-post-modeling`, both linked to
  that author.

The model lives in `src/content-model.js`. Edit it and re-run `npm run setup`
to change what gets provisioned.

## Running behind an HTTPS proxy

`contentful-management` bundles its own axios, which at 1.15.x doesn't tunnel
HTTPS through a proxy correctly and fails with `405 Method Not Allowed`.
`src/clients.js` works around this by passing the installed top-level axios
HTTP adapter to the management client. Keep `axios` at 1.16.1 or later.

## Front end

`site/` is a dependency-free static page that lists the blog posts and shows
each one, reading published content from the Delivery API in the browser.
It uses hash routing (`#/` and `#/post/<slug>`), so it needs no server-side
rewrites.

The page reads its settings from `site/config.js`, which is generated and not
committed. Run `npm run dev` to generate it from your environment and serve
the site locally.

The delivery token ends up in the page source. That's expected for Contentful
delivery tokens, which can only read published content, but don't use a
management or preview token here.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` builds `site/config.js` and deploys `site/` on
every push to `main`. One-time setup in the GitHub repository:

1. In **Settings > Pages**, set **Source** to **GitHub Actions**.
2. In **Settings > Secrets and variables > Actions**, add:
   - Variable `CONTENTFUL_SPACE_ID` = `za8ljzyomqr0`
   - Variable `CONTENTFUL_ENVIRONMENT` = `master`
   - Secret `CONTENTFUL_DELIVERY_TOKEN` = your delivery token
3. Push to `main` or run the workflow manually from the **Actions** tab.

The site is then served at `https://<owner>.github.io/<repo>/`.
