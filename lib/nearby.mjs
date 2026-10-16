const radians=n=>n*Math.PI/180;
export const DEFAULT_RADIUS=20;
export const normalized=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/\bst[.]?\s+/g,'saint ').replace(/[^a-z0-9]+/g,' ').trim();
export function distanceMiles(a,b){
 const lat=radians(b.lat-a.lat),lon=radians(b.lon-a.lon);
 const h=Math.sin(lat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lon/2)**2;
 return 3958.7613*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function lookupPlace(query,places){
 const value=String(query||'').trim();
 if(/^\d{5}$/.test(value))return places.postalCodes[value]||null;
 const key=normalized(value);
 return Object.values(places.cities).find(p=>[p.city,p.label,p.cityId,p.city+' '+p.state].some(s=>normalized(s)===key))||null;
}
export function regionForPoint(point){
 if(point.lat>=27.5&&point.lat<=28.7&&point.lon>=-83&&point.lon<=-81.8)return 'tampa-bay';
 if(point.lat>=37.1&&point.lat<=37.95&&point.lon>=-122.65&&point.lon<=-121.5)return point.lat>=37.70&&point.lon<=-122.35?'san-francisco':'silicon-valley';
 return null;
}
export function chainKey(store){
 const chain=store.chain&&store.chain!=='Independent / unclassified'?store.chain:store.name;
 return normalized(chain||store.id).replace(/supermarkets?$/,'').trim();
}
export function nearestPerChain(stores,origin,radius=DEFAULT_RADIUS){
 if(!origin||!Number.isFinite(origin.lat)||!Number.isFinite(origin.lon))return [];
 const candidates=stores.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&(!s.state||s.state===origin.state))
  .map(s=>({...s,distanceMiles:distanceMiles(origin,s)})).filter(s=>s.distanceMiles<=radius)
  .sort((a,b)=>a.distanceMiles-b.distanceMiles||a.id.localeCompare(b.id));
 const chains=new Map();
 for(const store of candidates){const key=chainKey(store);if(key&&!chains.has(key))chains.set(key,store)}
 return [...chains.values()];
}
