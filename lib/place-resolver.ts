import places from '../data/places.json';
import {lookupPlace,regionForPoint,distanceMiles} from './nearby.mjs';
export type Location={query:string;label:string;postalCode:string|null;regionId:string;cityId:string;city:string;state:string;lat:number;lon:number;source:string};
const cache=new Map<string,{location:Location;expires:number}>();
export async function resolveLocation(input:string):Promise<Location|null>{
 const query=input.trim().slice(0,80),known=lookupPlace(query,places);
 if(known)return known as Location;
 if(!/^\d{5}$/.test(query))return null;
 const cached=cache.get(query);if(cached&&cached.expires>Date.now())return cached.location;
 const url='https://api.zippopotam.us/us/'+query;
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(2200)});
  if(!response.ok)return null;
  const data=await response.json() as {places?:Array<{'place name':string;'state abbreviation':string;latitude:string;longitude:string}>};
  const p=data.places?.[0];if(!p)return null;
  const point={lat:Number(p.latitude),lon:Number(p.longitude)},regionId=regionForPoint(point);
  if(!regionId)return null;
  const nearest=Object.values(places.cities).filter(c=>c.regionId===regionId).sort((a,b)=>distanceMiles(point,a)-distanceMiles(point,b))[0];
  const location:Location={query,label:query+' · '+p['place name'],postalCode:query,regionId,cityId:nearest.cityId,city:p['place name'],state:p['state abbreviation'],...point,source:url};
  if(cache.size>=100)cache.delete(cache.keys().next().value!);
  cache.set(query,{location,expires:Date.now()+3600000});return location;
 }catch{return null}
}
