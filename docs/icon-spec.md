# Brambletally — icon & emblem spec

A brief for an outside illustrator or generative model. Everything needed to
draw glyphs that drop straight into the codebase with no edits.

Companion to `design.md` (see "Icon set", "Pass 3"). Written 2026-09-09.

---

## 1. What Brambletally is

A project tracker for makers — sewing and costuming, research, event prep,
household work, admin. It grew out of SCA (medieval re-enactment) use and keeps
a hedgerow / folk-medieval look by choice.

**Aesthetic:** woodcut and linocut, botanical marginalia, iron-gall ink on
parchment, guild inventory rolls. Muted and earthy. Never bright, never
"SaaS dashboard".

That aesthetic is the whole point of this commission. A generic Material or
Feather-style set is a fail even if it is technically clean.

---

## 2. Two families, different rules

Do not treat these as one set. They have different jobs and different weights.

| | **UI icons** | **Project emblems** |
| --- | --- | --- |
| job | functional chrome — buttons, nav, list rows | decorative; the user picks one per project |
| viewBox | `0 0 24 24` | `0 0 24 24` |
| stroke-width | **1.75** | **1.4** |
| rendered at | 15–24px (default 20px) | 28–44px (never below 28) |
| detail budget | 3–6 strokes; must survive 16px | 6–14 strokes; may be genuinely ornamental |
| stored in | `ICONS` object | `EMBLEMS` object |

The thinner stroke and larger render size on emblems is what makes a griffin
possible. **A griffin at 1.75 stroke rendered at 20px is an unreadable blob** —
do not attempt it, and do not "simplify" a beast into a UI icon.

Names may repeat across the two objects (`candle` exists in both, drawn at
different weights). They are separate namespaces.

---

## 3. Hard technical contract

Icons are stored as **inner SVG markup fragments only** — no wrapper. The app
supplies the wrapper:

```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <!-- YOUR MARKUP GOES HERE -->
</svg>
```

So every glyph inherits `fill:none`, `stroke:currentColor`, the stroke width,
and round caps and joins. **Do not restate them.**

**Required:**

- `viewBox` is `0 0 24 24`. Keep all artwork inside **x/y 1.5 → 22.5**
  (a 1.5-unit margin). Stroke centre-lines only — a stroke on the boundary
  bleeds out of the box.
- Only these elements: `<path> <circle> <ellipse> <rect> <line> <polyline>
  <polygon> <g>`.
- Decimals to **at most two places** (`3.25` fine, `3.2487` not). Coordinates
  need not snap to a grid — the existing set uses `6.5`, `3.2`, `2.3` freely.
- Every glyph must be a **single flat run of sibling elements**. Grouping with
  `<g>` is allowed only when it carries a `transform`.

**Forbidden — these break the build or collide across icons:**

- No `<svg>` wrapper, no `<defs>`, no `<style>`, no `<text>`.
- **No `id` or `class` attributes anywhere.** Many icons render on one page;
  ids collide.
- No `fill`, `stroke`, `stroke-width`, `stroke-linecap` or `stroke-linejoin`
  on your elements — with the one exception below.
- No gradients, masks, filters, clip-paths, patterns, or `opacity`.
- No hardcoded colours. Ever. The glyph must be one colour and inherit it.
- No `transform` on a top-level element unless it is inside a `<g>`.

**The one exception — deliberate solid fills.** A small solid shape (a flame, a
berry, an eye, a seal) may be filled, and must then kill its own stroke:

```html
<path d="M12 3c1.6 1.2 1.6 3 0 4-1.6-1-1.6-2.8 0-4z" fill="currentColor" stroke="none"/>
```

Use sparingly — at most one or two filled shapes per glyph. The set is a
**line** set; fills are accents, not the technique.

**The dot trick.** A zero-length path with a round cap renders as a dot:
`<path d="M4.5 12h.01"/>`. Useful for eyes, berries, bullet marks.

---

## 4. Style anchors — copy these conventions exactly

These four are shipping today. Match their density, their terminal treatment,
and their level of abstraction.

