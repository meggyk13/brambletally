# Brambletally — Brand & Design

Brambletally's own visual identity, separate from Rayhana's Repositorium.
Companion to `plan.md` and `social-plan.md`.

Status: **Pass 1–2 shipped 2026-09-07** (PRs #1, #3, #4). Palettes, type,
four tiers, Appearance picker, self-hosted fonts, `noodle`→`focus`, wordmark,
`icon()` line set — all live. Display font changed to **Uncial Antiqua**
2026-09-12 (was IM Fell English). **No brand mark** (hedgehog attempts
dropped; favicon is a placeholder berry). **Pass 3 is spec'd, partly built** —
3a and 3b-1…4 spec'd 2026-09-09, the card (3b-5) spec'd 2026-09-12 after the
direction was chosen. See Pass 3 below. Built so far, all 2026-09-12: the
**Damson/Vellum/Raven CSS token blocks** and the **Appearance picker's
gated-swatch UI** (all six themes selectable in Settings, the three Supporter
ones dimmed with a toast-gate for non-Supporters); and **3a-1/3a-2/3a-3** —
status colours are now per-theme `--status-*` tokens (extended to Vellum and
Raven, not in the table when this was first spec'd), the pill label went
neutral with a coloured dot, `STATUS_COLOR`/`CAT_COLOR` are gone, and
category tabs take `--accent-2`. **3a-4** also shipped: the remaining
hardcoded reds/ambers/slates moved onto tokens, the blue-grey shadow tint
became a per-theme `color-mix()` of `--text`, and the real `--text-muted`-on-
`--elevated` AA failure is fixed at 6 call sites (verified 7.08–8.16:1 across
all twelve theme-modes). 3a-5 (housekeeping), 3a-6 (stale copy), and all of
3b are still open. A real
mark is still later work.

## Direction

A **tally** is a medieval accounting tool — a notched stick for tracking debts
and stores. "Brambletally" reads as *a keeping-book kept in the hedgerow*. The
app is a **workshop ledger for makers** — sewing and costuming, research, event
prep, household work, admin. (It grew out of SCA use and still speaks to it,
but the product is no longer SCA-specific — see `plan.md` "Audience". The
vocabulary in the UI stays plain; the *look* below is the part that leans
old-world, and that's a deliberate skin, not an audience filter.)

Aesthetic: cottagecore / fantasy / folk-medieval. Visual language is woodcut
and linocut, botanical marginalia, iron-gall ink on parchment, guild inventory
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
- **Theme** — `bramble` | `hearth` | `fen` | `damson` | `vellum` | `raven`

They resolve to one attribute on `<html>`: `data-theme="<theme>-<mode>"`, e.g.
`bramble-light`, `fen-dark`. Twelve combinations, twelve CSS blocks, plus a
bare `:root` holding the `bramble-light` values so a missing attribute still
renders.

**Three standard, three Supporter** (revised 2026-09-12, reverses the note
below). Bramble, Hearth, Fen ship free, both modes. Damson (the purple 4th
theme), Vellum (cool corporate stationery — navy ink, pewter, brass; see
below), and Raven are **Supporter tier**.

**Damson was added 2026-09-12** for a specific person who wants a purple app,
and briefly shipped free and under the working name **Heather** — renamed the
same day, since that name belongs to a real person (the user's best friend)
and shouldn't be reused here. It also briefly shipped ungated rather than
gate "the reason someone opens the app"; that's reversed too, now that
there's a real 3/3 split to keep coherent. The person it was built for gets
**manually granted Supporter** through the admin panel (`social-plan.md`)
instead; the theme itself is gated like the other two.

**Vellum was revised 2026-09-12**, same day as Raven — its original
ink-on-vellum concept (near-black ink, one rubric red) landed too close to
Raven once both existed side by side; both read as "black plus one red
accent." Vellum moved to a **cool corporate-stationery** direction instead:
grey "vellum finish" paper stock, a navy-ink accent, a pewter secondary, and
a brass detail — no red anywhere in it, and no relation to the manuscript
concept its name started from. The name stays; "vellum finish" is also a
real paper-stock term, so it still fits.

**Raven was Nightshade** until 2026-09-12, when it turned out too close to
Damson — both landed as "the purple one." Moved off the purple axis
entirely: obsidian ground, an oxblood-red accent, ash-grey secondary. Still
goth/villain-coded, now via blood and corvid menace rather than poison.

**Raven is dark by nature** — a saturated, dark-first palette. Rather than
build mode-locked themes (the Mode control disabling `light` for one theme
only), it ships a **compromised light variant**: weaker than the dark mode,
but present, so Mode stays a simple three-way toggle with no per-theme
exceptions. A custom accent picker is a **separate, still-undecided** Supporter
candidate — see `open-questions.md` Q4; a free-form wheel is off the table
regardless (breaks the AA guarantees below), a curated swap list is the
leading option.

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

Contrast-checked 2026-09-07 against WCAG 2.1 (Damson added 2026-09-12) — every
text pairing clears **AA** (≥4.5:1 body, ≥3:1 for ≥19px-bold card titles), with
**one known exception, see below**. Proof sheet with the live ratios: the
"Brambletally Palette Proof" artifact. `--text-disabled` is intentionally below
4.5 (WCAG exempts disabled controls); `--border-strong` is a decorative
hairline, not a 1.4.11 boundary (see notes).

> **Known AA failure — `--text-muted` on `--elevated`** (found 2026-09-12 while
> checking Damson). All six shipping palettes land at **3.96–4.38:1**, below
> the 4.5 floor, at 12–14px. Seven rules pair them: `.btn-icon` (402),
> `.btn-edit-mode` (586), an export control (704), `.step-notes-body` (763),
> `.cat-badge` (771 — already fixed by the override at 1513), an `.sp-*`
> control (831), `.bt-meta-select` (1679).
>
> **Fix: those rules take `var(--text-sub)`.** Checked across all eight
> palettes — 7.08–7.86:1, comfortable. This is cheaper and safer than re-tuning
> six `--text-muted` values, which ripple through ~40 other rules. **Built
> 2026-09-12** as part of Pass 3a-4 — extended to Vellum/Raven too
> (7.08–8.16:1 across all twelve theme-modes).
>
> Damson's own `--text-muted` was tuned to clear the pairing anyway
> (4.95 / 5.01), so the new theme is correct either way.

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

**Damson** — moorland purple (added 2026-09-12; named for the dark purple
plum, not the working name it briefly shipped under). Violet primary,
dusty-rose secondary, cool lilac-grey ground. The only palette with **no warm
ground and two accents from the same family** — that is what makes it read as
"the purple one" rather than as a Bramble variant.

Bramble's `--accent` is already an elderberry plum, so the separation is
deliberate and worth keeping: Bramble is plum-on-oat with a *green* secondary,
Damson is violet-on-lilac with a *rose* secondary. Anyone comparing them
side by side should not wonder why there are two purple themes.

| token | light | dark |
| --- | --- | --- |
| `--bg` | `#ece8f0` | `#1b1622` |
| `--card` | `#f7f4fa` | `#251e2e` |
| `--elevated` | `#e2dcea` | `#302738` |
| `--input` | `#f2eef6` | `#292130` |
| `--border` | `#ddd5e6` | `#392f44` |
| `--border-strong` | `#a294b3` | `#665a7a` |
| `--text` | `#262130` | `#ebe4f0` |
| `--text-sub` | `#463c52` | `#c8bcd2` |
| `--text-muted` | `#635871` | `#a095ab` |
| `--text-disabled` | `#b0a7ba` | `#5c5268` |
| `--accent` | `#6a3d8f` | `#b98ede` |
| `--accent-2` | `#8e4370` | `#d590b4` |
| `--on-accent` | `#ffffff` | `#201828` |
| `--gold` | `#8a7220` | `#d4b46c` |
| `--danger` | `#a2333f` | `#e08a90` |
| `--warn-bg` | `#f1e9d8` | `#2b2418` |
| `--warn-border` | `#d6bf90` | `#584a24` |
| `--warn-text` | `#6f5417` | `#d9ba68` |
| `--header-bg` | `#e6e0ee` | `#1b1622` |
| `--shadow` | `0 1px 3px rgba(38,33,48,.10),0 1px 2px rgba(38,33,48,.06)` | `0 1px 3px rgba(0,0,0,.40)` |

Damson's `--gold` and `--danger` are pulled slightly cooler than the other
palettes' so they do not read as stray warm patches on a cool ground.

**Vellum** — cool corporate stationery, revised 2026-09-12 off its original
ink-on-vellum concept (too close to Raven). Navy ink, pewter, brass, grey
"vellum finish" paper. No red anywhere in the identity colours.

| token | light | dark |
| --- | --- | --- |
| `--bg` | `#e6e4dd` | `#191b22` |
| `--card` | `#f4f3ee` | `#212330` |
| `--elevated` | `#dad7cd` | `#2a2d3c` |
| `--input` | `#eeece4` | `#1e202b` |
| `--border` | `#d3d0c4` | `#383b4c` |
| `--border-strong` | `#9d9a8c` | `#5c5f74` |
| `--text` | `#1f1e28` | `#e6e5ee` |
| `--text-sub` | `#423f4d` | `#bcbac8` |
| `--text-muted` | `#6a6673` | `#8b899a` |
| `--text-disabled` | `#9d9aa8` | `#565566` |
| `--accent` | `#22305a` | `#7b8fd4` |
| `--accent-2` | `#5a6270` | `#8f96a8` |
| `--on-accent` | `#f4f3ee` | `#14151c` |
| `--gold` | `#8a7038` | `#c9a860` |
| `--danger` | `#9c2f30` | `#d97579` |
| `--warn-bg` | `#ece7d4` | `#262316` |
| `--warn-border` | `#c7b98a` | `#564a26` |
| `--warn-text` | `#6b5518` | `#d1ab5e` |
| `--header-bg` | `#dedbd0` | `#191b22` |
| `--shadow` | `0 1px 3px rgba(31,30,40,.10),0 1px 2px rgba(31,30,40,.06)` | `0 1px 3px rgba(0,0,0,.40),0 1px 2px rgba(0,0,0,.28)` |

**Raven** — obsidian and oxblood, revised 2026-09-12 from the original
Nightshade (too close to Damson). Dark is the real theme; light is the
deliberately compromised variant, not the point of it.

| token | light | dark |
| --- | --- | --- |
| `--bg` | `#e8e4de` | `#121213` |
| `--card` | `#f3f0ea` | `#1c1c1f` |
| `--elevated` | `#dcd6cc` | `#262629` |
| `--input` | `#efece5` | `#18181b` |
| `--border` | `#cfc7ba` | `#333336` |
| `--border-strong` | `#9c9284` | `#57575c` |
| `--text` | `#1c1a17` | `#ece9e6` |
| `--text-sub` | `#3d3833` | `#c2beb9` |
| `--text-muted` | `#6b645a` | `#8f8b87` |
| `--text-disabled` | `#9c9284` | `#4f4f52` |
| `--accent` | `#8a1c28` | `#c23347` |
| `--accent-2` | `#6b665c` | `#6b6a66` |
| `--on-accent` | `#f5ece9` | `#f5ece9` |
| `--gold` | `#7d6b46` | `#b39f6e` |
| `--danger` | `#a3283a` | `#e2586c` |
| `--warn-bg` | `#ece2cc` | `#201a16` |
| `--warn-border` | `#c7ab7a` | `#4a3a2c` |
| `--warn-text` | `#6b4f1e` | `#c9a468` |
| `--header-bg` | `#e8e4de` | `#121213` |
| `--shadow` | `0 1px 3px rgba(28,26,23,.14),0 1px 2px rgba(28,26,23,.08)` | `0 2px 6px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.4)` |

**Contrast — audited 2026-09-12 (script, not the manual proof sheet the other
four used; re-check with that sheet before build).** 192 pairings across all
six themes × both modes: text/bg, text/card, text-sub/bg, text-sub/card,
text-sub/elevated, text-muted/card, on-accent/accent, on-accent/accent-2,
accent/gold as graphic elements (≥3:1), danger/bg, danger/card,
warn-text/warn-bg. **170 pass outright.** The other 22 are the same two
patterns in every theme, not new problems:

- **`--text-muted` on `--elevated`** fails in 10 of 12 theme-modes (3.88–4.46,
  need 4.5) — this is the already-known issue from 3a-4 (only Damson's tuned
  `--text-muted` clears it). Same fix applies: those call sites take
  `--text-sub`, not a retune of the token.
- **`--border-strong` on `--card`** fails in all 12, uniformly (2.23–2.69,
  need 3) — expected, not a gap. `--border-strong` is decorative, same as
  `--border` — see Contrast notes above and `open-questions.md` Q7 (resolved
  2026-09-12, confirming a position this doc already stated).

**Two real fixes made during this audit**, both in Raven's dark mode — its
first draft had `--accent` and `--danger` too close in luminance to
`--card`/`--bg` to read as icon fills or error text (2.23:1 and 3.56–3.92:1).
Both brightened; values above are corrected. Vellum's dark `--danger` was a
near-miss (4.48, needed 4.5) and got a small bump to 4.73/5.54.

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

**Status 2026-09-09 — half done.** The `color-mix()` rewrite landed for
`.status-pill` and `.tab.active`, but three alpha-hex declarations survive in
`app.css` and one of them is live. They are what blocks the status tokens in
Pass 3. Full list and the fix: Pass 3 → 3a-3.

## Type

| role | token | family | notes |
| --- | --- | --- | --- |
| headings | `--font-head` | `'EB Garamond', Georgia, 'Times New Roman', serif` | unchanged |
| body / UI | `--font-ui` | `'Alegreya Sans', system-ui, -apple-system, sans-serif` | **was Inter** — humanist, warm, literary. Smaller x-height than Inter, so it needs the larger sizes below |
| mono / numerals | `--font-mono` | `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace` | unchanged |
| wordmark + hero only | `--font-display` | `'Uncial Antiqua', 'EB Garamond', Georgia, serif` | **changed 2026-09-12**, was IM Fell English — display only, never body |

Weights to load:

- **Alegreya Sans** — 400, 400 italic, 500, 700
- **EB Garamond** — 400, 500, 600, 400 italic
- **IBM Plex Mono** — 400, 500
- **Uncial Antiqua** — 400 (all it has; changed 2026-09-12, was IM Fell English)

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
- `bt-palette` — `bramble` | `hearth` | `fen` | `damson` | `vellum` | `raven` (absent = `bramble`)

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

The Appearance controls live in the **Settings screen** as of the social
Phase 1b-i PR (#10). `openAppearance()` (the standalone modal) is gone;
`appearanceControls()` returns the Mode segmented control + palette swatches as
a DOM node that `renderSettings()` slots in. Styles unchanged
(`.bt-appr-*` / `.bt-seg*` / `.bt-swatch*`).

- **Mode** — Light / Dark / System segmented control.
- **Theme** — swatch cards for all six themes, colours mirrored from this doc
  in `PALETTE_CARDS` (a nested element can't read `:root[data-theme]`
  tokens). **Built 2026-09-12**: the three Supporter swatches
  (`isLockedPalette()`) render at 55% opacity with a grayscale chip and a
  small "Supporter" pill; clicking one as a non-Supporter shows a toast
  instead of applying it. `PALETTES` recognizes all six ids regardless of
  plan — a stored choice always renders, even if Supporter status is later
  revoked; only the picker enforces the gate.
- Live-apply on tap (`lsSet` + `applyTheme()`), no Save button.

The header `#bt-theme` button is now a **blind light/dark flip**
(`toggleTheme`); a **gear button** opens Settings, where the full picker lives.

## Wordmark, mark, favicon

- **Wordmark** — set in `--font-display` (Uncial Antiqua, changed 2026-09-12
  from IM Fell English), weight 400, `--accent-2`, lowercase "brambletally."
  with the `.` in `--gold`. The old 800-weight `-.03em` treatment is gone.
  (PR #4)
- **Mark — none for now.** Two hedgehog attempts (a mountain-range-ish first
  pass, then a rounder redraw) were both rejected and removed (PR to drop it,
  post-#5). The wordmark + tagline carry the identity. A real mark is a later
  job — the user will design one.
- **Favicon** — `public/favicon.svg` is a placeholder blackberry (four
  `#6b3457` circles). Replace when the mark exists; add PNG fallbacks then.

## Icon set — done in PR #4

`icon(name, size)` in `app.js` returns an inline `<svg class="bt-ic">` — 24×24
viewBox, 1.75 stroke, `currentColor`. Set shipped: **search, people, steps**
(break-into-sub-steps, an indented-list glyph), **candle** (focus session),
**leaf** (focus finish), **check, close, back, plus, sun, moon, chevron**.
Every emoji (`🔍 👥 🔨 ✅`) and the `▶ ☾ ☀ ✕ ✓ ×` glyphs are swapped. More
icons (tag, link, photo, quill, basket, bell) get added as the features that
need them land.

## Pass 3 — polish (spec'd 2026-09-09)

Two PRs, in order.

- **3a — colour + housekeeping.** Subtractive. Nothing new is drawn; the
  leftovers from the Repositorium era come out and the shipped work starts
  reading the way Pass 1 intended.
- **3b — the drawn things.** The candle, empty states, texture, dividers.

3a first. 3b sits on top of it and is much less satisfying if the status
colours are still shouting over it.

### 3a-1 Status colours become theme tokens — built 2026-09-12

**The problem.** `STATUS_COLOR` in `app.js:12` is a hardcoded İznik map that
predates the rebrand:

```
Active: '#2f9491'       // turquoise
'Waiting For': '#bd8a34'
Someday: '#5566a8'      // cobalt-violet
Paused: '#8a8578'
Done: '#5a8a5f'
const CAT_COLOR = '#3a5fb0'   // cobalt
```

Those six values are injected inline into the status pill, the filter tabs,
the progress-bar fill, the detail strip and `.bt-status-select` — the
highest-contrast colour moments on both main screens. They do not move when
the user switches palette, so a Hearth or Fen user gets turquoise and cobalt
on a warm or cool-green ground, and in Bramble they compete with elderberry
and leaf. This is the single thing most responsible for the app not looking
like the palette work that shipped.

**The treatment changes too, not just the values.** Today the pill is the
status hue as *label text* on a 16% tint *of the same hue*
(`app.css:1570`). Tinting a background with the text's own colour caps the
achievable contrast no matter which hue is chosen — checked 2026-09-09, most
candidate hues land at 3.8–4.4:1 in that construction, including the current
`--accent`. So:

- The pill label becomes **`--text-sub`**, not the status hue.
- The hue moves to a **7px dot** at the head of the pill (reuse `.status-dot`)
  and keeps the 16% tint as the chip ground.
- The hue keeps carrying the progress-bar fill, the detail strip, and the
  active-tab underline unchanged.

The pill stops being five shouting colours and becomes a quiet chip with a
coloured bead. This is also the answer to "everything is competing" — the hue
still encodes status, it just stops setting the type.

### 3a-2 Status token values — built 2026-09-12, extended to Vellum/Raven

Five new tokens per theme block: `--status-active`, `--status-waiting`,
`--status-someday`, `--status-paused`, `--status-done`.

Most of them are not new colours. `active` is each theme's `--accent`,
`waiting` is its `--gold`, and `done` is its `--accent-2` — except where a
theme's `--accent-2` isn't itself green (Hearth, Damson, Vellum, Raven all
get a hand-drawn olive instead; Bramble and Fen alias straight through).
Someday/paused are hand-drawn neutrals in every theme. Vellum and Raven
didn't exist when this table was first drafted (2026-09-09) — their values
were derived the same day the token CSS actually landed (2026-09-12), same
method, same three contrast constructions below.

**Someday is cool-lean, Paused is warm-lean** — both are "not now" states and
neither should have chroma, but the temperature split keeps them apart at a
glance without adding a sixth hue.

| token | bramble-light | bramble-dark | hearth-light | hearth-dark | fen-light | fen-dark |
| --- | --- | --- | --- | --- | --- | --- |
| `--status-active` | `#6b3457` | `#c17ba3` | `#a8482b` | `#d97a55` | `#2f6b6b` | `#5cb0ab` |
| `--status-waiting` | `#9a7526` | `#d8b768` | `#a9781f` | `#d0a94e` | `#8f7d33` | `#c3b06a` |
| `--status-someday` | `#63607a` | `#9d95ad` | `#605d6b` | `#a397a8` | `#5c6472` | `#93a0a8` |
| `--status-paused` | `#7a6a58` | `#a2968b` | `#7a6857` | `#a4968a` | `#6e6a5f` | `#a0998c` |
| `--status-done` | `#4b6b3a` | `#8fb073` | `#5c6b30` | `#a3b473` | `#54763a` | `#8bab63` |

| token | damson-light | damson-dark | vellum-light | vellum-dark | raven-light | raven-dark |
| --- | --- | --- | --- | --- | --- | --- |
| `--status-active` | `#6a3d8f` | `#b98ede` | `#22305a` | `#7b8fd4` | `#8a1c28` | `#d34f5e`* |
| `--status-waiting` | `#8a7220` | `#d4b46c` | `#8a7038` | `#c9a860` | `#7d6b46` | `#b39f6e` |
| `--status-someday` | `#5f5c78` | `#9a92ad` | `#5f6478` | `#9ea3b8` | `#5c6470` | `#8f96a4` |
| `--status-paused` | `#6f6560` | `#a2958b` | `#766b58` | `#b0a58c` | `#6b5f52` | `#a2917f` |
| `--status-done` | `#4d6b4a` | `#93b584` | `#3f6b46` | `#8bb08f` | `#55684a` | `#7f9f74` |

Damson, Vellum and Raven, like Hearth, have no green of their own, so their
`--status-done` is a cooled olive/moss drawn for the purpose rather than an
`--accent-2` alias.

**\*Raven-dark `--status-active` does not alias `--accent`.** The base
`--accent` (`#c23347`) clears the *original* palette audit's
accent-as-graphic-element check (≥3:1 against `--card`/`--bg`), but fails
this token's own dot/fill constructions against `--elevated` and a 16% tint
(2.76–2.77:1, need ≥3) — a stricter, narrower ground than that first check
used. Rather than re-brighten the shared `--accent` (which would also move
every button, link and icon that uses it), `--status-active` gets its own
brightened value for this one theme-mode. Same *why* as the two fixes already
made to Raven's dark accent/danger during the original palette audit — a hue
that reads fine as text or a filled button can still be too close in
luminance to a specific small-graphic ground.

Aliases (`active` = `--accent`, `waiting` = `--gold`, `done` = `--accent-2`
where it's green) may be written as `var(--accent)` rather than repeating the
hex — but write them as their own declarations in every theme block, so a
later divergence (like Raven-dark's) is a one-line change, not a token
redefinition.

**Contrast — checked 2026-09-09 for the first four themes, extended to
Damson/Vellum/Raven 2026-09-12; all 60 pass.** Three constructions, against
the treatment in 3a-1:

- pill label — `--text-sub` on a 16% status tint over `--card`, needs ≥4.5:1 →
  **range 5.80–8.40**
- status dot — the hue on that same tint, graphic, needs ≥3:1 →
  **range 3.09–8.62**
- progress fill — the hue on `--elevated`, graphic, needs ≥3:1 →
  **range 3.05–8.90**

The tightest values are `waiting` in the light themes (3.05–3.58 on the dot
and bar). That is deliberate: `waiting` is each theme's `--gold`, and the
Contrast-notes rule that **gold is a graphic token, never a text colour**
still holds — under this treatment gold is only ever a dot or a fill, never
type. Do not "fix" it by darkening; that breaks the alias. Raven-dark
`--status-active` (3.46/3.63, see above) is the next-tightest, by design —
brightened only as far as the checks require.

### 3a-3 Plumbing: `data-status`, and finishing the `--tab-color` cleanup — built 2026-09-12

The inline `style="--tab-color:#2f9491"` came out of the render code. The
pill, the tab, the progress fill, the detail strip, and `.bt-status-select`
now carry a `data-status="Active"` attribute instead, mapped by five CSS
rules:

```
[data-status="Active"]      { --tab-color: var(--status-active); }
[data-status="Waiting For"] { --tab-color: var(--status-waiting); }
...
```

`STATUS_COLOR` and `CAT_COLOR` are gone. The category filter tabs take
`--accent-2` directly (`style="--tab-color:var(--accent-2)"`) rather than a
colour constant. `.progress-bar-fill` keeps an inline `style="width:N%"` —
width has to be inline — but its `background` moved to `var(--tab-color)` in
CSS. A `statusPill()` helper in `app.js` renders the dot + neutral-label
markup once, used at all four call sites (home card, project detail
read-only, review-screen card) instead of repeating the template.

**The three dead alpha-hex sites were deleted, the one live site ported.**
`var(--tab-color)NN` only parses while the value is a bare 6-digit hex, so it
broke the moment the token held `var(--status-active)`. `.tab.active` and
`.tab.active .tab-count` (dead, already overridden by `#bt-app`-scoped rules)
are gone; `#bt-app .status-pill`'s old alpha-hex background (also dead,
superseded by the color-mix version further down) is gone; `#bt-app
.bt-status-select` (the one live site) now uses
`color-mix(in srgb, var(--tab-color, var(--accent)) 13%, transparent)`.

### 3a-4 Remaining off-palette colour — built 2026-09-12

Everything below was a Tailwind or slate leftover sitting in a hand-mixed
earth palette. All of it had a token already.

| value | where | → | done |
| --- | --- | --- | --- |
| `#ef4444` (×9 found, not 8) | `.status-menu-item.danger`, `.priority-badge-high`, `.due-today-label`, `.due-today-count` (×2, one an alpha-hex background), `.btn-danger` (alpha-hex background), `.due-over`, `.next-group[data-key="overdue"] .next-row-sub` | `var(--danger)`, alpha-hex backgrounds → `color-mix(in srgb, var(--danger) N%, transparent)` | ✅ |
| `#f59e0b` | `.shortfall` | `var(--warn-text)` | ✅ |
| `#E8A020` | `.priority-badge-medium` | `var(--warn-text)` | ✅ |
| `#f1f5f9` (×2) | `.detail-back`, `.detail-export` (base rules, not `#bt-app`-scoped) | **left as-is, see note below** | ⏭ |
| `rgba(38,48,74,…)` (×4) | `.card:hover`, `.modal` (×2), `.modal-overlay.bt-ask .modal` | `color-mix(in srgb, var(--text) N%, transparent)` — each theme's own ink at the original alpha, rather than a fixed blue-grey | ✅ |
| `var(--text-muted)` on `var(--elevated)` (×6) | `.btn-icon`, `.btn-edit-mode`, `.export-table th`, `.step-notes-body`, `.subpanel-back`, `#bt-app .bt-meta-select` | `var(--text-sub)` — **an AA failure, not a taste call.** See Values → Known AA failure. Verified: 7.08–8.16:1 across all twelve theme-modes (script-checked) | ✅ |

**The two `#f1f5f9` sites were left alone, deliberately.** Both are the base
(non-`#bt-app`-scoped) `.detail-back`/`.detail-export` rules from the
noodlr-era cover-photo header — floating buttons on a `rgba(0,0,0,.3)` scrim
meant to sit over an unknown photo, always confirmed dead (fully overridden
by the live `#bt-app`-scoped versions actually used today, and `.detail-cover`
that they belong to is unrendered — see Themes → 3b-5c). The doc's original
mapping (`var(--elevated)`) would be a real bug if this code were ever
revived: `--elevated` is dark in dark mode, which would put dark text on a
dark scrim. A floating control over unknown photo content needs a
theme-*independent* light colour, not a theme token — this is a case where
the literal instruction was wrong for this specific site. Left as literal hex
since nothing renders it either way; flag for whoever builds 3b-5c's cover
photos for real.

The `rgba(38,48,74,…)` shadows were a blue-grey cast on a warm ground —
subtle, but it is why the cards read slightly cold in Bramble and Hearth.
`color-mix(in srgb, var(--text) N%, transparent)` reuses each theme's own
`--text` as the shadow tint — the same relationship the per-theme `--shadow`
token already has to its own theme (e.g. Bramble's `--shadow` uses
`rgba(42,34,48,…)`, which is exactly Bramble-light's `--text` as RGB) —
without needing a new per-theme RGB-triplet token just for this.

### 3a-5 Housekeeping (same PR — the reason changes feel like whack-a-mole)

`app.css` has grown an override layer. `.wordmark` is declared at 394
(`font-weight:800; letter-spacing:-.03em`) and re-declared at 1472 with the
actual IM Fell treatment; `.status-pill` is declared **four times** (454, 1215,
1511, 1570). The "Visual polish" block from ~1468 restates cards, buttons,
inputs and modals that were already declared a thousand lines earlier. Nothing
here is visible to a user — it is why the *next* pass either fights the old
layer or adds a third one.

- Fold the `#bt-app …` override block back into the original declarations.
  Keep `#bt-app` scoping only where it is actually needed to win.
- **Adopt the `--fs-*` tokens rule-by-rule.** Still open from Pass 1 finish:
  the scale is defined on `:root` and the raw px were uplifted, but no rule
  references a token, so the scale is currently decorative.
- Add `font-feature-settings:"tnum"` to step counts, estimates, card meta and
  the focus timer. Called for in Type; `tnum` currently appears **zero** times
  in either file, so "2/8 steps · ~3h left" jitters as it updates.
- **Radius tokens** — `--radius-sm:6px --radius:9px --radius-lg:14px`. Keeps
  the current 7–10px feel; makes it consistent. Cheap while the file is open.

### 3a-6 Two stale-copy bugs

Not design, but both are user-visible rebrand leftovers and both are one line.
See `plan.md` "Audience".

- The **auth screen** still reads "A&S projects, personal research, and
  Chatelaine office work" with a "← Rayhana's Repositorium" back link. This is
  the first screen a new user sees, and it is exactly the SCA vocabulary the
  audience revision says to drop.
- The **landing footer** reads "Made for Rayhana's Repositorium."

### 3b-1 The candle

The highest-value drawn thing in the app, and the reason to do 3b at all.

Today the running focus screen is an SVG progress ring plus digits
(`app.js:6094`). It is the one screen a person looks at for twenty-five
minutes with nothing else to do, and the only screen where a picture is
unambiguously the right answer. The `candle` icon already exists
(`app.js:267`) but nothing renders it at size.

- A woodcut candle **replaces the ring** — a candle is already a progress
  indicator, so keeping both is redundant. The digits stay, below it, in
  `--font-mono` with `tnum`.
- Wax height binds to a CSS custom property (`--burn`, 0→1) driven by the
  existing tick. No new timer.
- **Flame states:** lit while running; snuffed with a small smoke curl on
  pause; on finish, the existing `leaf`.
- Ink in `--accent-2`, flame in `--gold`, `currentColor` where it can be.
  Woodcut-simple — outline and hatching, no gradients.
- **`prefers-reduced-motion`: no flicker.** Static flame, wax still drops.
  The wax is information; the flicker is decoration.

If the candle turns out to be a bad idea in the making, this is the cheap
place to find out — everything else in 3b stands on its own.

### 3b-2 Empty states

`.empty` is currently 60px of italic muted text. Woodcut, ink plus one accent,
`currentColor` where possible.

- **Home, no projects** — "Nothing in the bramble yet — plant a project."
  (copy already locked). Illustration above it.
- **404** — illustration.
- **A filter with no matches** — text only, no illustration. A filtered-empty
  state is a transient result, not a moment; drawing it over-decorates.

### 3b-3 Paper texture

The working copy of `index.astro` gives the landing page a `body::after`
fibre/noise data-URI at ~2.8% (soft-light at 6% in dark). `app.css` has
**none** — so the marketing page currently has more character than the
product. Port it.

Per-theme opt-in via a `--grain-opacity` token: Bramble and Hearth yes, **Fen
0** — Fen's brief is "keep it feeling clean."

### 3b-4 Flourish dividers

The landing page already has the component (`.vine`, a 180×28 sprig). Port it
as one component and use it **sparingly — project-detail section breaks only**,
replacing `<hr>`. The home list is dense enough already.

Lowest priority item in the pass. Easy to cut if 3b is running long.

### 3b-5 The card — direction chosen 2026-09-12

Direction picked from the "Brambletally Home Directions" canvas: **enriched
cards**, not the ledger. The card shape the app already ships stays; what
changes is that a card finally has something on it besides type.

This supersedes the earlier 3b-5, which called the card work "least certain"
and proposed a per-status left edge. Three parts below, ordered by what blocks
them.

#### 3b-5a The tally — unblocked

**Replaces `.progress-bar-wrap` / `.progress-bar-fill` entirely.** Delete both.
The app is named Brambletally and its progress indicator was a 5px hairline
bar; this is the brand's own metaphor finally doing the job it is named for.

**Geometry.** One coordinate system, scaled by the rendered height.

- Marks sit in a 24-unit-tall box, running y 4 → 20.
- Within a group of five: four uprights at x = 0, 7, 14, 21.
- The fifth mark is the diagonal, (−2, 20.5) → (23, 3.5).
- Group pitch 40 units — 26 of marks, 14 of gap.
- Total width = `groups × 40 − 14`.
- `stroke-width` 2.2, `stroke-linecap: round`.

**Sizes.** Hero: height 32 (≈1.33×). Compact row: height 20 (≈0.83×). The
stroke scales with the SVG — the tally is artwork, not chrome, so it must not
carry a fixed pixel stroke the way the `icon()` set does.

**Colour.**

- inked — `var(--accent-2)`
- ghost — `color-mix(in srgb, var(--border-strong) 70%, var(--card))`. Derived,
  so it needs no new per-theme value.
- when every mark is inked the numeric label goes `--accent-2` too.

**Hand-cut jitter.** Each upright deviates from true vertical by a fixed
offset, cycling `[+0.5, −0.4, +0.6, −0.3, +0.2]` by mark index. **Deterministic,
keyed to the index — never random per render.** A re-render has to produce an
identical drawing, or the tally shimmers every time state changes.

**What it counts.** Leaf steps only, matching the existing calculation at
`app.js:4307` — a container step's state is derived from its children, so
counting containers double-counts. Same rule as the bar it replaces.

**Edge cases.**

| case | behaviour |
| --- | --- |
| 0 steps | no tally at all — same rule as the current bar (`app.js:3798` omits it when `total` is 0) |
| 1–4 steps | a partial group, no diagonal |
| all done | every mark inked; label in `--accent-2` |
| > 20 steps | cap the drawing at 4 groups / 20 marks, scaled proportionally; the numeric label carries the exact count |

The >20 cap is a real decision, not a shortcut: past twenty nobody reads a
tally as a count, and the alternatives — wrapping to a second line, or
horizontal scroll — are both worse in a 560px column.

**The cut.** Checking a step off draws the newly inked mark in —
`stroke-dasharray` + `stroke-dashoffset`, ~250ms ease-out. Closing a group (the
diagonal) may run a touch longer, ~320ms. Under
`prefers-reduced-motion: reduce` the mark appears instantly.

This is the app's only celebration, and the only new motion Pass 3 permits
besides the candle flame (see Not in scope).

**Reconciles with 3a-3.** That section routes `.progress-bar-fill`'s background
to `var(--tab-color)`. Once the tally lands the bar is gone, so that line is
moot — the tally is `--accent-2`, not the status hue. The status hue keeps the
pill bead, the tabs and `.detail-strip`. Do 3a first anyway; it is one line to
drop later.

#### 3b-5b Hero and rows — unblocked

Today every project renders as an identical card, so the home screen is a wall
of equal-weight rectangles with nothing to look at first. Two tiers.

**The hero — "In hand".** One project, under a mono rubric `IN HAND`.

*Selection:* the most recently updated project with status `Active` and
`archived_at IS NULL`, by `projects.updated_at`. No Active project means no
hero — the list simply starts at its first status rubric.

*Anatomy, top to bottom:*

- an 84px cover band in the project's cover hue (3b-5c), carrying the emblem
  tile, the category in mono 10px, and `due … · ~Nh left` in mono 12px — both
  labels in `--on-accent`
- title, EB Garamond 600 at `--fs-2xl`
- the tally at hero size, plus `N/M notched` in mono
- the pickup note in EB Garamond italic, 17px. It is `.card-footer` today —
  plain, truncated, easy to miss. On the hero it shows in full; it is the most
  useful sentence on the screen
- the next open leaf step in an inset row with a real checkbox and a
  `Focus 25m` button, so the obvious next action is one tap from the home
  screen instead of two screens deep

**The rest — compact rows.** Everything else, grouped by status under mono
rubrics with counts.

- 42px emblem tile · title in EB Garamond 600 at `--fs-lg` · the tally at row
  size · one mono meta line
- a 4px left edge in the cover hue
- `min-height: 64px` — the row is the tap target, so it clears the 44px floor
  comfortably

**Waiting For is drawn differently.** Dashed border, muted title, and the
waiting reason in italic **instead of** a tally. It is the one status where how
long a thing has been stuck matters more than how far along it is.

**Small cases.**

- 0 projects — the empty state from 3b-2, no rubrics at all.
- 1 project — hero only, no "also active" rubric.
- The hero must not also appear in the rows below it.

#### 3b-5c Covers and emblems — blocked

Two blockers: a schema change, and the icon commission (`icon-spec.md`,
batches 2–3). Everything else in 3b-5 ships without this.

**Schema.** Two nullable columns:

```sql
ALTER TABLE projects ADD COLUMN cover_hue    TEXT;  -- slot name, never a hex
ALTER TABLE projects ADD COLUMN cover_emblem TEXT;  -- an EMBLEMS key
```

Store the **slot name**, not a colour. Covers then re-theme automatically when
the palette changes — the same discipline as the status tokens in 3a. Both
nullable; every existing row is null after the migration and falls back to
`--accent-2` with no emblem, which must look deliberate rather than broken.

**Four cover slots.** Contrast-checked 2026-09-12 — all 32 pairings pass.

| slot | bramble-light | bramble-dark | hearth-light | hearth-dark | fen-light | fen-dark | damson-light | damson-dark |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `elderberry` | `#6b3457` | `#c17ba3` | `#a8482b` | `#d97a55` | `#2f6b6b` | `#5cb0ab` | `#6a3d8f` | `#b98ede` |
| `leaf` | `#4b6b3a` | `#8fb073` | `#5c6b30` | `#a3b473` | `#54763a` | `#8bab63` | `#4d6b4a` | `#93b584` |
| `ochre` | `#7d5d17` | `#d8b768` | `#8a5f14` | `#dcb35f` | `#726326` | `#c3b06a` | `#705b18` | `#d4b46c` |
| `bark` | `#7a4a2c` | `#c9906a` | `#6d4a30` | `#c49472` | `#5d5340` | `#b0a183` | `#6b4a40` | `#c2907e` |

`elderberry` is each theme's `--accent` and `leaf` its `--accent-2` (Hearth has
no green, so it borrows its `--status-done` olive from 3a-2). Only `ochre` and
`bark` are new values.

**`ochre` is deliberately not an alias of `--gold`.** White on `--gold` lands at
3.89–4.25:1 in the three light themes — the same reason Contrast notes calls
gold a graphic token and not a text colour. The cover slot is darkened enough
to work as a band ground with a label on it.

*Constructions checked:*

- band label — `--on-accent` on the cover hue, needs ≥4.5:1 → **5.21–9.32**
- emblem stroke — the hue on a 14% tint of itself over `--card`, graphic,
  needs ≥3:1 → **3.93–6.87**

**This answers the old dead-class question.** `.cover-swatch` (`app.css:450`)
and `.detail-cover` are styled and rendered by nothing — ghosts of noodlr's
covers. They get rendered again, in this form, rather than deleted.

**Picker.** Hue and emblem are chosen in the project create/edit form. 26
emblems is small enough for a plain grid — no search, no categories.

**Free/Supporter split (decided 2026-09-12).** All 4 cover hues are free —
only 4 exist, splitting them isn't a real tier. Emblems split 16/10:

- **Free (16)** — all 14 Workshop & hearth emblems (needle-and-thread, shears,
  spindle, loom, hammer, paint-brush, open-book, scroll, inkwell-and-quill,
  map, cauldron, broom, basket, chest) plus two plain hedgerow motifs
  (bramble-sprig, oak-leaf). Every seeded category keeps at least one free
  emblem — Event prep is the thinnest (cauldron only, same as Admin already
  is in `icon-spec.md`).
- **Supporter (10)** — the heraldic and mythical set: mushroom, hedgehog,
  hare, raven, dragon, griffin, unicorn, phoenix, shield, banner. These are
  the "fun, not necessary" picks — flourish rather than function, so they're
  the natural Supporter set. Update `icon-spec.md`'s emblem table with an
  Free/Supporter column when the batch-2/3 icons land.

### Not in scope

- **Motion** — leave the .15–.25s transitions alone. Nothing springy. The one
  new motion in this pass is the candle flame, and it is opt-out.
- **A brand mark** — still later work, still the user's to design. Pass 3 does
  not attempt another one.
- **Vellum / Raven / Damson selection — built 2026-09-12**, ahead of the rest
  of this pass. Token CSS, `PALETTES`, and the Appearance picker's gated-swatch
  UI all shipped together; see Themes above.

### Open decisions for Pass 3

- **Pill label goes neutral** (3a-1) — the hue moves to a dot. This is the one
  judgement call in 3a; everything else is mechanical. If a coloured label is
  wanted instead, the alternative is two tokens per status (a text-safe ink
  and a graphic fill), which doubles the table and re-opens the contrast work.
- **Candle replaces the ring** (3b-1) rather than sitting beside it.
- **Someday and Paused stay neutral** (3a-2) — five statuses is more hue than
  this palette wants. If they need more separation later, the fix is weight or
  a dotted vs solid bead, not chroma.

Settled 2026-09-12 when the card direction was chosen — listed here because
each is a place a later session might reasonably re-decide:

- **Enriched cards, not the ledger** (3b-5). The ledger direction was the more
  distinctive of the two and it lost on touch targets and density in a 560px
  column. Not worth re-running.
- **The tally caps at 20 marks** (3b-5a). Above that it is an impression and
  the numeral is the truth.
- **Cover hue is stored as a slot name, not a hex** (3b-5c) — so covers
  re-theme with the palette, same discipline as the status tokens.
- **`ochre` is not `--gold`** (3b-5c). Gold fails AA as a band ground with a
  label on it in three of the four light themes (3.89–4.25:1). Damson's gold
  happens to clear it at 4.66, but its `ochre` stays darkened anyway so the
  slot means the same thing in every theme.
- **The hero is the most recently updated Active project** (3b-5b) — not the
  nearest deadline. Deadline order is what the Review screen is for; the home
  screen should open on what you last had your hands on.

Settled 2026-09-12 with the fourth palette:

- **Renamed from Heather to Damson** the same day — Heather was a working
  name and turned out to belong to a real person (the user's best friend);
  paywalled or not, that's not a name to build a product feature around.
- **Damson is Supporter-gated** (revised same day — see Themes above). The
  person it was designed for is comped via manual grant, not a free theme.
- **Damson is violet + rose on a cool ground**, deliberately not a second
  plum-on-oat. Bramble keeps its green secondary.
- **`--text-muted` on `--elevated` is fixed at the call sites**, by moving six
  rules to `--text-sub` — not by re-tuning the shipping palettes'
  `--text-muted`, which would ripple through ~40 other rules for no gain.

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
Mark dropped (two hedgehog attempts rejected) — wordmark-only for now. Favicon is a placeholder berry. `icon()` helper + a 13-icon line set;
every emoji and symbol glyph swapped. IM Fell wordmark + gold dot.
Still to add: PNG favicon fallbacks; more icons as later features need them.

**Pass 3 — polish (spec'd 2026-09-09).** No longer optional; the colour half
of it is a correctness fix, not decoration. Two PRs — full spec in the Pass 3
section above.

- **3a — colour + housekeeping.** **3a-1/2/3/4 built 2026-09-12**: status
  colours are per-theme `--status-*` tokens (extended to Vellum/Raven, added
  2026-09-12 after this section was first written), the pill label is neutral
  with a coloured dot, `STATUS_COLOR`/`CAT_COLOR` are deleted, the alpha-hex
  `--tab-color` sites are cleared, category tabs take `--accent-2`; the
  remaining hardcoded reds/ambers onto `--danger`/`--warn-text`, the blue-grey
  shadow tint became a per-theme `color-mix()` of `--text`, and the real
  `--text-muted`-on-`--elevated` AA failure is fixed at 6 sites. One deliberate
  exception: two `#f1f5f9` sites in dead noodlr-era cover-photo buttons were
  left as literal hex rather than applying the doc's original (wrong for that
  context) `--elevated` mapping — see 3a-4 above. **Still open — 3a-5/6**: the
  housekeeping deferred twice (fold the `#bt-app` override layer back in,
  adopt the `--fs-*` tokens rule-by-rule, add `tnum`, add radius tokens); two
  stale-copy bugs (auth screen, landing footer).
- **3b — the drawn things.** The focus-screen candle (replaces the ring),
  empty-state illustrations, paper texture ported from the landing page,
  flourish dividers, and **the card** — the tally replacing the progress bar,
  the hero/compact hierarchy, and covers + emblems (3b-5, direction chosen
  2026-09-12). The tally and the hierarchy need neither a schema change nor the
  icon commission, so they can land ahead of the rest of 3b.

## Open decisions

None blocking. Resolved 2026-09-07:

- Themes: **Bramble** (default), **Hearth**, **Fen** — light + dark each.
- Body font: **Alegreya Sans**.
- Mark: **none for now** — hedgehog attempts dropped; wordmark-only.
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

Resolved 2026-09-09 (Pass 3 spec):

- **Status colours become per-theme tokens** — `--status-*` ×5 per theme, 30
  values, all contrast-checked. Mostly aliases of `--accent` / `--gold` /
  `--accent-2`, so statuses stop being a second palette.
- **The status pill goes neutral-label + coloured dot.** The old construction
  (hue as text on a 16% tint of itself) structurally caps contrast below AA
  regardless of hue.
- **The focus screen gets the candle**, replacing the progress ring.

Open for Pass 3 — the three judgement calls, all listed under "Open decisions
for Pass 3": the neutral pill label, candle-replaces-ring, and Someday/Paused
staying neutral rather than taking hues of their own.

Still to design later: a brand mark (hedgehog attempts dropped). The
empty-state illustrations moved from "optional" into Pass 3b.
