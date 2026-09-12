# Gemini prompt — Brambletally icon commission

**How to use:** everything below the rule is the prompt. Paste it into Gemini in
one go. It will draw Batch 1 and stop; reply `next` to get each following batch.
The full internal reference is `icon-spec.md` — this file is the handoff copy.

---

You are an icon designer and SVG engineer. I need you to draw a coherent icon
set for an app called **Brambletally**, and you will deliver it as raw SVG
markup that I paste directly into my codebase.

Read this entire brief before drawing anything.

## The project

Brambletally is a project tracker for makers — sewing and costuming, research,
event prep, household work, admin. It grew out of medieval re-enactment (SCA)
use and keeps a hedgerow / folk-medieval look on purpose.

The visual language is **woodcut and linocut: botanical marginalia, iron-gall
ink on parchment, guild inventory rolls.** Muted, earthy, carved. Never bright,
never "SaaS dashboard".

That aesthetic is the entire point of this commission. A technically clean but
generic Material- or Feather-style set is a failure. So is anything cute,
rounded-blob, or emoji-adjacent.

## How we will work

There are 40 glyphs across three batches. **Draw one batch per response, then
stop and wait for me to say `next`.** Do not attempt more than one batch at a
time and do not skip ahead — quality collapses past about 20 glyphs in a single
response, and consistency within a batch matters more than speed.

At the end of every batch, tell me which glyphs you were least happy with.

## Two families, two different weights

These are not one set. Do not treat them as one.

**UI icons** — functional chrome: buttons, navigation, list rows.
`viewBox="0 0 24 24"`, **stroke-width 1.75**, rendered at 15–24px.
Budget: 3–6 strokes. Must stay legible at 16px.

**Project emblems** — decorative; the user picks one per project.
`viewBox="0 0 24 24"`, **stroke-width 1.4**, rendered at 28–44px.
Budget: 6–14 strokes. Genuine ornament is welcome.

The thinner stroke and larger render size on emblems is what makes detailed
subjects possible. **A griffin drawn at 1.75 stroke and rendered at 20px is an
unreadable blob.** Never draw an emblem to UI-icon rules, and never simplify a
beast down into a UI icon.

The two families are separate namespaces, so a name may appear in both
(`candle` exists in each, drawn at different weights). That is intentional.

## Output contract

My app supplies this wrapper and injects your markup inside it:

```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <!-- YOUR MARKUP GOES HERE -->
</svg>
```

So every glyph inherits `fill:none`, `stroke:currentColor`, the stroke width,
and round caps and joins. **Never restate any of them.**

Deliver each batch as one JavaScript object literal, keys in the order I give
them:

```js
const ICONS = {
  tag: '<path d="M3.5 12.5 12 4h7.5v7.5L11 20z"/><circle cx="16" cy="8" r="1.4"/>',
  basket: '<path d="…"/><path d="…"/>',
};
```

- Keys are lowercase kebab-case, quoted only when they contain a hyphen.
- Each value is a **single-line string** — no newlines inside a value.
- Single quotes around the string, double quotes inside the markup.
- UI batches go in an object called `ICONS`; emblem batches in one called
  `EMBLEMS`.
- Give me the code block and a short list of anything you struggled with.
  No preamble, no per-icon commentary.

## Technical rules

**Required**

- All artwork inside x/y **1.5 → 22.5**. Coordinates are stroke centre-lines, so
  a stroke sitting on the boundary bleeds outside the box.
- Only these elements: `path` `circle` `ellipse` `rect` `line` `polyline`
  `polygon` `g`.
- Decimals to at most two places. Coordinates do **not** need to snap to a grid.
- A flat run of sibling elements. Use `<g>` only when it carries a `transform`.

**Forbidden — these break my build**

- No `<svg>` wrapper, no `<defs>`, no `<style>`, no `<text>`.
- **No `id` and no `class` attributes anywhere.** Many icons render on one page
  and ids collide.
- No `fill`, `stroke`, `stroke-width`, `stroke-linecap` or `stroke-linejoin` on
  your elements — with the single exception below.
- No gradients, masks, filters, clip-paths, patterns, or `opacity`.
- **No hardcoded colours, ever.** One colour per glyph, inherited.

**The one exception — deliberate solid fills.** A small solid shape (a flame, a
berry, an eye, a wax seal) may be filled, and must then kill its own stroke:

```html
<path d="M12 3c1.6 1.2 1.6 3 0 4-1.6-1-1.6-2.8 0-4z" fill="currentColor" stroke="none"/>
```

At most one or two per glyph. This is a **line** set; fills are accents, not the
technique.

**Useful trick:** a zero-length path with a round cap renders as a dot —
`<path d="M4.5 12h.01"/>`. Good for eyes, berries, bullet marks.

## Style rules — what makes it woodcut rather than generic

- **Uniform stroke, no tapering.** Character comes from the drawing, not from
  modulated line weight.
- **Silhouette first, then a few interior strokes.** Not pure outline, not
  hatched shading — two to four interior marks that read as carved detail.
- **Front-on or strict profile only.** Never three-quarter perspective, never
  isometric. This is the single biggest factor in whether a set looks coherent.
