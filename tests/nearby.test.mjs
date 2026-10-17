import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nearestPerChain,distanceMiles,lookupPlace,chainKey,regionForPoint} from '../lib/nearby.mjs';
import {buildIndex,search,basketTotals} from '../lib/search.mjs';
import {priceClock} from '../lib/pricing.mjs';
import {restrictOffers} from '../lib/locations.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const data=read('data/live.json'),geo=read('data/store-geo.json'),places=read('data/places.json');
const stores=data.stores.map(s=>({...s,...geo[s.id]}));
assert(stores.every(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)),'Every price source needs verified coordinates');
assert(Math.abs(distanceMiles({lat:0,lon:0},{lat:0,lon:1})-69.09)<.01);
const origin={lat:0,lon:0,state:'FL'};
const fixture=[{id:'target-near',chain:'Target',state:'FL',lat:0,lon:.01},{id:'target-cheaper-far',chain:'Target',state:'FL',lat:0,lon:.05},{id:'bravo',chain:'Bravo',state:'FL',lat:.01,lon:0},{id:'far',chain:'Far Grocery',state:'FL',lat:10,lon:0}];
const selected=nearestPerChain(fixture,origin,5);
assert.deepEqual(new Set(selected.map(s=>s.id)),new Set(['target-near','bravo']));
assert.deepEqual(nearestPerChain(fixture,null),[]);
assert.deepEqual(nearestPerChain([{id:'no-coordinate',chain:'Missing'}],origin),[]);
const products=[{id:'milk',name:'Milk',brand:'Test',category:'Dairy',offers:[{storeId:'target-cheaper-far',cents:100,available:true,observedAt:new Date().toISOString()}]}];
assert.equal(restrictOffers(products,selected.map(s=>s.id)).length,0,'Do not substitute a farther branch when a price is missing');
assert(basketTotals(products,{milk:1},selected).every(s=>!s.complete));
assert.equal(lookupPlace('33544',places).cityId,'wesley-chapel');
assert.equal(lookupPlace('tAmPa, FL',places).cityId,'tampa');
assert.equal(lookupPlace('Saint Petersburg',places).cityId,'st-petersburg');
assert.equal(lookupPlace('Invalid City',places),null);
assert.equal(lookupPlace('3354',places),null);
assert.equal(regionForPoint({lat:40.7,lon:-74}),null);
const index=buildIndex(data.products),coverage=[],times=[];
for(const location of Object.values(places.cities)){
 const selected=nearestPerChain(stores,location),ids=selected.map(s=>s.id);
 assert(selected.length>0,location.city+' has no nearby source');
 assert.equal(new Set(selected.map(chainKey)).size,selected.length);
 assert(selected.filter(s=>s.chain==='Target').length<=1);
 assert(selected.every(s=>s.distanceMiles<=20&&s.state===location.state));
 for(const query of ['', 'milk','butter','strawberries']){
  const start=performance.now(),result=restrictOffers(search(index,query,'All',120,{storeIds:ids}),ids);times.push(performance.now()-start);
  assert(result.every(p=>p.offers.every(o=>ids.includes(o.storeId))));
  assert(result.every(p=>new Set(p.offers.map(o=>chainKey(stores.find(s=>s.id===o.storeId)))).size===p.offers.length));
 }
 coverage.push({city:location.city,grocers:selected.map(s=>s.chain)});
}
const local=nearestPerChain(stores,lookupPlace('33544',places));
assert.equal(local.find(s=>s.chain==='Target').id,'target:1382');
const shared=restrictOffers(data.products,local.map(s=>s.id)).filter(p=>p.offers.filter(o=>o.available&&!o.estimated).length>=2);
assert(shared.length>0,'Need at least one real cross-chain comparison near Wesley Chapel');
const basket=basketTotals(data.products,{[shared[0].id]:2},local,priceClock(data.products).at);
assert(basket.filter(s=>s.complete).length>=2,'Real shared item should yield two complete grocery quotes');
times.sort((a,b)=>a-b);assert(times.at(-1)<3000);
console.log(JSON.stringify({coverage,realCrossChainProductsNear33544:shared.map(p=>p.name),queryP95Ms:times[Math.floor(times.length*.95)],policy:'One nearest collected branch per chain; no item-based branch switching'},null,2));
