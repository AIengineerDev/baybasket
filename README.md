# BayBasket — grocery comparison by region and city

React + Next.js App Router source; the default build runs on Vinext (Cloudflare Workers).
Python 3.10+ background collector (standard library only). No AI or LLM required.

## Nearby comparison behavior
- Enter a ZIP code or city, then choose a 5, 10, 20 or 30 mile radius.
- Select exactly one branch per grocery chain: the nearest branch **with collected prices** within that radius. This is not a promise that every nearby branch is connected.
- Select branches before product search and keep those same branches for the whole basket. Missing items never cause a switch to a farther branch of the same chain.
- Distances use the Haversine formula and approximate ZIP/city reference points, not driving routes or a home address. Store coordinates are sourced from Target's public store metadata or the U.S. Census address geocoder, with source URLs retained in `data/store-geo.json`.
- ZIP/city lookups use cached Zippopotam.us / GeoNames data in `data/places.json`. Unknown five-digit ZIPs have a bounded server-side lookup and must fall inside the supported regions. Invalid input leaves the current UI selection intact and shows an error.
- Product cards, details, the search API and basket totals share one price rule: a positive integer price, in stock, fixed-price, observed within 24 hours, and belonging to a selected nearby branch. Invalid, unavailable, estimated, future-dated and expired offers never create blank product cards or empty price rows.
- Product details list only grocers with an eligible collected price, sorted by price. Single-quote products say “View price & source”; the “Compare 2+ grocers” filter contains only actual comparisons. Filtering one grocer retains the other nearby quotes for product details.
- Basket totals update automatically above the basket item list. An open comparison table above the catalog shows each selected product, quantity, per-store line price and basket total. A partial subtotal is explicitly labeled with its product coverage; a store with no eligible prices never receives a zero-dollar total. Two complete quotes are required before labeling a lowest full basket.
- When full coverage differs, a separate row compares the largest identical-product subset priced at two or more selected grocers. The same quantities apply to every quote; missing items never count as zero or become substitutions. The subset is selected by coverage before price. Prices are rechecked for expiry each minute and when the tab becomes visible.
- Live baskets are preserved in the URL so a refresh or shared link retains selected products and quantities. Quantity changes recalculate locally without another retailer request.

## Current data coverage
- The October 15, 2026 collection contains **186 real products, 1,473 price observations, and 18 locations across four grocery chains**. All 186 products have retailer photos.
- Target: 15 branches across Tampa Bay, Silicon Valley and San Francisco. Only one is selected per nearby search.
- Nutrition Smart: Wesley Chapel via Mercato. Bravo Supermarket: 2540 East Bearss Ave, Tampa, via Mercato. Safeway: 2020 Market St, San Francisco, via Mercato.
- Near ZIP 33544, 5 products have fixed, in-stock quotes from both Bravo and Nutrition Smart: Kerrygold Butter, Pure Irish - 8 Ounces, Organic Valley Whole Milk - half gallon, Organicgirl Baby Spinach - 5 Ounces, Kerrygold Butter, Garlic & Herb - 3.5 Ounces, Bragg Apple Cider Vinegar, Organic - 16 Fluid Ounces. These share exact Mercato item IDs. The Garlic & Herb butter from the reported screenshot now has two verified nearby quotes.
- Within the default radius, several other cities still have only Target connected. No second-grocer quote is fabricated in those areas.
- This is a bounded collection, not complete inventories or every chain. Publix, ALDI and Walmart price feeds are not implemented.
- Target observations require an exact item ID and matching fulfillment store. Mercato observations require an active store, matching store ID, positive price, image, and explicit stock state. Marketplace prices may differ from shelf prices.
- Exact item IDs match products within a platform; matching Target items to Mercato items still needs verified UPCs. Similar names never silently become the same product.
- Weighted estimates, stale/unavailable offers, taxes, fees, loyalty and multi-buy discounts are excluded from basket totals. Product details retain the source, channel and actual observation time.
- Photos are locally stored and embedded into the UI build for reliable display. This adds about 6.3 MB of unique photo bytes before transport encoding to the small POC's initial assets. Search uses an already-loaded local index; it does not fetch image bytes or scrape retailers on each query.
- Discovery retains 1,437 Tampa Bay OSM records after removing records outside the region. Nearby discovery is distance-filtered and deduplicated by chain. California directory requests timed out; its verified retailer price sources remain available with an explicit directory warning.
- Collection is manual. Prices older than 24 hours are excluded from basket estimates; build and deploy after refreshing.

