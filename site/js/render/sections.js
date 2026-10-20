/** Section renderer map, keyed by content type ID, shared by page and story. */
import { render as textBlock } from './textBlock.js';
import { render as imageBlock } from './imageBlock.js';
import { render as bannerButton } from './bannerButton.js';
import { render as cardGrid } from './cardGrid.js';
import { render as vehicleGrid } from './vehicleGrid.js';
import { render as storyGrid } from './storyGrid.js';
import { render as ctaGroup } from './ctaGroup.js';
import { contentTypeOf, present } from './common.js';

export const SECTION_RENDERERS = { textBlock, imageBlock, bannerButton, cardGrid, vehicleGrid, storyGrid, ctaGroup };

/**
 * Renders a `sections` array in order. `extra` is merged into the context the
 * section renderers receive (e.g. `{ latestStories }`). Unknown section types
 * render nothing.
 */
export function renderSections(list, ctx, extra = {}) {
  const sectionCtx = { ...ctx, ...extra };
  return present(list).map((section) => {
    const renderer = SECTION_RENDERERS[contentTypeOf(section)];
    return renderer ? renderer(section, sectionCtx) : '';
  });
}
