# WASL Design System — Depth & Glass

WASL's visual identity is built around the **"Depth & Glass"** design language: tactile layered surfaces, frosted glass, ambient gradient glows, big radii (20–28px), and confident typography.

---

## 1. Core Principles

1. **Depth over 1px Borders**: Separation is created through layered shadows, surface steps (`--surface-1`, `--surface-2`, `--surface-3`), and frosted glass filters rather than heavy dividing lines.
2. **One Hero Card per Page**: Each main page features a prominent gradient hero card with distinct thematic accents.
3. **Hue-Worlds & Accents**: Every domain has a dedicated hue-world (e.g. Journal, Money, Habits) with glowing progress indicators and subtle micro-interactions.
4. **Floating Canvas**: On screens ≥1280px, the application renders as a rounded, elevated content sheet resting on a themed ambient backdrop, with the sidebar rail floating alongside.

---

## 2. Theme Worlds

WASL includes three curated theme worlds configured via CSS variables on `<html>` (`data-theme`) and mapped into Tailwind CSS v4 via `@theme inline`:

| Theme Key | Name | Visual Look | Primary Display Font |
|---|---|---|---|
| `graphite` / `midnight` | **Obsidian Glass** | Deep charcoal glass, mint-teal glow, violet accents | Space Grotesk |
| `editorial` | **Porcelain** | Clean white cards on cool porcelain, kelly emerald, dark contrast rail | Fraunces (Serif) |
| `warm` | **Desert Luxe** | Warm sand backdrop, near-black canvas, terracotta ember, pastel cards | Bricolage Grotesque |

---

## 3. Key CSS Classes (`app/globals.css`)

- `.card`: Standard rounded surface with subtle border and elevation.
- `.card-hero`: Gradient accent card with inverted ink tokens for child typography.
- `.card-glass`: Semi-transparent frosted backdrop with `backdrop-filter: blur(16px)`.
- `.card-pastel-{cream,mint,lav}`: Soft tinted cards with remapped ink tokens.
- `.rail`: Theme-remapped sidebar navigation rail using `--rail-*` tokens.
- `.row-glow`: Subtle highlight glow on hover/active table and list items.
- `.hatch`: Diagonal-hatched fill for secondary chart series.
- `.tabular`: Tabular numerals applied to all financial, counter, and statistical figures.

---

## 4. Typography

- **Body**: Onest
- **Display**: Space Grotesk (Graphite), Fraunces (Editorial), Bricolage Grotesque (Warm)
- **Monospace / Numbers**: JetBrains Mono
