# BayBasket is a tool that helps you compare grocery prices in different areas, like cities and regions.

The React and Next.js app uses a router that comes from a source, and it's set up to work with Vinext, which is on Cloudflare Workers by default.
This is a background collector written in Python 3.10 or later. It only uses the standard library and does not require any AI or LLM.

## Nearby comparison behavior
- Just type in a ZIP code or the name of a city, and then pick how far you want to search - you can choose 5, 10, 20, or 30 miles.
- Pick just one store location for each grocery chain: the closest one **that has prices listed** within a certain distance. This doesn't mean all nearby stores are included.
- When you're shopping, pick the store locations you want to buy from first, and then stick with those for everything in your cart. If something is out of stock, we won't switch you to a different location of the same store that's farther away.
- We figure out distances using a special formula called Haversine. This formula uses approximate points for ZIP codes and cities, not the actual roads you'd drive on or your home address. The store locations come from Target's public information or the U.S. Census address finder. You can find the source links in a file called `data/store-geo.json`.
- When you look up a ZIP code or city, we use stored information from Zippopotam.us and GeoNames in a file called `data/places.json`. If you enter a five-digit ZIP code we don't know, we check it on the server to make sure it's in an area we support. If you enter something wrong, the current selection on the page stays the same and an error message appears.
- When we look at product cards, details, search results, and basket totals, they all follow one simple rule: the price has to be a whole number, the item must be in stock, and it has to be a fixed price that we've seen in the last 24 hours at a branch near you. We don't show anything for prices that aren't valid, or if the item is not available, or if the price is just an estimate, or if it's for a future date, or if the offer has already expired - that would just leave empty spaces where the price should be.
- When you look at the product details, you'll only see stores with a price that we've actually collected, and they're sorted from cheapest to most expensive. If a product just has one price, it will say "View price & source". The "Compare 2+ stores" option only shows you real comparisons between different stores. And if you pick just one store, you can still see what other stores nearby are charging for the same product.
- When you add or remove items from your basket, the total updates right away, so you can see how much you're spending. Above the list of items in your basket, there's a comparison table that shows all the products you've chosen, how many of each you're getting, the price per item at each store, and the total cost of your basket. For each product, you'll see a subtotal that clearly shows which items are included - and if a store doesn't have any prices for a particular item, it won't show a total of zero dollars. To make sure you're getting the best deal, we need two complete quotes before we can label the lowest total for your whole basket.
- So, when prices vary across different stores, we compare the biggest set of identical items that can be found at two or more of these stores. We use the same quantities for each store, and if an item is missing, we don't count it as zero or replace it with something else. We choose the items to compare based on how well they match, and then we look at the prices. We check the prices every minute to make sure they're up to date, and we also recheck them when you open the tab to view the comparison.
- When you save items in your basket, they stay there even if you refresh the page or share the link with someone. If you change the quantity of something, it updates right away without needing to check with the store again.

## Saved shopping lists

You can save up to 30 lists in the basket sidebar on your browser and even give them new names.
You can either load a list or get rid of it. The names in each catalog are one of a kind, and it doesn't matter if you use uppercase or lowercase letters.
Things are kept separate - we have one list for demos and another for real products. When you load something, it clears out what's currently in your basket.
So, when you get a confirmation, it remembers where you are and how far you're willing to go, then it figures out the prices again.
Lists keep track of the IDs and quantities of products, but they don't store the prices at a specific moment. If a product is no longer available,
The items in the catalog will stay on the list without prices instead of being removed.

Lists stay the same even if you refresh the page on the same browser, but they won't update on other browsers.
If you clear your browser's storage, it gets rid of them. This also happens when the stored data is not valid or not supported.
If something goes wrong, the error is shown without erasing what you had. When a save doesn't work, it won't say it was successful.
Other tabs refresh by using storage events. The actions read the storage again before writing to it.
When you make changes in different tabs at the same time, the last change you make is the one that will stick, even if you made other changes first.

```bash
pnpm test:saved-lists
```

