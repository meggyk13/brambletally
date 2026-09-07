# Brambletally — Brand & Design

Brambletally's own visual identity, separate from Rayhana's Repositorium.
Companion to `plan.md` and `social-plan.md`.

Status: **direction locked 2026-09-07**. Palettes and type committed; wordmark,
icon set, and illustration work still open (see "Open decisions").

## Direction

A **tally** is a medieval accounting tool — a notched stick for tracking debts
and stores. "Brambletally" reads as *a keeping-book kept in the hedgerow*. The
app is a **workshop ledger for makers** — craft, research, A&S, event work.

Aesthetic: cottagecore / fantasy / LARP / SCA. Visual language is woodcut and
linocut, botanical marginalia, iron-gall ink on parchment, guild inventory
rolls. Muted and earthy. Never bright, never "SaaS dashboard". Calm motion.

What changes from today:

- **Palette** — the İznik-ware colours (shared with the Repositorium) are
  replaced by a set of named themes, each with a light and dark variant.
- **Body font** — Inter is replaced by **Alegreya Sans**.
- **Icons** — emoji are replaced by a woodcut-style inline-SVG set.
- **Wordmark + favicon** — a real mark, not a text logo.

What stays:

- Single-column, 560px-max, mobile-first layout. The user builds and uses this
  on an iPhone.
- EB Garamond headings, IBM Plex Mono.
- The CSS custom-property token architecture. Themes are additive.
- `noindex`. No public pages, no SEO surface, no OG images needed yet.

## Themes

Two independent user choices:

- **Mode** — `light` | `dark` | `system`
- **Theme** — `bramble` | `hearth` | `fen`

They resolve to one attribute on `<html>`: `data-theme="<theme>-<mode>"`, e.g.
`bramble-light`, `fen-dark`. Six combinations, six CSS blocks, plus a bare
`:root` holding the `bramble-light` values so a missing attribute still renders.

Ship all three themes, both modes, at launch. All free. Later premium palettes
(Scriptorium, Nightshade, Heather — sketched in an earlier pass) and a custom
accent picker are candidates for the **Supporter tier** (see `social-plan.md`).

### Token set

Every theme block defines the full set:

```
--bg  --card  --elevated  --input  --border  --border-strong
--text  --text-sub  --text-muted  --text-disabled
--accent  --accent-2  --on-accent  --gold  --danger
--warn-bg  --warn-border  --warn-text
--header-bg  --shadow
```

**Four text tiers, not five** (locked 2026-09-07). `--text-faint` is dropped —
once it clears AA it is nearly `--text-muted` anyway. In Pass 1, replace every
`var(--text-faint)` in `public/app.css` (~33) and `public/app.js` (2) with
`var(--text-muted)`, then delete the `--text-faint` definitions. Tiers now:
`--text` (body), `--text-sub` (secondary), `--text-muted` (labels, hints,
timestamps — all AA), `--text-disabled` (exempt).

`--on-accent` (new) is the label colour for filled buttons — primary, secondary,
and danger. Light themes: white. Dark themes: a dark, hue-matched ink. The dark
themes lighten the accents so they read as text on a dark card, which leaves a
white button label short of AA — `--on-accent` is the fix. `--sage` / `--amethyst`
aliases as noted above; `--on-accent` has no legacy alias.

**Token rename (locked 2026-09-07).** `--sage` → `--accent`, `--amethyst` →
`--accent-2` as the canonical names. Every theme block keeps
`--sage: var(--accent)` / `--amethyst: var(--accent-2)` as aliases so existing
selectors (`.btn-sm-amethyst`, the many `var(--sage)` refs) keep working
untouched in Pass 1. Migrate call sites off the aliases opportunistically after
that; drop the aliases once nothing references them.

### Values

Contrast-checked 2026-09-07 against WCAG 2.1 — every text pairing in all six
palettes clears **AA** (≥4.5:1 body, ≥3:1 for ≥19px-bold card titles). Proof
sheet with the live ratios: the "Brambletally Palette Proof" artifact.
`--text-disabled` is intentionally below 4.5 (WCAG exempts disabled controls);
`--border-strong` is a decorative hairline, not a 1.4.11 boundary (see notes).

**Bramble** — blackberry & hedgerow. Elderberry-plum primary, bramble-leaf
green secondary, warm oat ground. The flagship.

