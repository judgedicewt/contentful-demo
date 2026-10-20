/** Home: the `page` template without breadcrumbs, titled with the site name. */
import { clip } from './common.js';
import { renderPage } from './page.js';

export function render(data, ctx) {
  const siteName = ctx.siteSettings?.fields?.siteName || 'McLaren';
  return renderPage(data, ctx, {
    breadcrumbs: false,
    title: siteName,
    head: (entry) =>
      ctx.setHead({ title: siteName, description: entry.fields.seo?.fields?.description || clip(entry.fields.title) }),
  });
}
