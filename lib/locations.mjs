export const regions = [
  {id:'tampa-bay', name:'Tampa Bay', state:'FL', timeZone:'America/New_York', cities:[
    {id:'tampa',name:'Tampa'}, {id:'clearwater',name:'Clearwater'},
    {id:'st-petersburg',name:'St. Petersburg'}, {id:'wesley-chapel',name:'Wesley Chapel'},
    {id:'brandon',name:'Brandon'},
  ]},
  {id:'silicon-valley', name:'Silicon Valley', state:'CA', timeZone:'America/Los_Angeles', cities:[
    {id:'san-jose',name:'San Jose'}, {id:'santa-clara',name:'Santa Clara'},
    {id:'sunnyvale',name:'Sunnyvale'}, {id:'mountain-view',name:'Mountain View'},
    {id:'cupertino',name:'Cupertino'}, {id:'redwood-city',name:'Redwood City'},
  ]},
  {id:'san-francisco', name:'San Francisco', state:'CA', timeZone:'America/Los_Angeles', cities:[
    {id:'san-francisco',name:'San Francisco'},
  ]},
];
export const DEFAULT_REGION = 'tampa-bay';
export function validLocation(regionId, cityId = '') {
  const region = regions.find(region => region.id === regionId);
  return Boolean(region && (!cityId || region.cities.some(city => city.id === cityId)));
}
export function storesForLocation(stores, regionId, cityId = '') {
  return stores.filter(store => store.regionId === regionId && (!cityId || store.cityId === cityId));
}
export function restrictOffers(products, storeIds) {
  const allowed = new Set(storeIds);
  return products.map(product => ({...product, offers:product.offers.filter(offer => allowed.has(offer.storeId))}))
    .filter(product => product.offers.length > 0);
}
export function citySlug(city) {
  return city.toLowerCase().replace(/\bst[.]?\s+/g,'saint ').replace(/\bst\.?-/g,'saint-')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export function filterDiscovery(stores, regionId, cityId = '') {
  const region = regions.find(region => region.id === regionId);
  const name = region?.cities.find(city => city.id === cityId)?.name;
  return stores.filter(store => store.regionId === regionId && (!cityId || (name && citySlug(store.city) === citySlug(name))));
}
