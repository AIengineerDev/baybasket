import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {regions,validLocation,storesForLocation,restrictOffers,filterDiscovery} from '../lib/locations.mjs';
import {buildIndex,search,basketTotals} from '../lib/search.mjs';
const data=JSON.parse(readFileSync('data/live.json','utf8'));
const discovery=JSON.parse(readFileSync('data/discovered.json','utf8'));
const index=buildIndex(data.products),times=[],coverage=[];
assert(!validLocation('silicon-valley','tampa'));
assert(!validLocation('unknown'));
assert.equal(search(index,'','All',1000,{storeIds:[]}).length,0,'An empty city must never fall back to global results');
for(const region of regions){
 assert(validLocation(region.id));
 for(const city of region.cities){
  assert(validLocation(region.id,city.id));
  const stores=storesForLocation(data.stores,region.id,city.id),storeIds=stores.map(s=>s.id);
  assert(stores.length>0,`${city.name} needs at least one verified price source`);
  for(const store of stores)assert.equal(store.state,region.state);
  const products=restrictOffers(search(index,'','All',1000,{storeIds}),storeIds);
  assert(products.length>0,`${city.name} has no collected products`);
  for(const product of products)for(const offer of product.offers)assert(storeIds.includes(offer.storeId),'Cross-city offer leaked');
  for(const query of ['milk','straw','bread','energy','', 'not-a-product']){
   const start=performance.now();
   const results=restrictOffers(search(index,query,'All',120,{storeIds}),storeIds);
   times.push(performance.now()-start);
   for(const product of results)assert(product.offers.every(o=>storeIds.includes(o.storeId)));
  }
  const otherStore=data.stores.find(s=>!storeIds.includes(s.id));
  assert.equal(search(index,'','All',1000,{storeIds,storeId:otherStore.id}).length,0);
  const freshProduct=products.find(p=>p.offers.some(o=>o.available&&!o.estimated));
  assert(freshProduct);
  const totals=basketTotals(data.products,{[freshProduct.id]:2},stores);
  assert.equal(totals.length,stores.length);
  for(const total of totals)assert(storeIds.includes(total.id));
  for(const record of filterDiscovery(discovery.stores,region.id,city.id))assert.equal(record.regionId,region.id);
  coverage.push({region:region.name,city:city.name,stores:stores.length,products:products.length});
 }
}
assert.equal(filterDiscovery([{regionId:'tampa-bay',city:'Saint Petersburg'}],'tampa-bay','st-petersburg').length,1);
assert.equal(filterDiscovery([{regionId:'tampa-bay',city:'Tampa'}],'san-francisco','san-francisco').length,0);
// A shared exact product can cost more in California. The selected city's price wins.
const fixture=[{id:'same-item',name:'Whole milk',brand:'Test',category:'Dairy',offers:[
 {storeId:'fl',cents:299,available:true,observedAt:new Date().toISOString()},
 {storeId:'ca',cents:459,available:true,observedAt:new Date().toISOString()},
]}];
assert.equal(restrictOffers(fixture,['ca'])[0].offers[0].cents,459);
assert.equal(fixture[0].offers.length,2,'Scoping must not mutate the shared catalog');
assert.equal(basketTotals(fixture,{'same-item':2},[{id:'ca'}])[0].cents,918);
times.sort((a,b)=>a-b);
assert(times.at(-1)<3000);
console.log(JSON.stringify({coverage,queries:times.length,lookupP95Ms:times[Math.floor(times.length*.95)],note:'Local indexed lookup only; not network/render latency.'},null,2));