## Current data coverage
- The collection from October 15, 2026 has a lot of stuff: **186 real products, 1,473 price observations, and 18 locations across four grocery chains**. Every single one of the 186 products has a photo from the retailer.
- The goal is to have 15 locations in Tampa Bay, Silicon Valley, and San Francisco. But only one spot shows up when you search near you.
- You can get food delivered from Nutrition Smart in Wesley Chapel through Mercato. Another option is Bravo Supermarket, which is located at 2540 East Bearss Ave in Tampa, and they also work with Mercato. If you're in San Francisco, you can try Safeway, they're at 2020 Market St and they partner with Mercato too.
- Around the 33544 area, there are 5 products that have set prices and are in stock from both Bravo and Nutrition Smart. These include Kerrygold Butter, Pure Irish - 8 Ounces, Organic Valley Whole Milk - half gallon, Organicgirl Baby Spinach - 5 Ounces, Kerrygold Butter, Garlic & Herb - 3.5 Ounces, and Bragg Apple Cider Vinegar, Organic - 16 Fluid Ounces. What's interesting is that they all have the same item IDs on Mercato. The Garlic & Herb butter, which was shown in a screenshot, now has two confirmed prices from nearby stores.
- In the usual area, some other cities only have Target. There's no other grocery store option in those places.
- We've got a limited list here, not a full rundown of every single store. Note that prices from Publix, ALDI, and Walmart aren't included in this collection.
- To make a target observation, you need to know the exact ID of the item and the store where it's being sold. For Mercato, the store needs to be active, have a matching ID, a price that's greater than zero, a picture, and a clear indication of whether the item is in stock or not. Also, prices on the marketplace might not be the same as the prices you see on the shelves.
- When we're talking about products on a platform, the exact IDs are what match them up. But to make sure Target items and Mercato items are the same, we need to check the UPCs to confirm. Just because two products have similar names, it doesn't mean they're automatically the same thing.
- Some things aren't included in the total cost of your basket, like special estimates, old offers, taxes, and fees. Also, discounts you get for being loyal or buying multiple items are not part of the total. When you look at the details of a product, you can see where it came from, how you found it, and when it was last updated.
- When you store photos on your device, they get embedded into the app's interface, which helps them display properly. This adds around 6.3 MB of photo data to the app's initial files before they're compressed for transfer. The search function uses an index that's already loaded on your device, so it doesn't need to fetch the actual images or check retailers' websites every time you search for something.
- We kept 1,437 records from Tampa Bay after getting rid of the ones that weren't from around there. We also made sure to remove any duplicates and only kept the closest discoveries. The directory for California didn't work, but we can still get prices from the retailers we trust - though we do warn people that the directory itself didn't work.
- We collect prices by hand. If a price is more than a day old, it won't be included in the estimate for your basket, so you need to refresh and then build and deploy.

## Refresh actual retailer data and photos
```bash
python3 collector/collect_retail.py --download-images
# Update one spot without changing the rest of the data and the time things were seen.
python3 collector/collect_retail.py --store target:322 --download-images
# Refresh the store directory independently of prices:
python3 collector/discover_stores.py
# You can fix or update pictures without altering the timestamps when you first saw the prices.
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
# Update the data in live.json and redeploy it, also rebuild the files in the public/products/ folder.
# Once you've built it, double-check the paths for the assets you've deployed and make sure the photo formats are correct.
node tests/photo-assets.test.mjs
```
Configuration: collector/retail_sources.json. Source-aware parsing lives in collect_retail.py.
Each retailer can only handle one request at a time, but they do this at their own pace. Meanwhile, different hosts can run at the same time without interfering with each other.
There's no fancy AI tool or special login needed. The collector simply looks at the public information on websites.
It keeps the exact query marker in the rules for robots.txt and also follows the rules for wildcards and end anchors.
For the set up web links that use basic lettering, the system gets pictures from the usual public image addresses.

The catalog takes a snapshot of what's not working and how many offers each source has. Sources that fail just disappear.
from a completely new update, instead of getting made-up or revised prices. If everything
If the source fails, the last snapshot stays the same. When images fail, it goes back to the original one from the remote.
Provide a photo URL with a visible fallback because public page structures can change and require updates to the parser.

## Run the web app
You need Node version 22.13 or higher and the package manager specified in the package.json file. First, install the dependencies. Then run `npm run dev`.
To host a stock Next.js site, you can use `npx next dev` or `npx next build`. But if you're using the default `pnpm build`, it will use Vinext on Cloudflare Workers.

