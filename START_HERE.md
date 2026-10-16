# BayBasket: project and collected data

This is the source export of published version 9, including the visible basket
comparison, per-item store prices, automatic quantity totals, real product photos,
ZIP/city selection, and the retailer collectors.

## Start locally

Requirements: Node.js 22.13 or newer, pnpm 11.25.0 (the version pinned in
package.json), and Python 3.10+ if you want to refresh the data. The web app does
not need an AI API key. An internet connection is needed to install dependencies
and refresh retailer observations.

From this BayBasket directory:

```bash
pnpm install --frozen-lockfile
node scripts/generate-product-photos.mjs
pnpm exec next dev --port 3000
```

Open http://localhost:3000 . This uses stock Next.js with the included React
App Router source. `pnpm dev`, `pnpm build` and `pnpm start` use Vinext on a
local Cloudflare Workers runtime (Wrangler); `pnpm start` serves `dist/` after
`pnpm build`.

For a Next.js production build:

```bash
node scripts/generate-product-photos.mjs
pnpm exec next build
pnpm exec next start --port 3000
```

After opening the app, try ZIP 33544 or Tampa with a 20-mile radius. Add two or
more products to see the comparison table. Select "Demo catalog" if you want to
try the interface with explicitly illustrative prices after the real snapshot
has expired.

## What is included

- `app/`, `components/`, `lib/`: web UI, APIs, indexed search and basket logic.
- `data/live.json`: collected products and store-specific price observations.
- `data/places.json`, `data/store-geo.json`: ZIP/city lookup and store coordinates.
- `data/discovered.json`: store directory records; these are not price feeds.
- `public/products/`: retailer product photos and local brand fallback assets.
- `lib/generated-product-photos.json`: embedded photo data, ready to use and
  reproducible with the generation command above.
- `collector/`: Python public-page collectors, optional generic feed/SQLite
  collector, source configuration and tests.
- `tests/`: search, geography, pricing, basket and rendered UI checks.
- `README.md`: detailed behavior, collector operation and limitations.
- `ARCHIVE_MANIFEST.json`: source commit, snapshot totals and file hashes.
- Lockfile and original hosting/build configuration.

The ZIP excludes dependencies, Git history, build output and machine-local
runtime state. Install dependencies before running the JavaScript tests.

## Data coverage and freshness

Snapshot collected October 15, 2026 at 16:51 UTC (12:51 PM EDT):
186 products, 1,473 price observations, and 18 branches across Target,
Nutrition Smart, Bravo Supermarket and Safeway. All 186 products have photos.
Some observations record unavailable items; only eligible prices appear in the UI.

This is the existing collected dataset. Price collectors for Publix, Costco,
Walmart, Sam's Club, Whole Foods and ALDI are not implemented. It is not a full
inventory of all grocery chains. Marketplace prices may differ from shelf prices.

The app excludes real offers older than 24 hours. If you open this archive later,
real listings may disappear until you collect fresh observations. Original
observation timestamps are preserved in this export.

```bash
python3 collector/collect_retail.py --download-images
node scripts/generate-product-photos.mjs
```

Collection depends on public page availability and retailer page structure.
Review the collector output for failures and retain real observation timestamps.
Rebuild/restart the app after changing its imported data files. Do not change
old timestamps merely to make expired prices appear current.

## Focused checks

```bash
node tests/basket-comparison.test.mjs
node tests/basket-render.test.cjs
node tests/pricing.test.mjs
node tests/search.test.mjs
python3 -m unittest discover -s collector -p 'test_*.py'
```

The basket regression uses the included October 15 snapshot at its observation
time. Updating retailer data may require updating expected snapshot prices in
the regression test. `tests/photo-assets.test.mjs` expects the original Vinext
build output and should be run after that build.

Product photos remain owned by their respective retailers and brands.
