# ja-JP glossary and overlay format

## Glossary

Use マクラーレン for McLaren. Keep model names, MSO, GTS, W1, Artura, Senna,
Speedtail, GT4, F1, P1, LT, Spider, and Coupé in Latin script. Use these terms:
スーパーカー, グランドツアラー, アルティメット (Ultimate Series),
モータースポーツ, レガシー, オーナーシップ, and エクスペリエンス.

Write body copy in the polite です/ます register and headings as noun phrases.
Use full-width punctuation (、。) in Japanese sentences. Keep numerals and units
as in English, except translate "speed" as 速 and leave "mph" alongside km/h
unchanged. Keep retailer addresses in English except the country name.

## Overlay format

Each file in this directory is an overlay for one seed group. It exports a plain
object. Keys are entry ids and values map localized field ids to Japanese values:

```js
export default {
  'vehicle-750s': { name: '750S', tagline: '...', shortDescription: '...' },
  'faq-750s-1': { question: '...', answer: doc(p('...')) },
};
```

Rich text values use the helpers in `src/seed/richtext-helpers.js` (`doc`, `p`,
`h2`, `h3`, `ul`, `bold`) and mirror the English block structure: the same
number of paragraphs, headings, and list items, so the layout stays comparable.

Only localized fields belong in an overlay. Never translate slugs, order,
status, bodyStyle, heroStyle, variant, theme, layout, area, group, style, URLs,
phone numbers, dates, numbers, booleans, locations, or links.
