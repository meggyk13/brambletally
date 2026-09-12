// Brambletally — UI icons, Batch 1 (14).
// Drawn 2026-09-12 against docs/icon-spec.md. Paste these entries into the
// ICONS object in public/app.js. Inner markup only — the icon() wrapper
// supplies viewBox, fill:none, stroke:currentColor, stroke-width 1.75 and
// round caps/joins. No fills used; no ids, classes or colours; all geometry
// inside x/y 1.5–22.5.

const ICONS_BATCH_1 = {
  // — controls ————————————————————————————————————————————————
  more: '<circle cx="5.5" cy="12" r=".75"/><circle cx="12" cy="12" r=".75"/><circle cx="18.5" cy="12" r=".75"/>',

  grip: '<circle cx="9" cy="6.5" r=".75"/><circle cx="15" cy="6.5" r=".75"/><circle cx="9" cy="12" r=".75"/><circle cx="15" cy="12" r=".75"/><circle cx="9" cy="17.5" r=".75"/><circle cx="15" cy="17.5" r=".75"/>',

  play: '<path d="M7.5 5.2 19 12 7.5 18.8Z"/>',

  pause: '<path d="M9.5 5.5v13M14.5 5.5v13"/>',

  // — the two Pass 3 depends on ——————————————————————————————
  // Five-bar gate. The uprights sit a hair off true vertical on purpose —
  // the same hand-cut jitter the rendered tally uses (design.md 3b-5a).
  // Widened 2026-09-12 (spacing ~5.5 units vs the original ~4.5) after the
  // true-16px raster test showed the four uprights merging into a blob.
  // Still dense at 16px by nature of five strokes in one glyph — fine from
  // the default 20px up. This static icon is a generic tally/progress mark,
  // not the actual per-project widget (that's bespoke code, design.md 3b-5a).
  tally: '<path d="M3.2 4.7 2.9 19.5"/><path d="M9.7 4.4 10.1 19.6"/><path d="M14.6 4.8 14.3 19.3"/><path d="M20.1 4.5 19.8 19.6"/><path d="M2.3 19.8 21 4.3"/>',

  // Pairs with `candle` — identical body and base, flame replaced by a wick
  // and a rising curl of smoke. Same baseline, same visual weight.
  smoke: '<rect x="8.5" y="8" width="7" height="12" rx="1"/><path d="M6 20h12"/><path d="M12 8V6.6"/><path d="M11.9 6.6c2.6-1.2-.4-2.8 2.2-3.8"/>',

  // — content markers ——————————————————————————————————————
  tag: '<path d="M19.5 4.5h-6.2l-8.8 8.8 6.2 6.2 8.8-8.8z"/><circle cx="16.3" cy="7.7" r="1.2"/>',

  // Wide and shallow with a horizontal weave band, so it cannot be confused
  // with `trash` — which is narrow, tapered, and ribbed vertically.
  basket: '<path d="M3.5 10h17l-1.4 7.8a2 2 0 0 1-2 1.7H6.9a2 2 0 0 1-2-1.7z"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M4.6 14h14.8"/>',

  // 2026-09-12: dropped a stroke that retraced the silhouette's own right
  // edge almost exactly — it was doubling the ink right on that boundary,
  // which is what merged into a blob at 16px. The nib line is enough.
  quill: '<path d="M7.8 16.4c-.6-4.6 2.6-9 8-11.4 1.8 5-.4 9.6-5.2 11.6z"/><path d="M4 20.2 8.6 15.6"/>',

  calendar: '<rect x="3.5" y="5.5" width="17" height="14.5" rx="1.5"/><path d="M3.5 10.2h17"/><path d="M8 3.5v4M16 3.5v4"/>',

  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.4 2.4"/>',

  hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11"/><path d="M8 3.5c0 5 4 5.5 4 8.5s-4 3.5-4 8.5"/><path d="M16 3.5c0 5-4 5.5-4 8.5s4 3.5 4 8.5"/>',

  // — states ——————————————————————————————————————————————
  trash: '<path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.9"/><path d="M6.5 6.5l1 12.4a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l1-12.4"/><path d="M10.3 10.5v6M13.7 10.5v6"/>',

  warning: '<path d="M12 4.3 21 19.6H3z"/><path d="M12 10v4"/><path d="M12 17.2h.01"/>',
};