## Generic feed collection (optional alternative)
```bash
python3 collector/grocery.py discover
python3 collector/grocery.py coverage > coverage.json
# You can also add places that have been checked and aren't already on the OpenStreetMap.
python3 collector/grocery.py import-stores your-stores.json
# Make a copy of the example config file and fill in the blanks with your own authorized sources.
python3 collector/grocery.py collect sources.json
python3 collector/export_web.py --db grocery.sqlite --out data/live.json --channel in_store
# Rebuild/redeploy after updating data/live.json.
```
`The import-stores feature accepts objects that have id, name, chain, address, latitude, longitude, and website.
The collector can only be used from the command line, it's not something you can access from a website.
The JSON-LD collection checks the robots.txt file, honors the crawl delay, and matches the exact SKU.
Needs to be clear and direct, can't work with vague options. It just doesn't
You can use JavaScript to get around things like login screens, CAPTCHAs, bot blockers, and location selectors.
The operator needs to check that the page is actually for the store and channel that are configured.
So, you've got the pack size to consider. Setting store_context_verified is more like a confirmation, it doesn't happen on its own.

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
Always use the real timestamps when you observe something, don't update old observations by changing their timestamps.
We still don't know the prices. When it comes to product keys, they need to match the exact brand, type, and size of the product.
Private label substitutions need a clear separate comparison policy. Loyalty, coupon, and BOGO offers.
Prices need separate eligibility rules and are not being modeled. We have taxes, fees, and weighted checkout to consider.
We don't include variations. Prices are kept as whole cents inside the system. When we compare things, we look at one part at a time.

## Search algorithm and 3-second target
1. When a retailer collects background data, it records what's happening and when, and saves it to a file called `data/live.json`. There's also an extra tool that can collect more general information, which uses SQLite to store it and then exports it.
2. Create an index that maps tokens to products and store this information for each browser session, so it's ready to use whenever needed, and make sure each worker has its own separate copy.
3. Start by looking at the smallest group of possible stores. For each ZIP code or city and radius, find the closest store for each grocery chain. If no stores match, you won't get any results - it won't use the general prices instead.
4. When you search on the browser, it uses the information it already has to give you results right away. You'll only see deals from the specific stores you've chosen. If you change your location or the distance you're willing to travel, it will reset the filter that only shows one store and recalculate what's in your basket - but it won't replace anything that's missing. Items that are available at multiple stores you've selected will show up first, especially if they have different prices at each one.
5. `/api/search?near=33544&radius=20&q=milk` gives the same search results that are already listed. To compare prices at two or more stores, you need to add `comparisons=true`. The system first checks if the prices are eligible, then it filters and paginates the results. If you enter a location that's not valid or try to access a store outside the nearby area, you'll get an HTTP 400 error. The responses you get will be limited and won't include any images.
6. When you visit the site directly, the ZIP code and city, along with the radius, are saved in the website's address and shown right away. We don't use any retailers, Overpass, or LLM requests when you're searching. The time you see is how long it takes to look up the info locally, not the total time it takes for the whole process, from when you start typing to when the page loads.

When you search for something, it takes about as long as the number of words in your query times the smallest group of results, plus the actual results. If you don't type anything or use filters that aren't very specific, the system has to check more possibilities. Also, building the index and storing prefixes uses more memory, especially when you first start up.

**Goal, not a strict rule:** we want most inputs to get results in under 3,000 ms. This hasn't been tested with actual traffic, different network conditions, or a full catalog from all stores.
The local benchmark tests around 100,000 items, but it only looks at how well the index performs when it's already been used. This doesn't mean it's a test of how well the system works in real-life situations.

When it comes to exporting products, there's a limit of 5,000 items. This is because the retailer collector only looks at a small selection of source pages. To make searches faster, a snapshot of the web page is saved on the client's side, which helps with looking up products in a basket. But if you want to search on a larger scale, you'll need to use a special search index like Typesense, OpenSearch, or Meilisearch, along with a search API that can handle lots of requests and a cache that doesn't get too full. Only send the products that the user asks for to their browser. Keep any special offers from retailers, stores, or channels separate from the main search index, and use the product's ID to keep track of them. Before comparing products, filter them by the stores that sell them in each area. And to make sure everything runs smoothly, test how long it takes for the system to respond and how well it handles lots of requests at the same time, all within a 3-second time frame.

We still need to measure how long it takes for the browser to respond and test how the system handles multiple tasks at the same time. Our local test results show that the regional query takes less than a millisecond for 95 percent of the lookups on a snapshot of 186 products. However, this is not a guarantee of the total time it takes for the whole process to complete.

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
Here's how you can test the system: it checks a lot of things like prefix and semantics, categories, quantities, prices that are no longer valid, baskets that aren't complete, and all the cities and zip codes. It also looks at how far apart things are and makes sure each chain only has one branch. If something is missing, it doesn't switch to a different branch. It even checks the quantities of baskets across different chains. When it comes to prices, it checks if the quotes are right, if the filtering is working, and if there are any old or invalid offers. It also makes sure the quotes are just numbers and labels, and that the listings are for single stores. For baskets, it checks a lot of things like the screenshot of three products, if the quantities have changed, the totals, and if the same products are being compared. It even checks if the location and expiry dates are right, and if the URLs are working properly. The system also checks if the app is showing the right comparisons and labels. There are also tests to make sure the collector is working right, like rejecting products that aren't food on general store pages and responses for the wrong product. To make sure it's all working fast, it uses 100,000 fake product records and 1,000 queries to test it out.
We didn't have access to browser QA in this setup. Also, validating the build and type is a separate process.

## Sources
- OSM Overpass: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example
- OSM data attribution/license: https://www.openstreetmap.org/copyright
- Structured offer fields: https://schema.org/Offer
- Check out Instacart's developer overview here: https://docs.instacart.com/developer_platform_api/