| token | light | dark |
| --- | --- | --- |
| `--bg` | `#f3ecdc` | `#1e1a22` |
| `--card` | `#fbf6ea` | `#292330` |
| `--elevated` | `#eadfc8` | `#342c3c` |
| `--input` | `#f8f2e3` | `#2c2633` |
| `--border` | `#e0d4b8` | `#3d3545` |
| `--border-strong` | `#a89670` | `#625770` |
| `--text` | `#2a2230` | `#ece3d6` |
| `--text-sub` | `#4a3f4e` | `#c7bcae` |
| `--text-muted` | `#6f6374` | `#948a83` |
| `--text-disabled` | `#b3a9b0` | `#5c5566` |
| `--accent` | `#6b3457` | `#c17ba3` |
| `--accent-2` | `#4b6b3a` | `#8fb073` |
| `--on-accent` | `#ffffff` | `#241a20` |
| `--gold` | `#9a7526` | `#d8b768` |
| `--danger` | `#a3402f` | `#e08a76` |
| `--warn-bg` | `#f5e8cf` | `#2c2417` |
| `--warn-border` | `#dcc08a` | `#5c4a22` |
| `--warn-text` | `#785412` | `#dcbd6a` |
| `--header-bg` | `#efe6cf` | `#1e1a22` |
| `--shadow` | `0 1px 3px rgba(42,34,48,.10),0 1px 2px rgba(42,34,48,.06)` | `0 1px 3px rgba(0,0,0,.38)` |

**Hearth** — tavern warmth, autumn ember. Terracotta primary, honey-brown
secondary, toasted cream ground.

| token | light | dark |
| --- | --- | --- |
| `--bg` | `#f6eede` | `#211a15` |
| `--card` | `#fdf8ec` | `#2c2319` |
| `--elevated` | `#f0e2c9` | `#382d20` |
| `--input` | `#faf3e4` | `#2f261b` |
| `--border` | `#e6d7bb` | `#423525` |
| `--border-strong` | `#b7a074` | `#6b5a40` |
| `--text` | `#33261c` | `#efe4d2` |
| `--text-sub` | `#544335` | `#cdbfa8` |
| `--text-muted` | `#7a6857` | `#a1917a` |
| `--text-disabled` | `#b9ab98` | `#5c5142` |
| `--accent` | `#a8482b` | `#d97a55` |
| `--accent-2` | `#8a6a1f` | `#d0a94e` |
| `--on-accent` | `#ffffff` | `#241a12` |
| `--gold` | `#a9781f` | `#dcb35f` |
| `--danger` | `#8f2f28` | `#e2896f` |
| `--warn-bg` | `#f7ead0` | `#2f2614` |
| `--warn-border` | `#e0be82` | `#5f4c22` |
| `--warn-text` | `#7c5312` | `#ddba64` |
| `--header-bg` | `#f2e7d1` | `#211a15` |
| `--shadow` | `0 1px 3px rgba(51,38,28,.10),0 1px 2px rgba(51,38,28,.06)` | `0 1px 3px rgba(0,0,0,.40)` |

**Fen** — misty marsh, cool and quiet. Slate-teal primary, reed-green
secondary, cool fog ground. The one non-warm ground — keep it feeling clean.

| token | light | dark |
| --- | --- | --- |
| `--bg` | `#e9ece4` | `#161c1a` |
| `--card` | `#f4f6ef` | `#1f2724` |
| `--elevated` | `#dde2d5` | `#29332f` |
| `--input` | `#eef1e9` | `#222b28` |
| `--border` | `#d0d6c6` | `#333f3a` |
| `--border-strong` | `#97a186` | `#57655e` |
| `--text` | `#20302b` | `#e4e9df` |
| `--text-sub` | `#3b4a44` | `#bdc5ba` |
| `--text-muted` | `#5f6d66` | `#87918a` |
| `--text-disabled` | `#a6b0a8` | `#535b56` |
| `--accent` | `#2f6b6b` | `#5cb0ab` |
| `--accent-2` | `#54763a` | `#8bab63` |
| `--on-accent` | `#ffffff` | `#131c17` |
| `--gold` | `#8f7d33` | `#c3b06a` |
| `--danger` | `#a44634` | `#df8672` |
| `--warn-bg` | `#eee9d4` | `#262a17` |
| `--warn-border` | `#c9c089` | `#4c5327` |
| `--warn-text` | `#6d5f2a` | `#c9bd6a` |
| `--header-bg` | `#e2e6da` | `#161c1a` |
| `--shadow` | `0 1px 3px rgba(32,48,43,.10),0 1px 2px rgba(32,48,43,.06)` | `0 1px 3px rgba(0,0,0,.38)` |

