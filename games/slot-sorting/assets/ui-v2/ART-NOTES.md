# UI sprite pass — 13/11/2026

Reference: [UI_SMASHFEST / setting node 141:214](https://www.figma.com/design/SgKSYjhfZcjIQBL5POzEKf/UI_SMASHFEST?node-id=141-214). The source was inspected visually at 25% canvas zoom; the detailed screenshot is `preview/figma-source/settings-detail.png`. Figma required sign-in for inspect/export; no original asset export, font identification, variables or component specification is claimed.

The three PNGs are **new images generated with imagegen from that screenshot as a style reference**, then copied into this project. They are not Figma exports. Text, input, accessibility and state remain HTML/JS; only the art is raster.

| File | Size | Use |
| --- | --- | --- |
| `panel.png` | 1086×1448 RGBA | Empty lavender body; CSS border-image nine-slice at 150px, rendered with a 28px border |
| `chrome-atlas.png` | 1254×1254 RGBA | Four equal vertical cells: purple slanted banner, green CTA, yellow action, lavender secondary |
| `icons-atlas.png` | 1254×1254 RGBA | 3×3 grid: gear, bulb, retry / close, help, levels / play, trophy, star |
| `pipe-pattern.svg` | 160×160 | New low-contrast native vector pattern of this game's pipes and balls; not from Figma |

CSS uses atlas coordinates directly, without editing/cutting the generated images. Panel center and edge behavior use nine-slice so layout changes do not stretch the entire border. The slanted banner, white keyline, lower bevel and highlights are encoded in the sprites.

Display font: **Bungee**, chosen for this implementation's block lettering and Vietnamese glyph coverage, **not identified as the Figma source font**. Source: [Google Fonts metadata](https://github.com/google/fonts/blob/main/ofl/bungee/METADATA.pb); font and OFL license are in `assets/fonts/`. Fredoka remains the body font.

Intentional changes from the rejected CSS-only pass: filled illustrated icons, smaller-radius lavender panel, title banner crossing the body edge, single inset settings region, compact paired gold/green actions, and a full purple result scene with large trophy and rays. Colors and dimensions are implementation choices derived from visual reference, not measured source variables.
