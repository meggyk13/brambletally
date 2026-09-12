# Open questions — handoff

Written 2026-09-12 at the end of a design session, so a strategy conversation
can start warm instead of re-deriving everything.

**Read first:** `design.md` → Pass 3 (the whole current design plan),
`plan.md` → Audience, `social-plan.md` → Supporter tier.

---

## Settled this session — do not re-decide

| decision | where it lives |
| --- | --- |
| **Enriched cards**, not the ledger, for the home screen | `design.md` 3b-5 |
| The **tally** replaces the progress bar; geometry, states, edge cases spec'd | `design.md` 3b-5a |
| **Hero + compact rows** hierarchy; hero = most recently updated Active project | `design.md` 3b-5b |
| **Covers + emblems**: two nullable columns storing a *slot name*, never a hex | `design.md` 3b-5c |
| A **fourth palette**, purple-dominant, **free not gated**; all 43 pairings pass AA | `design.md` → Values |
| Icon commission cut to **40 glyphs**, handed to Gemini | `icon-spec.md`, `gemini-icon-prompt.md` |
| Cosmetic things **may** be gated behind Supporter (reverses the earlier stance) | `social-plan.md` Supporter tier |
| **Supporter rationale rewritten**: function free, capacity + extra character paid | `social-plan.md` Supporter tier (Q1, resolved 2026-09-12) |
| **Themes: 3 standard (Bramble/Hearth/Fen), 3 Supporter** (Damson, Vellum, Raven) | `design.md` Themes (Q3, resolved 2026-09-12) |
| **Raven (was Nightshade) ships a compromised light variant** — no mode-locked themes built | `design.md` Themes (Q3, resolved 2026-09-12) |
| **Vellum revised to cool corporate stationery** (navy/pewter/brass, no red) — the ink-on-vellum concept was too close to Raven | `design.md` Themes (Q3, resolved 2026-09-12) |
| **Vellum + Raven ran through a 192-pairing WCAG script audit**; two real fails in Raven's dark accent/danger, fixed | `design.md` Themes, Contrast (2026-09-12) |
| **`--border-strong` is decorative**, confirmed — matches what `design.md` and the shipped CSS already said | `design.md` Contrast (Q7, resolved 2026-09-12) |
| **Damson (purple 4th theme) is Supporter-gated**; the person it was built for is comped via manual grant | `design.md` Themes (Q3, resolved 2026-09-12) |
| **Emblems split 16 free / 10 Supporter**; all 4 cover hues stay free | `design.md` 3b-5c, `social-plan.md` (Q2, resolved 2026-09-12) |
| **Accent picker stays a curated swap list**, never a free-form wheel — list itself still undecided | `design.md` Themes (Q4, partly resolved 2026-09-12) |

Two findings worth carrying forward:

- **A real AA failure exists in shipping code.** `--text-muted` on `--elevated`
  is 3.96–4.38:1 across all six shipping theme-modes; six rules pair them. Fix
  (move those rules to `--text-sub`) is folded into `design.md` 3a-4.
- **Pass 3a is invisible to the user.** It is correctness and housekeeping. It
  does not address "the app looks plain" — 3b does. Do not expect 3a to feel
  like progress.

## Build state

**Unblocked, could start today:** the tally, the hero/compact hierarchy, all of
Pass 3a.

**Blocked:** covers and emblems need a schema migration *and* Gemini's icon
batches 2–3. The candle (3b-1) is unblocked but undrawn.

---

## Q1 — Rewrite the Supporter rationale — RESOLVED 2026-09-12

New principle: **function is free and unlimited; capacity and extra character
are what Supporter buys.** Written into `social-plan.md` Supporter tier.

## Q2 — What exactly goes behind the wall — RESOLVED 2026-09-12

