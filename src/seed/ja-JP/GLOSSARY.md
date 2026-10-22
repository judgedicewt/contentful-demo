# ja-JP glossary and overlay format

## Glossary

Use ストラーダ・ノヴァ for Strada Nova, ストラーダ・ノヴァ・アウトモビリ for
Strada Nova Automobili, and スー・ミズーラ for Su Misura, the bespoke division.
Keep model names, GTS, W1, Artura, Senna,
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

## Resolved terms

One term per concept across every overlay:

- Hypercars: ハイパーカー. The "ultimate badge" in lineage copy stays アルティメット.
- Enquire: お問い合わせ (links, enquiry form, vehicle CTAs). Contact and Contact us: 連絡先.
- Register interest: 関心を登録. Discover: 詳しく見る. Continue your journey: 旅を続ける.
- Carbon tub: カーボンモノコック. Folding hard top: 折りたたみ式ハードトップ.
- Car model lines stay in Latin script: Super Series, Sports Series, Longtail, Coupé, Spider.
- Site name and every SEO title suffix: ストラーダ・ノヴァ.
- Write Latin names and numbers directly against Japanese text, with no spaces.
- Page titles of the form "Parent: Child" use a full-width colon (：).
