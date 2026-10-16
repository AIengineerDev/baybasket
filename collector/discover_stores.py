#!/usr/bin/env python3
"""Refresh regional OSM discovery. These records are not price connections."""
import argparse,json,urllib.parse,urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REGIONS={
 'tampa-bay':('US-FL','Hillsborough|Pinellas|Pasco|Hernando','Tampa Bay'),
 'silicon-valley':('US-CA','Santa Clara|San Mateo','Silicon Valley'),
 'san-francisco':('US-CA','San Francisco','San Francisco'),
}

def collect(region,endpoint='https://overpass-api.de/api/interpreter'):
 state,counties,label=REGIONS[region]
 area=f'''
 area["ISO3166-2"="{state}"]["boundary"="administrative"]->.s;
 area(area.s)["admin_level"="6"]["name"~"^({counties})( County)?$"]->.r;'''
 # Verified county tags avoid expensive containment scans across California.
 if region=='silicon-valley':area='area["admin_level"="6"]["wikipedia"~"^en:(Santa Clara|San Mateo) County, California$"]->.r;'
 if region=='san-francisco':area='area["admin_level"="6"]["name"="San Francisco"]["county:ansi"="075"]->.r;'
 query=f'''[out:json][timeout:30];{area}
 nwr(area.r)["shop"~"^(supermarket|grocery|convenience|greengrocer|wholesale|general|department_store|variety_store)$"];
 out center tags;'''
 try:
  req=urllib.request.Request(endpoint,
   data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'BayBasketResearch/0.2'})
  with urllib.request.urlopen(req,timeout=45) as response:data=json.load(response)
  if data.get('remark') or not data.get('elements'):raise ValueError('Incomplete or empty discovery response')
  stores=[]
  for e in data['elements']:
   t=e.get('tags',{});center=e.get('center',{})
   stores.append(dict(id=f"osm:{e['type']}:{e['id']}",name=t.get('name','Unnamed store'),
    chain=t.get('brand','Independent / unclassified'),city=t.get('addr:city',label),regionId=region,
    lat=e.get('lat',center.get('lat')),lon=e.get('lon',center.get('lon')),priceStatus='Not connected'))
  return region,stores,dict(region=region,status='ok',count=len(stores),endpoint=endpoint,observedAt=datetime.now(timezone.utc).isoformat())
 except Exception as e:
  return region,None,dict(region=region,status='error',detail=f'{type(e).__name__}: {str(e)[:120]}')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--regions',nargs='+',choices=REGIONS,default=list(REGIONS))
 parser.add_argument('--endpoint',choices=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter'],default='https://overpass-api.de/api/interpreter')
 args=parser.parse_args();out=ROOT/'data/discovered.json';prior=json.loads(out.read_text()) if out.exists() else {}
 stores=[dict(s,regionId=s.get('regionId','tampa-bay')) for s in prior.get('stores',[])]
 runs=[];observations=prior.get('regionObservedAt',{'tampa-bay':prior.get('observedAt')})
 with ThreadPoolExecutor(2) as pool:
  for region,items,run in pool.map(lambda region:collect(region,args.endpoint),args.regions):
   runs.append(run);print(json.dumps(run),flush=True)
   if items is not None:
    stores=[s for s in stores if s['regionId']!=region]+items;observations[region]=run['observedAt']
 snapshot=dict(stores=stores,observedAt=max((v for v in observations.values() if v),default=None),
  regionObservedAt=observations,runs=runs,source='OpenStreetMap / Overpass',license='ODbL',
  scope='Discovery only; general and convenience retailers included. No prices inferred.')
 temp=out.with_suffix('.tmp');temp.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')));temp.replace(out)

if __name__=='__main__':main()