## Refresh actual retailer data and photos
```bash
python3 collector/collect_retail.py --download-images
# Refresh one location while preserving other stores and observation timestamps:
python3 collector/collect_retail.py --store target:322 --download-images
# Refresh the store directory independently of prices:
python3 collector/discover_stores.py
# Repair or refresh photos without changing price observation timestamps:
python3 collector/collect_retail.py --images-only
node tests/search.test.mjs
node tests/live-data.test.mjs
node tests/locations.test.mjs
node tests/nearby.test.mjs
node tests/pricing.test.mjs
node tests/price-dialog.test.cjs
node tests/basket-comparison.test.mjs
node tests/basket-render.test.cjs
python3 -m unittest discover -s collector -p 'test_*.py'
# Rebuild and deploy the updated data/live.json and public/products/.
# After building, check the deployed asset paths and photo formats:
node tests/photo-assets.test.mjs
```
Configuration: collector/retail_sources.json. Source-aware parsing lives in collect_retail.py.
One request runs at a time per retailer host, with pacing; independent hosts can run concurrently.
There is no LLM, paid API, login bypass or private endpoint. The collector reads public HTML data.
It preserves the literal query marker in robots.txt rules and respects wildcard/end-anchor rules
for the configured ASCII URLs. Image fetching uses the original public image endpoints.

The catalog snapshot records failures and per-source offer counts. Failed sources disappear
from a full new snapshot rather than receiving fabricated or freshly restamped prices. If every
source fails, the previous snapshot is left unchanged. Image failures use the original remote
photo URL with a visible fallback. Public page structures can change and require parser updates.

## Run the web app
Node 22.13+ and the package manager in package.json. Install dependencies, then `npm run dev`.
For stock Next.js hosting, use `npx next dev` / `npx next build` The default `pnpm build` uses Vinext on Cloudflare Workers.

## Generic feed collection (optional alternative)
```bash
python3 collector/grocery.py discover
python3 collector/grocery.py coverage > coverage.json
# Optional: add verified locations not present in OSM.
python3 collector/grocery.py import-stores your-stores.json
# Copy the example config and replace placeholders with authorized sources.
python3 collector/grocery.py collect sources.json
python3 collector/export_web.py --db grocery.sqlite --out data/live.json --channel in_store
# Rebuild/redeploy after updating data/live.json.
```
`import-stores` accepts objects with id, name, chain, address, lat, lon, website.
The collector is CLI-only, not exposed as an unrestricted web fetch endpoint.
JSON-LD collection checks robots.txt, honors crawl delay, matches the exact SKU,
requires explicit availability, and fails on ambiguous multiple offers. It does not
run JavaScript or bypass login, CAPTCHAs, bot protection, or location-selection flows.
The operator must verify the page actually represents the configured store, channel
and pack size; setting store_context_verified is an assertion, not automatic verification.

Authorized JSON feed shape (array of observations):
```json
[{
  "store_id":"a-verified-store-id",
  "product_key":"verified-gtin-and-pack-size",
  "name":"Exact product name",
  "package":"16 oz",
  "price":"3.99",
  "currency":"USD",
  "channel":"in_store",
  "available":true,
  "observed_at":"2026-10-14T15:00:00+00:00",
  "source_url":"https://your-authorized-provider.example/product"
}]
```
Use actual observation timestamps, never refresh stale observations by changing timestamps.
Unknown prices remain missing. Product keys must identify identical brands/variants/package sizes;
private-label substitutions require an explicit separate comparison policy. Loyalty/coupon/BOGO
prices need separate eligibility rules and are not modeled. Taxes, fees and weighted checkout
variation are excluded. Prices are integer cents internally. Comparisons use one channel at a time.