### Contrast notes

- **`--on-accent` on filled buttons, not white.** Primary, secondary, and
  danger buttons take their label colour from `--on-accent`. White survives on
  the light-theme accents; it fails on the dark themes' lightened accents
  (2.2–2.6:1), so those use a dark ink.
- **`--border-strong` is decorative** (~2.3–2.7:1 on card). Form-field
  affordance comes from `--input` differing from `--card` plus a
  `:focus-visible` 2px `--accent` outline at ≥3:1. That focus ring is a Pass 1
  requirement — it is the WCAG 1.4.11 compliance path, not the resting border.
- **`--gold` is a graphic token, not a text colour** (clears 3:1 as an
  outline / icon fill, not 4.5:1 as text). The Supporter badge is a gold
  outline + gold diamond with a `--text-sub` label.
- **Four text tiers.** `--text-faint` is dropped; everything that used it moves
  to `--text-muted` (all AA). See Token set.

### `--tab-color` cleanup

The status tabs build colours by appending alpha hex to a bare 6-digit value:
`background:var(--tab-color,var(--sage))18`. That only works while the token is
exactly 6 hex digits and breaks with `rgb()` / `color-mix()`. Move these to
`color-mix(in srgb, var(--tab-color) 10%, transparent)` (or per-state rgba
tokens) in the same pass, so per-status accents theme cleanly.

## Type

| role | token | family | notes |
| --- | --- | --- | --- |
| headings | `--font-head` | `'EB Garamond', Georgia, 'Times New Roman', serif` | unchanged |
| body / UI | `--font-ui` | `'Alegreya Sans', system-ui, -apple-system, sans-serif` | **was Inter** — humanist, warm, literary. Smaller x-height than Inter, so it needs the larger sizes below |
| mono / numerals | `--font-mono` | `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace` | unchanged |
| wordmark + hero only | `--font-display` | `'IM Fell English', 'EB Garamond', Georgia, serif` | **new** — a real 17th-c. English type; display only, never body |

Weights to load:

- **Alegreya Sans** — 400, 400 italic, 500, 700
- **EB Garamond** — 400, 500, 600, 400 italic
- **IBM Plex Mono** — 400, 500
- **IM Fell English** — 400, 400 italic (all it has)

Numerals: the app shows counts everywhere ("2/8 steps · ~3h left"). Add
`font-feature-settings:"tnum"` on step counts, estimates, timers, and card meta
lines so digits don't jitter.

### Self-hosting — done in PR #3

21 woff2 files (`latin` + `latin-ext` subsets, `unicode-range`-gated so an
English page only pulls the latin ones) in `public/fonts/`, downloaded from
gstatic via `/tmp/fetch-fonts.mjs`. `@font-face` block prepended to
`public/app.css`, `font-display:swap`. IM Fell English italic dropped (the
wordmark is never italic). `src/pages/index.astro`: Google `<link>` +
preconnects removed, `<link rel=preload>` added for Alegreya Sans 400 + EB
Garamond 400 latin. This clears `social-plan.md`'s "self-host the fonts" item
— the only remaining third-party request is Turnstile on the sign-in screen,
which is consent-exempt.

## Type sizes

The current UI runs small — a lot of 10–13px labels and meta text. Raise the
floor and add a size scale as tokens in Pass 1. Two reasons to bump: the app is
used on a phone at arm's length, and Alegreya Sans sits visually smaller than
Inter at the same px.

Scale (define as `--fs-*` on `:root`; the count column is how many rules in
`app.css` currently use a size in that band):

| token | now | new | used for | ~rules |
| --- | --- | --- | --- | --- |
| `--fs-label` | 10px | **12px** | uppercase section labels, tab counts, edit hints | 9 |
| `--fs-xs` | 11px | **13px** | export notes, last-activity, fine print | 14 |
| `--fs-sm` | 12–13px | **14px** | meta lines, breadcrumbs, tabs, sub-lines | 39 |
| `--fs-base` | 14–15px | **16px** | secondary body, inputs, buttons, empty states | 30 |
| `--fs-body` | 16px | **16px** | primary body copy — unchanged | 9 |
| `--fs-md` | 17–18px | **18px** | emphasized list rows, small headings | 14 |
| `--fs-lg` | 19px | **20px** | card titles | 1 |
| `--fs-xl` | 20–22px | **23px** | "next" line, section heads | 6 |
| `--fs-2xl` | 26px | **27px** | detail title, wordmark | 3 |
| display | 32–56px | unchanged | focus-timer digits, hero | 4 |

