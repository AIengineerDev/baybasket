import {pricedCatalog} from './pricing.mjs';

/** @param {unknown} value @param {import('./catalog').Product[]} products */
export function parseBasket(value,products){
 const known=new Set(products.map(p=>p.id));
 /** @type {Record<string,number>} */
 const basket={};
 if(typeof value!=='string'||value.length>20000)return basket;
 for(const entry of value.split(',')){
  const [id,raw,...extra]=entry.split('~'),quantity=Number(raw);
  if(!extra.length&&known.has(id)&&Number.isInteger(quantity)&&quantity>=1&&quantity<=99)basket[id]=quantity;
 }
 return basket;
}

/** @param {Record<string,number>} basket */
export function serializeBasket(basket){
 return Object.entries(basket).filter(([,q])=>Number.isInteger(q)&&q>=1&&q<=99).map(([id,q])=>`${id}~${q}`).join(',');
}

/** @param {import('./catalog').Product[]} products @param {Record<string,number>} basket @param {import('./catalog').GroceryStore[]} stores */
export function compareBasket(products,basket,stores,now=Date.now()){
 const all=new Map(products.map(p=>[p.id,p]));
 const priced=new Map(pricedCatalog(products,stores.map(s=>s.id),now).map(p=>[p.id,p]));
 const rows=Object.entries(basket).filter(([,q])=>Number.isInteger(q)&&q>=1&&q<=99).map(([id,quantity])=>{
  const product=all.get(id),offers=Object.fromEntries((priced.get(id)?.offers||[]).map(o=>[o.storeId,{...o,lineCents:o.cents*quantity}]));
  return {id,name:product?.name||id,product,quantity,offers};
 });
 const totals=stores.map(store=>{
  const covered=rows.filter(row=>row.offers[store.id]);
  return {store,pricedCount:covered.length,pricedUnits:covered.reduce((sum,r)=>sum+r.quantity,0),
   cents:covered.length?covered.reduce((sum,r)=>sum+r.offers[store.id].lineCents,0):null,
   complete:rows.length>0&&covered.length===rows.length,missingIds:rows.filter(r=>!r.offers[store.id]).map(r=>r.id)};
 });
 const pricedStores=totals.filter(s=>s.pricedCount).sort((a,b)=>Number(b.complete)-Number(a.complete)||(b.pricedCount-a.pricedCount)||a.store.id.localeCompare(b.store.id));
 const complete=pricedStores.filter(s=>s.complete);
 const lowestFull=complete.length>=2?Math.min(...complete.map(s=>s.cents)):null;

 // Find the largest same-product subset shared by at least two selected branches.
 // Choose coverage before price; never fill a gap using a different branch or SKU.
 /** @type {typeof rows} */
 let sharedRows=[];
 for(let a=0;a<pricedStores.length;a++)for(let b=a+1;b<pricedStores.length;b++){
  const common=rows.filter(r=>r.offers[pricedStores[a].store.id]&&r.offers[pricedStores[b].store.id]);
  if(common.length>sharedRows.length)sharedRows=common;
 }
 const sharedStores=sharedRows.length?pricedStores.filter(s=>sharedRows.every(r=>r.offers[s.store.id])).map(s=>({
  store:s.store,cents:sharedRows.reduce((sum,r)=>sum+r.offers[s.store.id].lineCents,0)
 })).sort((a,b)=>a.cents-b.cents||a.store.id.localeCompare(b.store.id)):[];
 return {rows,totals,pricedStores,unpricedStores:totals.filter(s=>!s.pricedCount),
  itemCount:rows.reduce((sum,r)=>sum+r.quantity,0),lineCount:rows.length,
  bestFullStoreIds:lowestFull===null?[]:complete.filter(s=>s.cents===lowestFull).map(s=>s.store.id),
  shared:{rows:sharedRows,stores:sharedStores,itemCount:sharedRows.reduce((sum,r)=>sum+r.quantity,0),
   savingsCents:sharedStores.length>=2?sharedStores[1].cents-sharedStores[0].cents:0}};
}
