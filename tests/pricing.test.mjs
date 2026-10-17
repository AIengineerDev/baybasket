import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isUsableOffer,priceClock,pricedCatalog,quoteRows,rankPricedProducts,PRICE_TTL_MS} from '../lib/pricing.mjs';
import {basketTotals} from '../lib/search.mjs';

const now=Date.parse('2026-10-15T16:00:00Z');
const quote=(storeId,cents,patch={})=>({storeId,cents,available:true,estimated:false,observedAt:new Date(now-1000).toISOString(),...patch});
const stores=[{id:'target',chain:'Target'},{id:'bravo',chain:'Bravo'},{id:'nutrition',chain:'Nutrition Smart'}];
const butter={id:'garlic-butter',name:'Garlic & Herb Butter 3.5 oz',offers:[quote('nutrition',370)]};
assert.deepEqual(quoteRows(butter,stores,now).map(r=>[r.store.chain,r.offer.cents]),[['Nutrition Smart',370]],'The reported screenshot must render one priced row, not two empty rows');

for(const patch of [{available:false},{estimated:true},{cents:0},{cents:-1},{cents:NaN},{cents:1.5},{observedAt:'invalid'},{observedAt:new Date(now+1).toISOString()},{observedAt:new Date(now-PRICE_TTL_MS).toISOString()}]){
 const invalid=quote('target',299,patch);
 assert.equal(isUsableOffer(invalid,now),false);
 assert.equal(pricedCatalog([{...butter,offers:[invalid]}],['target'],now).length,0,'Unpriced or ineligible items must not become blank product cards');
 assert.equal(basketTotals([{...butter,offers:[invalid]}],{[butter.id]:1},stores,now).filter(s=>s.complete).length,0);
}
assert.equal(quoteRows(butter,stores,now+PRICE_TTL_MS).length,0,'An open dialog must not retain expired prices');
assert.equal(quoteRows(butter,[stores[0]],now).length,0,'Never show a remote/unselected grocer to fill a missing quote');

const shared={id:'shared',name:'Shared item',offers:[quote('bravo',679),quote('nutrition',720),quote('far-safeway',799)]};
const priced=pricedCatalog([butter,shared],stores.map(s=>s.id),now);
assert.deepEqual(rankPricedProducts(priced,{comparisonsOnly:true}).map(p=>p.id),['shared']);
const filtered=rankPricedProducts(priced,{storeId:'bravo',comparisonsOnly:true});
assert.equal(filtered.length,1);
assert.equal(filtered[0].offers.length,2,'Filtering a grocer must not erase its competitors from product details');
assert.deepEqual(quoteRows(shared,stores,now).map(r=>r.offer.cents),[679,720]);
const totals=basketTotals([butter,shared],{shared:2},stores,now).filter(s=>s.complete);
assert.deepEqual(totals.map(s=>s.cents),[1358,1440],'Only full priced baskets belong in the comparison list');
const duplicate={...shared,offers:[quote('bravo',679),quote('bravo',700,{observedAt:new Date(now-500).toISOString()})]};
assert.equal(pricedCatalog([duplicate],['bravo'],now)[0].offers.length,1);
assert.equal(rankPricedProducts(pricedCatalog([duplicate],['bravo'],now),{comparisonsOnly:true}).length,0,'Duplicate offers cannot become a two-grocer comparison');

// A fresh snapshot is judged at now; an expired one is judged as of its newest observation and flagged.
const fresh=[{...butter,offers:[quote('nutrition',370)]}];
assert.deepEqual(priceClock(fresh,now),{at:now,stale:false,asOf:null});
const later=now+PRICE_TTL_MS+60_000,newestAt=now-1000;
const old=[{...butter,offers:[quote('nutrition',370),quote('bravo',360,{observedAt:new Date(now-5000).toISOString()})]}];
assert.deepEqual(priceClock(old,later),{at:newestAt,stale:true,asOf:new Date(newestAt).toISOString()});
assert.equal(pricedCatalog(old,['nutrition','bravo'],later).length,0,'At the wall clock an expired snapshot prices nothing');
assert.equal(pricedCatalog(old,['nutrition','bravo'],priceClock(old,later).at)[0].offers.length,2,'As of its own time the snapshot shows both prices');
assert.deepEqual(priceClock(old,now+PRICE_TTL_MS-2000).stale,false,'One minute fresh is still fresh');
const withFuture=[{...butter,offers:[quote('nutrition',370),quote('bravo',360,{observedAt:new Date(later+1).toISOString()})]}];
assert.equal(priceClock(withFuture,later).at,newestAt,'A future-dated offer cannot make an expired snapshot look fresh');
assert.deepEqual(priceClock([],later),{at:later,stale:false,asOf:null},'No observations: nothing to fall back to');
const stillInvalid=[{...butter,offers:[quote('nutrition',370,{available:false})]}];
assert.equal(pricedCatalog(stillInvalid,['nutrition'],priceClock(stillInvalid,later).at).length,0,'The fallback relaxes only the clock, not availability or price checks');

const live=JSON.parse(readFileSync('data/live.json','utf8'));
const screenshotProduct=live.products.find(p=>p.id==='mercato:1095');
assert(screenshotProduct,'Keep the real product from the user screenshot');
const screenshotRows=quoteRows(screenshotProduct,live.stores.filter(s=>['target:656','mercato:1323','mercato:2701'].includes(s.id)),priceClock(live.products).at);
assert.equal(screenshotRows.length,2,'The screenshot product now has real quotes at Nutrition Smart and Bravo');
assert(screenshotRows.every(r=>Number.isSafeInteger(r.offer.cents)&&r.offer.cents>0));
console.log(JSON.stringify({priceEligibility:'passed',emptyQuoteRows:'excluded',singlePriceLabels:'supported',comparisonFilter:'passed',storeFilterKeepsCompetingQuotes:'passed',basketTotals:'passed',realScreenshotQuotes:screenshotRows.map(r=>({store:r.store.name,cents:r.offer.cents}))}));
