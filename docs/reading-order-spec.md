# Reading Order Specification

This document defines the default reading-order heuristic for Manga CMS
ingestion, synthetic content generation, and CMS review tooling.

It does not change the canonical content schema. The canonical source of truth
remains the human-reviewed `panelNumber` and `bubbleNumber` stored in
`contents/`.

## Scope

Use this specification when code needs to estimate or warn about reading order
from geometry:

- synthetic content generation
- ingestion draft generation
- OCR / PSD / SVG candidate ordering
- CMS review warnings and optional reorder actions

Do not use this heuristic to silently rewrite canonical content. Automated
ordering is a review aid only.

## Default Direction

The current Manga CMS default is Japanese manga reading order:

```text
page: top to bottom tiers
tier: right to left panels
panel: right to left bubble columns, then top to bottom inside each column
```

A future `readingDirection?: "rtl" | "ltr"` content field may make this
explicit per Series, Episode, or Page. Until that contract exists, ingestion and
review helpers should treat RTL as the default and document any LTR-specific
override locally.

## Panel Reading Order

### Tier Formation

Panels are first grouped into horizontal tiers.

For each panel, compute the vertical interval:

```text
top = bbox.y
bottom = bbox.y + bbox.height
height = bbox.height
```

Two panels belong to the same tier when their vertical overlap is at least 40%
of the smaller panel height:

```text
overlap = max(0, min(a.bottom, b.bottom) - max(a.top, b.top))
sameTier = overlap >= min(a.height, b.height) * 0.4
```

Use overlap ratio, not fixed pixel quantization. A rule such as `y // 100` is
resolution-dependent and will produce different orders for the same layout at
1200px and 3000px page widths.

Recommended deterministic grouping:

1. Sort candidate panels by `bbox.y`, then `bbox.x`, then stable ID.
2. Add each panel to the first existing tier whose tier vertical interval
   overlaps by the same 40% rule.
3. If no tier matches, create a new tier.
4. After insertion, update the tier vertical interval to cover all panels in
   the tier.

This greedy algorithm is intentionally simple. Complex layouts remain human
review cases.

### Tier Order

Sort tiers from top to bottom.

Recommended key:

1. tier top edge ascending
2. tier vertical center ascending
3. stable tier insertion order

### Panel Order Inside A Tier

Sort panels inside each tier from right to left.

Use the panel right edge as the primary key:

```text
rightEdge = bbox.x + bbox.width
```

Sort by:

1. `rightEdge` descending
2. `bbox.x` descending
3. `bbox.y` ascending
4. stable ID ascending

Do not sort primarily by left edge. A wide panel and a narrow panel can have
left edges that make the order look correct in one layout and wrong in another.
The right edge is the stable key for RTL panel order.

## Bubble Reading Order

Bubble order uses the owning Panel order first.

### Bubbles With `panelId`

For Bubbles whose `panelId` resolves to a Panel:

1. Sort Panels by the estimated Panel reading order above.
2. Within each Panel, group Bubbles into vertical reading columns.
3. Sort columns from right to left.
4. Sort Bubbles inside each column from top to bottom.

Column grouping uses the horizontal interval:

```text
left = bbox.x
right = bbox.x + bbox.width
width = bbox.width
```

Two Bubbles are in the same column when their horizontal overlap is at least
40% of the smaller Bubble width:

```text
overlap = max(0, min(a.right, b.right) - max(a.left, b.left))
sameColumn = overlap >= min(a.width, b.width) * 0.4
```

Column order key:

1. column right edge descending
2. column horizontal center descending
3. stable insertion order

Bubble order inside a column:

1. `bbox.y` ascending
2. `bbox.x + bbox.width` descending
3. `bubbleId` or stable ID ascending

The MVP assumes vertical Japanese manga reading for this geometry heuristic.
`Bubble.textDirection` describes the text layout direction, not necessarily the
page-level reading-order policy.

### Page-Level Bubbles With `panelId: null`

`panelId: null` is valid for page-level captions, SFX, notes, or source text
that has not been attached to a Panel.

In the MVP, page-level Bubbles are not inferred into Panel order. They should be
sorted among themselves using page position:

1. page tiers top to bottom using the same vertical overlap rule as Panels
2. right edge descending within each tier
3. top edge ascending
4. stable ID ascending

When mixed with Panel-linked Bubbles, unresolved page-level Bubbles should be
placed after all resolved Panel Bubbles. This limitation is intentional until
the CMS has a richer model for captions or cross-panel text.

## Canonical Order Versus Estimated Order

Canonical content stores order explicitly:

- `panel.panelNumber`
- `bubble.bubbleNumber`

Those fields are the authoritative reading order after human review.

Estimated order is allowed to:

- initialize draft numbering
- show warnings such as `READING_ORDER_SUSPECT`
- power an explicit "reorder by estimate" CMS action
- help reviewers find likely LTR or detector-order mistakes

Estimated order must not:

- silently rewrite `contents/`
- make Zod schema validation fail
- block saving by itself
- treat `panelId: null` as invalid
- treat unusual layouts as canonical errors

If estimated order disagrees with canonical order, show a warning and let the
reviewer decide.

## Known Limitations

The MVP heuristic should defer to human review for:

- L-shaped or highly irregular Panels
- overlapping Panels
- diagonal or spiral reading paths
- double-page spreads with cross-page order
- four-panel vertical strips that intentionally read top to bottom
- webtoon-style vertical scroll layouts
- cross-panel captions or sound effects
- Bubbles whose reading order is driven by character gaze or action flow

These cases are not schema errors. They are review cases.

## Antipatterns

Do not implement reading order with:

- fixed pixel bands such as `Math.floor(y / 100)`
- left-edge-first RTL panel sorting
- detector output order as canonical order
- OCR/LLM order as canonical order
- silent auto-reordering during save

These patterns are fragile because the same page at different resolutions or
from different detectors can produce different ordering.

## Relationship To Ingestion

Ingestion exists to reduce human review cost, not to create unquestioned
ground truth. The expected flow remains:

```text
automatic extraction -> confidence -> human review -> confirm -> contents/packs
```

Panel / Bubble reading order produced during ingestion is draft data. CMS review
must make it visible, correctable, and confirmable before it becomes canonical.

