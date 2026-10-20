/**
 * storyGrid (relevant-content-section). An empty `stories` list falls back to
 * `ctx.latestStories`, which the page renderer passes through from its data.
 */
import { html } from '../dom.js';
import { present } from './common.js';
import { cardList, storyCard } from './cards.js';

export function render(entry, ctx) {
  const f = entry.fields;
  const curated = present(f.stories);
  const stories = curated.length ? curated : present(ctx.latestStories);
  if (!stories.length) return '';
  return html`
    <section class="section story-grid theme-white">
      <div class="container">
        <h2 class="section__title">${f.heading || 'Stories'}</h2>
        ${cardList(stories.map((story) => storyCard(ctx, story)))}
      </div>
    </section>`;
}