- **Beasts take heraldic attitudes** — passant (walking), rampant (rearing),
  sejant (seated), displayed (wings spread), couchant (lying). Draw every
  creature the way it would appear on a shield, not the way it appears in a
  nature guide. This matters more than any other instruction for the mythical
  batch.
- **A little hand-cut irregularity is welcome** — a stroke slightly off
  vertical, a curve that isn't a perfect arc. It must read as carved, never as
  careless. Asymmetry yes, wobble no.
- **Draw original artwork.** Match the conventions of a 24px line set, but do
  not trace or reproduce Lucide, Feather, Font Awesome, the Noun Project or any
  other existing set.

## Style anchors — match these

These four already ship in the app. Match their density, their terminal
treatment, and their level of abstraction.

```
search:  <circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>

steps:   <path d="M4 6h16"/><path d="M9 12h11M9 18h11"/><path d="M4.5 12h.01M4.5 18h.01"/>

leaf:    <path d="M12 20V9"/><path d="M12 9c-3 0-5-1.6-5.5-4.5C9.4 4 12 5.6 12 9zM12 12c3 0 5-1.6 5.5-4.5C14.6 7 12 8.6 12 12z"/>

candle:  <path d="M12 3c1.6 1.2 1.6 3 0 4-1.6-1-1.6-2.8 0-4z" fill="currentColor" stroke="none"/><rect x="8.5" y="8" width="7" height="12" rx="1"/><path d="M6 20h12"/>
```

`leaf` is the closest thing to the house style — a clear silhouette plus a
couple of interior strokes, not more. `candle` shows the solid-fill exception.

**These 18 already exist. Do not redraw them:** search, people, steps, candle,
leaf, check, close, back, plus, sun, moon, chevron, link, settings, globe, at,
edit, bell.

## Check your own work before you answer

Run all seven. Each has caught a real problem.

1. **Paste-in test** — drop each value into the wrapper above; it must render
   with no other changes.
2. **Size test** — UI icons at 16px, emblems at 28px, on a cream `#fbf6ea`
   ground. If any two strokes merge into a blob, simplify or drop it.
3. **Dark test** — light ink `#ece3d6` on dark `#292330`. Nothing should vanish
   or fill in.
4. **Colour grep** — search your output for `#`, `rgb`, `fill="`, `stroke="`.
   The only legal hits are the `fill="currentColor" stroke="none"` pair.
5. **Id grep** — search for `id=` and `class=`. Must be zero hits.
6. **Bounds check** — no coordinate below 1.5 or above 22.5.
7. **Sheet test** — imagine the whole batch rendered together at 24px. Anything
   noticeably heavier, lighter or busier than its neighbours gets redrawn. This
   is what makes it a set rather than a pile.

**If a subject will not read at the required size, say so and propose a simpler
substitute.** Do not ship an illegible glyph. I would rather have twelve beasts
that work than sixteen that don't.

---

# The batches

## Batch 1 — UI icons (14) → `ICONS`

Every one of these replaces a text glyph, a bare word, or a gap in the shipping
app. Stroke 1.75.

`more` — three dots in a row; the card overflow menu
`grip` — two columns of three dots; the drag handle for reordering steps
`tally` — a five-bar gate: four uprights and one diagonal. **The most important
glyph in this batch** — it becomes the progress mark throughout the app
`smoke` — a snuffed wick with a single curl of smoke. Pairs with the existing
`candle` as the paused state of a focus session, so it must sit on the same
baseline and occupy the same visual weight
`play` — right-facing triangle; start a focus session
`pause` — two vertical bars
`tag` — luggage-style label tag with a hole; project categories
`basket` — woven basket, handle up; the supplies list
`quill` — quill pen, nib down; a journal entry
`calendar` — leaf-page calendar or ruled tablet; deadlines
`clock` — face with two hands; time estimates
`hourglass` — waisted glass with sand; the "Waiting For" status
`trash` — lidded bin or crock; delete
`warning` — triangle with a bar and a dot

## Batch 2 — emblems, workshop & hearth (14) → `EMBLEMS`

Stroke **1.4**, rendered 28–44px. Ornament welcome.

needle-and-thread · shears · spindle · loom · hammer · paint-brush ·
open-book · scroll · inkwell-and-quill · map · cauldron · broom · basket ·
chest

Note `basket` appears in both batches — Batch 1's is the UI icon at 1.75, this
one is the emblem at 1.4. Draw it twice, with more detail here.

## Batch 3 — emblems, hedgerow, beasts & heraldry (12) → `EMBLEMS`

Stroke **1.4**. Heraldic attitudes on every creature.

bramble-sprig · oak-leaf · mushroom · hedgehog · hare · raven · dragon ·
griffin · unicorn · phoenix · shield · banner

The five mythical and animal beasts are the hardest glyphs in the commission
and the ones I care most about. Take the time. If one will not read at 28px,
tell me and propose a substitute rather than shipping a blob.

---

Start with **Batch 1** now. Draw it, run the seven checks, give me the `ICONS`
object and your list of weak glyphs, then stop and wait.
