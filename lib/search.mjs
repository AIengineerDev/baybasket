import {isUsableOffer} from './pricing.mjs';
// Build once per browser session / Worker isolate, never once per query.
export const tokens = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
export function buildIndex(products) {
  const postings=new Map(); const byId=new Map(); const byStore=new Map();
  for(const p of products){
    byId.set(p.id,p);
    for(const offer of p.offers || []) {
      if(!byStore.has(offer.storeId))byStore.set(offer.storeId,new Set());
      byStore.get(offer.storeId).add(p.id);
    }
    for(const word of new Set(tokens(p.name+' '+p.brand+' '+p.category))){
      for(let n=1;n<=word.length;n++){
        const prefix=word.slice(0,n); if(!postings.has(prefix))postings.set(prefix,new Set());
        postings.get(prefix).add(p.id);
      }
    }
  }
  return {postings,byId,byStore,storeScopes:new Map()};
}
export function search(index, query, category='All', limit=30, options={}) {
  if(options.storeId && options.storeIds !== undefined && !options.storeIds.includes(options.storeId))return [];
  const terms=[...new Set(tokens(query))];
  const lists=terms.map(t=>index.postings.get(t)||new Set());
  if(options.storeIds !== undefined) {
    const ids=[...new Set(options.storeIds)].sort(),key=ids.join('|');
    if(!index.storeScopes.has(key)) {
      const candidates=new Set();
      for(const store of ids)for(const id of index.byStore.get(store)||[])candidates.add(id);
      if(index.storeScopes.size>=64)index.storeScopes.delete(index.storeScopes.keys().next().value);
      index.storeScopes.set(key,candidates);
    }
    lists.push(index.storeScopes.get(key));
  }
  if(options.storeId)lists.push(index.byStore.get(options.storeId)||new Set());
  lists.sort((a,b)=>a.size-b.size);
  const candidates=lists.length?lists[0]:index.byId.keys(); const found=[];
  for(const id of candidates){
    if(!lists.every(l=>l.has(id)))continue;
    const p=index.byId.get(id); if(category!=='All'&&p.category!==category)continue;
    if(options.storeId&&!p.offers?.some(o=>o.storeId===options.storeId))continue;
    found.push(p); if(found.length>=limit)break;
  }
  return found;
}
export function basketTotals(products,basket,stores,now=Date.now()){
  const productMap=new Map(products.map(p=>[p.id,p]));
  return stores.map(store=>{
    let cents=0;const missing=[];
    for(const [id,quantity] of Object.entries(basket)){
      const p=productMap.get(id);const offer=p?.offers.find(o=>o.storeId===store.id&&isUsableOffer(o,now));
      if(!offer)missing.push(p?.name||id);else cents+=offer.cents*quantity;
    }
    return {...store,cents,missing,complete:!missing.length};
  }).sort((a,b)=>Number(b.complete)-Number(a.complete)||a.cents-b.cents);
}