## Search algorithm and 3-second target
1. Background retailer collection writes source-linked, timestamped observations to `data/live.json`. The optional generic feed collector uses SQLite and an export step.
2. Build a token-prefix inverted index and store-to-product posting sets once per browser session / Worker isolate.
3. Intersect the smallest token/store candidate set first. ZIP/city and radius resolve to one nearest collected branch per grocery chain. An empty set returns zero results; it never falls back to global prices.
4. Browser searches use the already-loaded index synchronously. Only selected branches’ offers are shown. Changing location or radius resets the single-store filter and recalculates the basket; missing items remain incomplete, never substituted. Products with prices at multiple selected chains appear first.
5. `/api/search?near=33544&radius=20&q=milk` exposes the same indexed search; add `comparisons=true` to require two or more priced grocers. Filtering/pagination happens after price eligibility checks. Invalid locations and branches outside the selected nearby set return HTTP 400. Responses are bounded and contain no image bytes.
6. ZIP/city and radius are retained in the URL and server-rendered on a direct visit. No retailer, Overpass or LLM request runs in the search path. The displayed timing is local lookup time, not full input-to-render/network latency.

Lookup complexity is approximately O(k*m + results), where k is query-token count and m is the smallest posting set. Empty queries and poorly selective category filters can scan more candidates. Index construction and prefix storage increase cold-start/memory cost.

**Target, not SLA:** p95 input-to-results <3,000 ms. This has NOT been validated under real traffic, network conditions or all-store catalog size.
The 100,000-item local benchmark measures only warmed index lookup. It is not production capacity certification.

The generic export is capped at 5,000 products; the retailer collector covers a small curated set of source pages. The web snapshot is imported on the client for basket lookups. For full regional scale, replace this with a dedicated Typesense/OpenSearch/Meilisearch index, a paginated search API, server-side basket joins and a bounded cache. Send only requested products to the browser. Keep retailer/store/channel offers outside the text index, keyed by canonical product ID. Partition/filter by geographic store coverage before comparison. Test full latency and concurrency before a 3-second guarantee.

Production work still needs browser input-to-paint measurements and realistic concurrent-load tests. The local regional query test reports sub-millisecond p95 lookup on this 186-product snapshot; that is not an end-to-end latency guarantee.

## Validation
```bash
node tests/search.test.mjs
node tests/live-data.test.mjs
node tests/locations.test.mjs
node tests/nearby.test.mjs
node tests/pricing.test.mjs
node tests/price-dialog.test.cjs
node tests/basket-comparison.test.mjs
node tests/basket-render.test.cjs
python3 -m unittest discover -s collector -p 'test_*.py'
```
Tests cover prefix AND semantics, category filters, basket quantities, stale prices, incomplete baskets, all 12 city selections, ZIP lookup, distance bounds, exactly one branch per chain, missing items without branch switching, and real cross-chain basket quantities. Price tests cover the reported single-quote dialog, comparison filtering, stale/invalid offers and missing basket quotes. The actual TSX dialog is rendered to verify that it contains only numeric quote rows and labels single-store listings. Basket tests verify the three-product screenshot, changed quantities, full and partial totals, identical-product comparisons, location scope, expiry, ties and URL persistence; the actual app is rendered to check comparison visibility and labels. Collector tests reject non-food products on general store pages and responses for a different requested product. Benchmark uses 100,000 synthetic product records and 1,000 queries.
Browser QA was not available in this environment. Build/type validation is separate.

## Sources
- OSM Overpass: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example
- OSM data attribution/license: https://www.openstreetmap.org/copyright
- Structured offer fields: https://schema.org/Offer
- Instacart developer overview (not an implemented adapter): https://docs.instacart.com/developer_platform_api/
