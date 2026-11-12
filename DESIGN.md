# Prototype homepage — Arcade Lab

The prototype catalog has a bright, graphic identity, distinct from the portfolio's dark green theme. Keep the author's name, game metadata, automatic collection count, direct game links, and hover/focus gameplay previews.

## Visual language

Use warm paper, cobalt blue, yellow labels, orange stickers, navy outlines, and small solid offset shadows. The hero is a playful browser window with a controller illustration. Avoid dark green surfaces, floating letter tiles, gradients, and glow effects on this homepage. Game artwork keeps its own colors.

Theme values live in `site/catalog.css`:

| Role | Token | Value |
| --- | --- | --- |
| Page | `--bg` | `#f5f2e9` |
| Cards | `--surface` | `#fffefb` |
| Text and strong outlines | `--ink` | `#17243b` |
| Secondary text | `--muted` | `#59616c` |
| Action and focus | `--accent` | `#264bdc` |
| Action hover | `--accent-hover` | `#1737b0` |
| Text on action | `--on-accent` | `#ffffff` |
| Decorative sticker | `--warm` | `#f36c39` |
| Labels and underline | `--yellow` | `#edce59` |
| Subtle dividers | `--line` | `#cbc9c0` |

Use navy text on yellow/orange, cobalt text on paper/white, and white text on cobalt. Small secondary text uses `--muted`; orange is decorative, not a small text color on paper.

## Dark mode

The header's Dark mode toggle switches between light and dark. Without a saved choice, follow the system color scheme, including changes while the page is open. Save explicit choices in the homepage-specific `prototype-theme` localStorage key and synchronize them across tabs. If storage is blocked, keep the toggle working for the current page. Apply the choice in `site/theme.js` before loading CSS to avoid a light flash. Update the browser theme-color and the toggle's pressed state together.

Dark colors override the same semantic tokens through `:root[data-theme="dark"]`: background `#111522`, surface `#1b2233`, text `#f1f2f8`, muted text `#b1b8c8`, text/focus accent `#9aafff`, outlines `#64728b`, and shadows `#080b13`. Separate `--button-bg`, `--screen-bg`, `--label-ink`, `--outline`, `--shadow`, and `--headline-mark` from text colors. Keep the blue arcade screen, cream controller, yellow labels, and orange sticker recognizable in both modes. Use navy text on colored labels in both modes.

The theme toggle shows only its sun/moon icon at every screen size. Keep a 44px target, an accessible Dark mode name, visible keyboard focus, and aria-pressed reflecting the active mode. Hide the control when JavaScript is unavailable. Game pages and their own themes are independent.

## Typography and layout

Local font stacks: Segoe UI/system sans for body, Arial Black/Segoe UI for the hero, Cascadia Mono/Consolas for small labels. No remote font dependency. Keep fallbacks that support Vietnamese.

The container caps at 1248px. Desktop uses a split hero and three game columns. Below 780px, stack the hero and use two game columns; below 540px, use one game column with 18px page margins. Keep the arcade illustration in its own row on mobile so it cannot obscure the title. Cards use 12px corners, 2px navy borders, and a 4px offset shadow.

## Interaction and verification

Primary links use a visible blue keyboard focus outline and a minimum 48px hero button. Card hover lifts the card and starts the existing muted gameplay preview; focus starts the same preview. Escape stops it. Touch opens the game directly. Keep video loading lazy, pause offscreen, retain artwork when video fails, and honor reduced motion.

Verify rendered desktop and mobile widths, game navigation, count, images, horizontal overflow, keyboard skip link, gameplay previews, reduced motion, and resource/runtime errors after changes. The native SVG hero and favicon are original assets for this theme.