Net: nothing below 12px; +1–2px on everything under 16; tapers above. The
560px column keeps running text well under 70 characters even at the larger
sizes, so no layout risk.

Also raise `body` `line-height` 1.55 → **1.6** — leading helps legibility as
much as size.

After the Alegreya Sans swap, eyeball the body size on a phone. If 16px still
reads small, take `--fs-body` and `--fs-base` to 16.5–17px rather than scaling
everything again.

## Theme mechanism

State (`localStorage`):

- `bt-mode` — `light` | `dark` | `system` (absent = `system`)
- `bt-palette` — `bramble` | `hearth` | `fen` (absent = `bramble`)

Legacy migration: the current key is `bt-theme` holding `light` | `dark`. On
first load, if `bt-mode` is absent and `bt-theme` is set, copy it to `bt-mode`,
set `bt-palette=bramble`, remove `bt-theme`.

`src/pages/index.astro` pre-paint script: read both keys, resolve `system` via
`matchMedia('(prefers-color-scheme: dark)')`, set
`data-theme="<palette>-<resolvedMode>"` before first paint. Keep
`<meta name="color-scheme" content="light dark">`.

`public/app.js` (replaces the `effectiveTheme` / `applyTheme` / `toggleTheme`
block around line 268):

- `resolvedMode()` — `bt-mode`, or system query when `system`/absent
- `currentPalette()` — `bt-palette` or `bramble`
- `applyTheme()` — set the compound `data-theme`
- header button → flips light/dark within the current palette, writes `bt-mode`
- Settings → sets `bt-palette` and `bt-mode`
- the `matchMedia` change listener re-applies only when `bt-mode` is
  `system` or absent

## Settings — Appearance section

**Built 2026-09-07** as `openAppearance()` in `public/app.js` (styles
`.bt-appr-*` / `.bt-seg*` / `.bt-swatch*` in `public/app.css`).

- **Mode** — a three-way segmented control: Light / Dark / System.
- **Theme** — three swatch cards (Bramble / Hearth / Fen). Each shows the
  palette's light `--bg` with its `--accent` and `--accent-2` as dots, the
  name, and a one-line note. Swatch colours are mirrored from this doc in a
  `PALETTE_CARDS` const — a nested element can't read `:root[data-theme]`
  tokens.
- Both live-apply on tap (`lsSet` + `applyTheme()`); no Save button. The modal
  survives the `render()` that a mode change triggers (it's mounted on
  `document.body`). Closes on ×, backdrop, or Esc.

**Deviation from the original plan:** there is no Settings shell yet (it lands
in social Phase 1), so the header button **opens this picker** rather than
blind-toggling light/dark. The quick light/dark flip is one tap deep, inside
the picker's Mode control. When the Settings shell lands, move this block into
it and decide whether the header reverts to a blind toggle.

## Wordmark, mark, favicon — done in PR #4

- **Wordmark** — set in `--font-display` (IM Fell English), weight 400,
  `--accent-2`, lowercase "brambletally." with the `.` in `--gold`. The old
  800-weight `-.03em` treatment is gone.
- **Mark** — a **side-profile hedgehog** as an inline `<svg class="bt-hog">`
  in `app.js`: spike-fan back, wedge snout with nose + eye dots, three feet.
  All stroke, `currentColor`, so it inherits the wordmark's `--accent-2`.
  Sits before "brambletally." in the header and the auth screen. The curled
  variant was tried and dropped — it read as an emoji face.
- **Favicon** — `public/favicon.svg` is the same hedgehog path with an explicit
  `#4b6b3a` stroke (works on light and dark browser chrome). PNG fallbacks
  (32 / 180 apple-touch) still to add.

## Icon set — done in PR #4

`icon(name, size)` in `app.js` returns an inline `<svg class="bt-ic">` — 24×24
viewBox, 1.75 stroke, `currentColor`. Set shipped: **search, people, steps**
(break-into-sub-steps, an indented-list glyph), **candle** (focus session),
**leaf** (focus finish), **check, close, back, plus, sun, moon, chevron**.
Every emoji (`🔍 👥 🔨 ✅`) and the `▶ ☾ ☀ ✕ ✓ ×` glyphs are swapped. More
icons (tag, link, photo, quill, basket, bell) get added as the features that
need them land.

## Polish — optional, later

- **Paper texture** — a tiled fibre/noise SVG as a data-URI on `body`, ~2–3%
  opacity, per-theme opt-in. Bramble and Hearth yes; Fen probably not.
