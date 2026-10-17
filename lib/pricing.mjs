export const PRICE_TTL_MS=24*60*60*1000;

// One eligibility rule for product cards, quote rows, the API and basket totals.
export function isUsableOffer(offer,now=Date.now()){
 const observed=Date.parse(offer?.observedAt);
 return offer?.available===true&&!offer.estimated&&Number.isSafeInteger(offer.cents)&&offer.cents>0
  &&Number.isFinite(observed)&&observed<=now&&now-observed<PRICE_TTL_MS;
}

// The time offers are judged at. Normally now; when every offer in the snapshot is older than the TTL,
// judge them as of the newest observation instead of hiding the whole catalog, and say so (stale + asOf).
export function priceClock(products,now=Date.now()){
 let newest=-Infinity;
 for(const product of products)for(const offer of product.offers||[]){
  const observed=Date.parse(offer?.observedAt);
  if(Number.isFinite(observed)&&observed<=now&&observed>newest)newest=observed;
 }
 if(!Number.isFinite(newest)||now-newest<PRICE_TTL_MS)return {at:now,stale:false,asOf:null};
 return {at:newest,stale:true,asOf:new Date(newest).toISOString()};
}

export function pricedCatalog(products,storeIds,now=Date.now()){
 const allowed=new Set(storeIds),result=[];
 for(const product of products){
  const byStore=new Map();
  for(const offer of product.offers||[]){
   if(!allowed.has(offer.storeId)||!isUsableOffer(offer,now))continue;
   const previous=byStore.get(offer.storeId);
   if(!previous||Date.parse(offer.observedAt)>Date.parse(previous.observedAt))byStore.set(offer.storeId,offer);
  }
  if(byStore.size)result.push({...product,offers:[...byStore.values()]});
 }
 return result;
}

export function quoteRows(product,stores,now=Date.now()){
 if(!product)return [];
 const byId=new Map(stores.map(store=>[store.id,store]));
 const priced=pricedCatalog([product],[...byId.keys()],now)[0];
 return (priced?.offers||[]).map(offer=>({store:byId.get(offer.storeId),offer}))
  .sort((a,b)=>a.offer.cents-b.offer.cents||a.store.id.localeCompare(b.store.id));
}

export function rankPricedProducts(products,{storeId='',comparisonsOnly=false}={}){
 return products.filter(p=>(!comparisonsOnly||p.offers.length>=2)&&(!storeId||p.offers.some(o=>o.storeId===storeId)))
  .sort((a,b)=>b.offers.length-a.offers.length);
}