Cover hues (only 4 — not worth splitting) stay fully free. Emblems split
16 free / 10 Supporter: all 14 Workshop & hearth tool emblems plus
bramble-sprig and oak-leaf are free; the 10 heraldic/mythical emblems
(dragon, griffin, unicorn, phoenix, shield, banner, raven, hedgehog, hare,
mushroom) are Supporter. Every seeded category keeps at least one free
emblem. Full split in `design.md` 3b-5c and `social-plan.md`.

## Q3 — The second premium theme, and mode-locked themes — RESOLVED 2026-09-12

**Three standard, three Supporter.** Bramble/Hearth/Fen free; Damson (the
purple 4th theme — see Q5, now resolved), Vellum, and Raven are Supporter.
The purple theme was briefly named Heather and briefly free for the specific
person who requested it; both are reversed — renamed to Damson (that name
belongs to a real person), and that person is comped to Supporter via manual
grant instead, so the theme stays gated for everyone else. The third
Supporter theme was Nightshade — also purple, too close to Damson — and got
renamed to **Raven** the same day, moved off purple entirely to obsidian +
oxblood, still goth/villain-coded but via blood and corvid menace instead of
poison. Raven ships a **compromised light variant** rather than triggering
mode-locked-theme UI work. Vellum's own original concept (ink-on-vellum,
monochrome, one rubric red) turned out to be the same problem in reverse —
too close to the new Raven, both reading as "black plus one red accent" —
so it moved to **cool corporate stationery**: grey paper stock, navy ink,
pewter, brass, no red. Written into `design.md` Themes.

## Q4 — The custom accent picker — PARTLY RESOLVED 2026-09-12

Confirmed: never a free-form wheel (voids the AA guarantees in `design.md`).
A dozen curated, pre-checked accent swaps is the shape. **Still open:** the
actual swap list — which dozen colours, and whether they're theme-specific or
shared across all six themes.

## Q5 — The purple theme's name — RESOLVED 2026-09-12

**Damson.** The working name *Heather* was retired the same session — it
belongs to a real person (the user's best friend), which the ranked
candidates had already flagged as the reason to avoid it. Written into
`design.md` Themes and its palette values section.

Also decided: **Vellum** (was Scriptorium) as the second Supporter theme
name.

## Q6 — Cost ceiling on themes

Each theme is ~29 tokens × 2 modes = **58 contrast-checked values**, and every
future component must be checked against all of them. Four free + one premium
is 290 values. The real argument for restraint is the permanent maintenance
surface, not the drawing.

If a fifth free theme is ever wanted, the only real gap on the hue ring is
**green, around 90°** (current accents sit at 14°, 180°, 273°, 322°).

## Q7 — Does `--border-strong` need to clear 3:1? — RESOLVED 2026-09-12

**Decorative, confirmed.** This was misframed as open — `design.md` Contrast
notes already said so, in a sentence written before this session
("`--border-strong` is decorative... Form-field affordance comes from
`--input` differing from `--card` plus a `:focus-visible` 2px `--accent`
outline... That focus ring is a Pass 1 requirement — it is the WCAG 1.4.11
compliance path, not the resting border"). Missed it when raising the
question; should have cross-checked the existing doc before flagging it as
open.

Confirmed independently two ways:

- **The shipped code already says so.** `public/app.css:1552`:
  `/* Focus-visible — accent ring; also the affordance for form fields
  (border-strong is decorative) */`, right above the actual
  `:focus-visible { outline: 2px solid var(--accent) }` rule.
- **Every call site is a resting-state border**, never the sole indicator of
  an interactive or selected state: form fields, modals, dropdown popups,
  chips, the unchecked checkbox ring. `--accent` (focus ring, ≥3:1 checked
  in the 2026-09-12 audit) or a background/colour change (`.is-sel`,
  `.is-followed`, `.is-soon`) carries the state that actually needs 1.4.11
  contrast; `--border-strong` never carries it alone.

No token or code change needed. Nothing to retune across the four
already-shipped palettes.
