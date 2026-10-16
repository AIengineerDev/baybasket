import snapshot from '../../../data/discovered.json';
import {liveStores} from '../../../lib/catalog';
import {nearestPerChain,DEFAULT_RADIUS} from '../../../lib/nearby.mjs';
import {resolveLocation} from '../../../lib/place-resolver';
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const location=await resolveLocation(params.get('near')||params.get('city')||'Tampa');
 if(!location)return Response.json({error:'Choose a supported ZIP code or city.'},{status:400});
 const radius=[5,10,20,30].includes(Number(params.get('radius')))?Number(params.get('radius')):DEFAULT_RADIUS;
 const candidates=snapshot.stores.filter(s=>s.name!=='Unnamed store');
 const run=snapshot.runs.find(r=>r.region===location.regionId);
 return Response.json({stores:nearestPerChain(candidates,location,radius),connectedStores:nearestPerChain(liveStores,location,radius),location,radiusMiles:radius,cached:true,
 warning:run?.status==='error'?'The store directory could not be refreshed. Collected price sources below are available.':''},
 {headers:{'Cache-Control':'private, max-age=60'}});
}