```
search:   <circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>

steps:    <path d="M4 6h16"/><path d="M9 12h11M9 18h11"/><path d="M4.5 12h.01M4.5 18h.01"/>

leaf:     <path d="M12 20V9"/><path d="M12 9c-3 0-5-1.6-5.5-4.5C9.4 4 12 5.6 12 9zM12 12c3 0 5-1.6 5.5-4.5C14.6 7 12 8.6 12 12z"/>

candle:   <path d="M12 3c1.6 1.2 1.6 3 0 4-1.6-1-1.6-2.8 0-4z" fill="currentColor" stroke="none"/><rect x="8.5" y="8" width="7" height="12" rx="1"/><path d="M6 20h12"/>
```

`leaf` is the closest thing to a house style: a clear silhouette plus a couple
of interior strokes that read as carved detail — not more. `candle` shows the
solid-fill exception.

### What makes it woodcut rather than generic

- **Uniform stroke, no tapering.** The weight is constant; character comes from
  the drawing, not from modulated line.
- **Silhouette first, then a few interior strokes.** Not pure outline, not
  hatched shading. Two to four interior marks that suggest carving.
- **Front-on or strict profile.** Never three-quarter perspective, never
  isometric. This is the single biggest thing that keeps a set coherent.
- **Beasts take heraldic attitudes** — passant (walking), rampant (rearing),
  sejant (seated), displayed (wings spread), couchant (lying). Draw them the
  way a beast appears on a shield, not the way it appears in a nature guide.
  This is the instruction that will make the mythical set hang together.
- **A little hand-cut irregularity is welcome.** A stroke that isn't perfectly
  vertical, a curve that isn't a perfect arc. It must read as carved, never as
  careless — asymmetry yes, wobble no.
- **No "friendly" rounded-blob style, no perfectly geometric grid style.**

**Originality:** draw these fresh. Match the *conventions* of a 24px line set,
but do not trace or reproduce Lucide, Feather, Font Awesome, the Noun Project,
or any existing commercial set. Original artwork only.

---

## 5. Already drawn — do not redo

18 UI icons exist. Leave them alone; match them.

`search` `people` `steps` `candle` `leaf` `check` `close` `back` `plus` `sun`
`moon` `chevron` `link` `settings` `globe` `at` `edit` `bell`

---

## 6. What to draw — UI icons (14)

Cut down 2026-09-12 from a 38-icon wishlist. Every one below either replaces a
text glyph the app renders today, or is required by a Pass 3 feature. Anything
that currently works as a plain text button (Print, Duplicate, Edit) was cut —
a word reads better than a guessable glyph.

| name | subject | why it earns a slot |
| --- | --- | --- |
| `tally` | five-bar gate — four uprights, one diagonal | **the key one.** Becomes the progress mark app-wide (`design.md` Pass 3) |
| `smoke` | snuffed wick with one curl of smoke | the paused state of a focus session; must pair with `candle` on the same baseline and weight |
| `more` | three dots in a row | the card overflow menu, currently a text glyph |
| `grip` | two columns of three dots | drag handle for reordering steps |
| `play` | right-facing triangle | start a focus session |
| `pause` | two vertical bars | pause a focus session |
| `tag` | luggage-style label tag with a hole | project categories |
| `basket` | woven basket, handle up | supplies list |
| `quill` | quill pen, nib down | journal entry |
| `calendar` | leaf-page calendar or ruled tablet | deadlines |
| `clock` | face with two hands | time estimates |
| `hourglass` | waisted glass with sand | the "Waiting For" status |
| `trash` | lidded bin or crock | delete |
| `warning` | triangle with a bar and dot | the `.warn-box` component |

### Deferred, with the reason

- **Nav icons** (`projects` `next` `inbox` `review` `board`) — the nav is text
  today and reads fine. Revisit only if the nav gets tight on a phone.
- **`photo`** — project photos do not exist yet (a Supporter-tier candidate in
  `social-plan.md`). Commission it when the feature lands.
- **`print` `download` `duplicate` `comment`** — all have working text
  affordances.
- **`seal`** (project-complete stamp) — depends on the completion-celebration
  idea, which is not spec'd yet.
- **`sprig`** (section divider) — already drawn. Lift `.vine` from
  `src/pages/index.astro` rather than commissioning it again.
