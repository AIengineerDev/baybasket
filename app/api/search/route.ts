import {buildIndex,search} from '../../../lib/search.mjs';
import {demoProducts,liveProducts,stores,liveStores} from '../../../lib/catalog';
import {priceClock,pricedCatalog,rankPricedProducts} from '../../../lib/pricing.mjs';
import {nearestPerChain,DEFAULT_RADIUS} from '../../../lib/nearby.mjs';
import {resolveLocation} from '../../../lib/place-resolver';
const demo=buildIndex(demoProducts),live=buildIndex(liveProducts);
export async function GET(request:Request){
 const start=performance.now(),u=new URL(request.url),mode=u.searchParams.get('mode')==='demo'?'demo':'live';
 const q=(u.searchParams.get('q')||'').slice(0,100),category=u.searchParams.get('category')||'All';
 const near=u.searchParams.get('near')||u.searchParams.get('zip')||u.searchParams.get('city')||(u.searchParams.get('region')==='san-francisco'?'San Francisco':u.searchParams.get('region')==='silicon-valley'?'San Jose':'Tampa');
 const location=await resolveLocation(near);
 if(!location)return Response.json({error:'Choose a supported ZIP code or city.'},{status:400});
 const radius=[5,10,20,30].includes(Number(u.searchParams.get('radius')))?Number(u.searchParams.get('radius')):DEFAULT_RADIUS;
 const selectedStores=mode==='demo'?stores:nearestPerChain(liveStores,location,radius);
 const store=u.searchParams.get('store')||'';
 if(store&&!selectedStores.some((s:{id:string})=>s.id===store))return Response.json({error:'This branch is not one of the selected nearby grocers.'},{status:400});
 const storeIds=selectedStores.map((s:{id:string})=>s.id);
 const limit=Math.min(120,Math.max(1,Number(u.searchParams.get('limit'))||30));
 const comparisonsOnly=u.searchParams.get('comparisons')==='true';
 const clock=mode==='demo'?{at:Date.now(),stale:false,asOf:null}:priceClock(liveProducts);
 const priced=pricedCatalog(search(mode==='demo'?demo:live,q,category,5000,{storeId:store,storeIds}),storeIds,clock.at);
 const matches=rankPricedProducts(priced,{storeId:store,comparisonsOnly});
 const products=matches.slice(0,limit);
 return Response.json({products,totalMatches:matches.length,comparableMatches:priced.filter(p=>p.offers.length>=2).length,comparisonsOnly,mode,location,radiusMiles:radius,selectionPolicy:'nearest-collected-branch-per-chain',pricePolicy:'in-stock-fixed-price-observed-within-24-hours',stalePrices:clock.stale,pricesAsOf:clock.asOf,stores:storeIds,selectedStores,serverMs:Math.round((performance.now()-start)*100)/100},
 {headers:{'Cache-Control':'private, max-age=30','Server-Timing':`search;dur=${(performance.now()-start).toFixed(2)}`}});
}
