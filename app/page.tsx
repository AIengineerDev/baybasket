import GroceryApp from '../components/grocery-app';
import {resolveLocation} from '../lib/place-resolver';
import places from '../data/places.json';
import {DEFAULT_RADIUS} from '../lib/nearby.mjs';
import {liveProducts} from '../lib/catalog';
import {parseBasket} from '../lib/basket-comparison.mjs';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const near=typeof params.near==='string'?params.near:typeof params.city==='string'?params.city:params.region==='silicon-valley'?'San Jose':params.region==='san-francisco'?'San Francisco':'Tampa';
 const location=await resolveLocation(near);
 const radius=[5,10,20,30].includes(Number(params.radius))?Number(params.radius):DEFAULT_RADIUS;
 return <GroceryApp initialLocation={location||places.cities.tampa} initialRadius={radius} initialNow={Date.now()} initialBasket={parseBasket(params.basket,liveProducts)} initialView={params.view==='basket'?'basket':'explore'} initialError={location?'':'That location could not be resolved. Showing Tampa; enter a supported ZIP code or city.'}/>;
}