- **`eye` `eye-off` `key` `star` `lock` `info` `undo` `external` `filter`
  `sort` `stop` `archive`** — real eventual needs, none blocking.

---

## 7. What to draw — project emblems (26)

The user picks one per project. Stroke **1.4**, rendered 28–44px, ornament
welcome. Cut from 106; this is the smallest library that still covers all five
seeded categories and leaves something to enjoy picking.

**Workshop & hearth (14)**

needle-and-thread · shears · spindle · loom · hammer · paint-brush ·
open-book · scroll · inkwell-and-quill · map · cauldron · broom · basket ·
chest

**Hedgerow, beasts & heraldry (12)**

bramble-sprig · oak-leaf · mushroom · hedgehog · hare · raven · dragon ·
griffin · unicorn · phoenix · shield · banner

`basket` is drawn twice — once as a UI icon at 1.75, once here at 1.4 with more
detail. The objects are separate namespaces.

### Coverage against the seeded categories

| category | emblems |
| --- | --- |
| Making | needle-and-thread, shears, spindle, loom, hammer, paint-brush |
| Research | open-book, scroll, inkwell-and-quill, map |
| Event prep | shield, banner, cauldron |
| Household | broom, basket, chest, cauldron |
| Admin | open-book, scroll |

Admin is the thin one. It is also the category least likely to want a
decorative emblem, so that is probably fine.

The library is **additive** — a later batch costs nothing but the drawing, and
nothing in the schema or the picker changes. Cut further before expanding.

---

### Scope at a glance

| batch | count |
| --- | --- |
| 1 — UI icons | **14** |
| 2 — emblems, workshop & hearth | **14** |
| 3 — emblems, hedgerow, beasts & heraldry | **12** |
| | **40 total** |

Scoped 2026-09-12, down from a first draft of 144. Three sittings, and only
Batch 1 blocks shipping features.

If it still has to shrink: `hourglass`, `clock` and `calendar` are the softest
UI slots (each has a working text label today), and Batch 3 can drop to the six
beasts alone. Do not cut `tally` or `smoke` — they are the two glyphs Pass 3
actually depends on.

---

## 8. Delivery format

One JavaScript file, two objects, keys in the order given above:

```js
const ICONS = {
  tag: '<path d="…"/><circle cx="…" cy="…" r="…"/>',
  basket: '<path d="…"/>',
  // …
};

const EMBLEMS = {
  'needle-and-thread': '<path d="…"/>',
  // …
};
```

- Keys are **lowercase kebab-case**, quoted only when they contain a hyphen.
- Values are **single-line strings** — no newlines inside a value.
- Use single quotes for the string, double quotes inside the markup (as above).
  If a `d` attribute must contain an apostrophe, it should not — rewrite it.

---

## 9. Acceptance checks

Run these before delivering. Each one has caught a real problem.

1. **Paste-in test.** Drop the value inside the wrapper from section 3. It must
   render with no other changes.
2. **The 16px test** (UI icons) / **the 28px test** (emblems). Render at that
   size on a `#fbf6ea` cream ground. If any two strokes merge into a blob, it
   fails — simplify or drop it.
3. **The dark test.** Render in `#ece3d6` on `#292330`. Nothing should
   disappear or fill in. (If you obeyed `currentColor` this is automatic; this
   check catches hardcoded colours you forgot.)
4. **The colour grep.** Search your output for `#`, `rgb`, `fill="` and
   `stroke="`. The only legal hits are the `fill="currentColor" stroke="none"`
   pair on a deliberate solid fill.
5. **The id grep.** Search for `id=` and `class=`. Must be zero hits.
6. **The bounds check.** No coordinate below 1.5 or above 22.5.
7. **The sheet test.** Render the whole set on one page at 24px. Anything that
   is noticeably heavier, lighter, or busier than its neighbours gets redrawn.
   This is the check that makes it a *set* rather than a pile.

---

## 10. Two notes for whoever wires it up

- The wrapper carries `aria-hidden="true"` — icons are decorative. Any icon
  used **without an adjacent text label** needs an `aria-label` at the call
  site.
- Emblems need their own helper, since the stroke differs:

  ```js
  function emblem(name, size = 32) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true">${EMBLEMS[name] || ''}</svg>`;
  }
  ```