- **Flourish dividers** — a small centred sprig SVG between major sections,
  replacing `<hr>`. One component.
- **Empty-state illustrations** — woodcut, ink + one accent, `currentColor`
  where possible. Home ("Nothing in the bramble yet — plant a project."),
  no-tasks, 404.
- **Radius tokens** — `--radius-sm:6px --radius:9px --radius-lg:14px` for
  consistency; keep the current 7–10px feel.
- **Motion** — leave the .15–.25s transitions as they are. Nothing springy.

## Copy

### Tagline

**"a keeping-book for makers"** (locked 2026-09-07). Fills the existing
uppercase-tracked slot under the wordmark.

### Focus session

Name stays **"Focus"** (locked 2026-09-07) — clear at the entry point, no
learning curve. Rename the leftover classes `noodle-screen` /
`noodle-wordmark` → `focus-screen` / `focus-wordmark`.

**Candle motif.** A candle carries the theme for this mode: the nav/menu icon
is a candle, and the focus screen itself shows a lit-candle illustration
instead of a bare timer. Option for later — tie the candle to the session:
flame while running, snuffed on pause, wax lower as time elapses. Keep it
woodcut-simple and `currentColor`.

### Status labels

Active / Waiting For / Someday / Paused / Done stay function-first. The visuals
carry the theme, not the labels.

## Sequencing

**Pass 1 — palette + type (PR #1, merged).**
Three palettes × two modes as token blocks (contrast-checked); `--accent` /
`--accent-2` + `--on-accent`; `--text-faint` → `--text-muted` (four tiers);
`--fs-*` scale + mechanical px uplift; `line-height` 1.6; `bt-mode` +
`bt-palette` storage with legacy migration; the Appearance picker.

**Pass 1 finish (PR #3).**
Self-hosted fonts — 21 latin/latin-ext woff2 subsets in `public/fonts/`,
`@font-face` at the top of `app.css`, no more Google `<link>` (removes the last
non-essential third-party request); `<link rel=preload>` for Alegreya Sans 400
+ EB Garamond 400. All `var(--sage)NN` / `var(--amethyst)NN` alpha-hex tints
→ `color-mix()`; plain `var(--sage)` / `var(--amethyst)` → `var(--accent)` /
`var(--accent-2)`; the alias declarations dropped from every palette block (the
`.btn-sm-amethyst` / `.checked-sage` *class names* stay — cosmetic). `noodle-*`
classes / `#noodle-screen` → `focus-*` / `#focus-screen`. Header tagline →
"a keeping-book for makers". Wordmark set in `--font-display` (IM Fell English),
weight 400, `--accent-2`.
Still open: adopt the `--fs-*` tokens rule-by-rule (currently the scale is
defined and the raw px values were uplifted, but rules don't reference the
tokens yet).

**Pass 2 — identity (PR #4, done).**
Hedgehog mark (side profile) + favicon. `icon()` helper + a 13-icon line set;
every emoji and symbol glyph swapped. IM Fell wordmark + gold dot.
Still to add: PNG favicon fallbacks; more icons as later features need them.

**Pass 3 — polish (optional).**
Paper texture, flourish dividers, empty-state illustrations, radius tokens.

## Open decisions

None blocking. Resolved 2026-09-07:

- Themes: **Bramble** (default), **Hearth**, **Fen** — light + dark each.
- Body font: **Alegreya Sans**.
- Mark: a **hedgehog**.
- Tokens rename to **`--accent` / `--accent-2`** with back-compat aliases
  through Pass 1; new **`--on-accent`** for filled-button labels.
- Tagline: **"a keeping-book for makers"**.
- Focus session keeps the name **"Focus"**, with a **candle** motif.
- Per-theme hex values **contrast-checked** — all text pairings pass WCAG 2.1
  AA (see Values → Contrast notes; live proof in the palette-proof artifact).
- **Four text tiers** — `--text-faint` dropped, folds into `--text-muted`.
- **Type scale raised** — `--fs-*` tokens, 12px floor, +1–2px under 16px,
  `line-height` 1.6 (see Type sizes). Re-check body size on a phone after the
  Alegreya swap.
- **PR #1** — palette, type, four tiers, `bt-mode`/`bt-palette` storage, the
  Appearance picker.
- **PR #3** — self-hosted fonts, `color-mix()` cleanup + aliases dropped,
  `noodle`→`focus` rename, tagline copy, IM Fell wordmark.

Still to design during the build: the hedgehog mark itself, the icon set, and
the optional empty-state illustrations (PR #4).
