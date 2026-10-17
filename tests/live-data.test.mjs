import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {buildIndex,search,basketTotals} from '../lib/search.mjs';
import {priceClock} from '../lib/pricing.mjs';
const data=JSON.parse(readFileSync('data/live.json','utf8'));
const ids=new Set(data.stores.map(s=>s.id));let offers=0,localImages=0;
assert(data.products.length>0,'Live catalog must not be empty');
assert.equal(new Set(data.products.map(p=>p.id)).size,data.products.length);
for(const p of data.products){
 assert(p.name&&p.id&&p.imageSource.startsWith('https://'));
 if(p.imageUrl.startsWith('/')){assert(existsSync('public'+p.imageUrl),'Missing local photo');localImages++}
 assert(p.offers.length>0);
 assert.equal(new Set(p.offers.map(o=>o.storeId)).size,p.offers.length,'Duplicate store offer');
 for(const o of p.offers){
  assert(ids.has(o.storeId),'Unknown store');assert(Number.isInteger(o.cents)&&o.cents>0);assert(['online','pickup'].includes(o.channel));
  assert(o.sourceUrl.startsWith('https://'));assert(Number.isFinite(Date.parse(o.observedAt)));
  assert(new Date(o.observedAt)<=new Date(),'Future observation');offers++;
 }
}
const index=buildIndex(data.products);
const strawberries=search(index,'strawberries');assert(strawberries.length>0);
const chosen=strawberries.find(p=>p.offers.filter(o=>o.available).length>1);assert(chosen,'Need multi-store comparison data');
const available=chosen.offers.find(o=>o.available&&!o.estimated);assert(available);
const total=basketTotals(data.products,{[chosen.id]:2},data.stores,priceClock(data.products).at).find(s=>s.id===available.storeId);
assert.equal(total.cents,available.cents*2);assert(total.complete);
assert.equal(search(index,'strawberries','All',30,{storeId:'not-connected'}).length,0);
console.log(JSON.stringify({verifiedProducts:data.products.length,verifiedOffers:offers,stores:ids.size,localImages,exactItemComparison:'passed'}));
