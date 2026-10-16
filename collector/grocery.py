#!/usr/bin/env python3
"""Python 3.10+; standard library only. See README.md for coverage limitations."""
import argparse
import json
import os
import sqlite3
import time
import urllib.request
import urllib.parse
import urllib.robotparser
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path

UA = 'TampaGroceryResearch/0.1'
COUNTIES = ['Hillsborough', 'Pinellas', 'Pasco', 'Hernando']

def now():
    return datetime.now(timezone.utc).isoformat()

def fetch(url, data=None, headers=None):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=55) as response:
                return response.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code not in (429, 502, 503, 504) or attempt == 2:
                raise RuntimeError(f'HTTP {e.code}; source unavailable') from None
            time.sleep(2 ** attempt)
    raise RuntimeError('Request failed')

def connect(path):
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript('''
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY, name TEXT, chain TEXT, address TEXT,
      lat REAL, lon REAL, website TEXT, discovered_at TEXT);
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY, store_id TEXT, product_key TEXT, name TEXT,
      package TEXT, cents INTEGER, currency TEXT, channel TEXT,
      available INTEGER, observed_at TEXT, source_url TEXT,
      UNIQUE(store_id, product_key, channel, observed_at));
    CREATE TABLE IF NOT EXISTS runs (
      time TEXT, source TEXT, status TEXT, detail TEXT);
    ''')
    return db

def discover(db):
    counties = '|'.join(COUNTIES)
    query = f'''[out:json][timeout:45];
    area["ISO3166-2"="US-FL"]["boundary"="administrative"]->.fl;
    area(area.fl)["admin_level"="6"]["name"~"^({counties}) County$"]->.region;
    nwr(area.region)["shop"~"^(supermarket|grocery|convenience|greengrocer|wholesale|general|department_store|variety_store)$"];
    out center tags;'''
    payload = json.loads(fetch('https://overpass-api.de/api/interpreter',
                              urllib.parse.urlencode({'data':query}).encode()))
    if payload.get('remark'):
        raise RuntimeError('Overpass returned a partial/error response: '+payload['remark'])
    rows = []
    for e in payload.get('elements', []):
        t = e.get('tags', {})
        center = e.get('center', e)
        address = ' '.join(t.get(k, '') for k in ['addr:housenumber','addr:street','addr:city','addr:postcode']).strip()
        rows.append((f"osm:{e['type']}:{e['id']}", t.get('name','Unnamed store'),
                     t.get('brand', t.get('operator','Independent / unclassified')),
                     address, center.get('lat'), center.get('lon'),
                     t.get('website', t.get('contact:website','')), now()))
    db.executemany('INSERT OR REPLACE INTO stores VALUES (?,?,?,?,?,?,?,?)', rows)
    db.commit()
    return len(rows)

def normalize(row):
    for key in ('store_id','product_key','name','package','price','currency','channel','available','observed_at','source_url'):
        if key not in row:
            raise ValueError('Missing field: '+key)
    if row['currency'] != 'USD' or row['channel'] not in ('in_store','pickup','delivery','online'):
        raise ValueError('USD and a supported channel are required')
    if not isinstance(row['available'], bool):
        raise ValueError('available must be true or false')
    amount = Decimal(str(row['price']))
    if not amount.is_finite() or amount < 0 or amount*100 != (amount*100).to_integral_value():
        raise ValueError('Price must be nonnegative with at most two decimal places')
    ts = datetime.fromisoformat(row['observed_at'].replace('Z','+00:00'))
    if ts.tzinfo is None or ts > datetime.now(timezone.utc)+timedelta(minutes=5):
        raise ValueError('observed_at must be timezone aware and not in the future')
    for k in ('store_id','product_key','name','package','source_url'):
        if not isinstance(row[k], str) or not row[k].strip():
            raise ValueError('Empty or invalid '+k)
    return (row['store_id'],row['product_key'],row['name'],row['package'],int(amount*100),
            'USD',row['channel'],int(row['available']),ts.astimezone(timezone.utc).isoformat(),row['source_url'])

def ingest(db, rows):
    normalized = [normalize(r) for r in rows]
    for r in normalized:
        if not db.execute('SELECT 1 FROM stores WHERE id=?',(r[0],)).fetchone():
            raise ValueError('Unknown store_id: '+r[0])
    with db:
        db.executemany('''INSERT OR IGNORE INTO offers
        (store_id,product_key,name,package,cents,currency,channel,available,observed_at,source_url)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',normalized)
    return len(normalized)

class LDParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.active=False; self.parts=[]; self.docs=[]
    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('type','').lower() == 'application/ld+json':
            self.active=True; self.parts=[]
    def handle_data(self, data):
        if self.active: self.parts.append(data)
    def handle_endtag(self, tag):
        if tag == 'script' and self.active:
            self.active=False
            try: self.docs.append(json.loads(''.join(self.parts)))
            except json.JSONDecodeError: pass

def walk(obj):
    if isinstance(obj, dict):
        yield obj
        for value in obj.values(): yield from walk(value)
    elif isinstance(obj, list):
        for value in obj: yield from walk(value)

def page_rows(html, source):
    parser=LDParser(); parser.feed(html)
    rows=[]
    for product in walk(parser.docs):
        typ=product.get('@type',[])
        if 'Product' not in ([typ] if isinstance(typ,str) else typ): continue
        # Exact SKU matching prevents accepting recommendations elsewhere on the page.
        if str(product.get('sku','')) != str(source['sku']): continue
        offers=product.get('offers',[])
        if isinstance(offers,dict): offers=[offers]
        for offer in offers:
            if not isinstance(offer,dict) or 'price' not in offer: continue
            availability=offer.get('availability','').split('/')[-1]
            if availability not in ('InStock','OutOfStock','SoldOut'): continue
            expiry=offer.get('priceValidUntil')
            if expiry and expiry[:10] < datetime.now(timezone.utc).date().isoformat(): continue
            rows.append(dict(store_id=source['store_id'],product_key=source['product_key'],
                name=product.get('name',''),package=source['package'],price=offer['price'],
                currency=offer.get('priceCurrency'),channel=source['channel'],
                available=availability=='InStock',observed_at=now(),source_url=source['url']))
    if len(rows) != 1:
        raise ValueError('Expected one exact-SKU offer with explicit availability; got '+str(len(rows)))
    return rows

def collect(db, config):
    for source in config.get('sources',[]):
        label=source.get('name','unnamed'); count=0
        try:
            if source['type']=='feed':
                headers={}
                if source.get('token_env'):
                    token=os.environ.get(source['token_env'])
                    if not token: raise ValueError('Missing token environment variable')
                    headers['Authorization']='Bearer '+token
                rows=json.loads(fetch(source['url'],headers=headers))
            elif source['type']=='jsonld':
                if not source.get('store_context_verified'):
                    raise ValueError('Store-specific page context must be verified before collection')
                robot=urllib.robotparser.RobotFileParser()
                robots_url=urllib.parse.urljoin(source['url'],'/robots.txt')
                robot.parse(fetch(robots_url).splitlines())
                if not robot.can_fetch(UA,source['url']): raise ValueError('robots.txt disallows fetch')
                delay=max(2,robot.crawl_delay(UA) or 0)
                time.sleep(delay)
                rows=page_rows(fetch(source['url']),source)
            else: raise ValueError('Unknown source type')
            count=ingest(db,rows); status='ok'; detail=f'{count} validated observations'
        except Exception as e:
            status='error'; detail=type(e).__name__
            # Do not log URLs, tokens, or provider response bodies.
        db.execute('INSERT INTO runs VALUES (?,?,?,?)',(now(),label,status,detail)); db.commit()
        print(json.dumps({'source':label,'status':status,'detail':detail}))

def compare(db,basket,channel,max_age):
    if not basket or any(type(q) is not int or q<=0 for q in basket.values()):
        raise ValueError('Basket must map exact product keys to positive integer package quantities')
    cutoff=(datetime.now(timezone.utc)-timedelta(hours=max_age)).isoformat()
    rows=db.execute('''SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER(PARTITION BY store_id,product_key,channel ORDER BY observed_at DESC,id DESC) AS rn
      FROM offers WHERE channel=?) WHERE rn=1 AND available=1 AND observed_at>=?''',(channel,cutoff)).fetchall()
    prices={(r['store_id'],r['product_key']):r for r in rows}
    result=[]
    for s in db.execute('SELECT * FROM stores ORDER BY name'):
        missing=[]; total=0; lines=[]
        for key,quantity in basket.items():
            r=prices.get((s['id'],key))
            if r is None: missing.append(key); continue
            total+=r['cents']*quantity
            lines.append({'product_key':key,'quantity':quantity,'package':r['package'],
                          'price':f"{r['cents']/100:.2f}",'observed_at':r['observed_at'],'source_url':r['source_url']})
        result.append({'store_id':s['id'],'store':s['name'],'channel':channel,
                       'complete':not missing,'total':f'{total/100:.2f}' if not missing else None,
                       'known_subtotal':f'{total/100:.2f}','missing':missing,'items':lines})
    return sorted(result,key=lambda r:(not r['complete'],Decimal(r['total'] or 'Infinity'),r['store']))

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--db',default='grocery.sqlite')
    sub=p.add_subparsers(dest='cmd',required=True)
    sub.add_parser('discover'); sub.add_parser('coverage')
    for cmd in ('import-stores','import-prices','collect'):
        sub.add_parser(cmd).add_argument('file')
    b=sub.add_parser('basket'); b.add_argument('file'); b.add_argument('--channel',default='in_store',choices=['in_store','pickup','delivery','online']); b.add_argument('--max-age-hours',type=float,default=24)
    args=p.parse_args(); db=connect(args.db)
    if args.cmd=='discover': print(json.dumps({'discovered':discover(db),'counties':COUNTIES}))
    elif args.cmd=='import-stores':
        rows=json.loads(Path(args.file).read_text())
        with db:
            for r in rows:
                db.execute('INSERT OR REPLACE INTO stores VALUES (?,?,?,?,?,?,?,?)',
                    (r['id'],r['name'],r.get('chain',''),r.get('address',''),r.get('lat'),r.get('lon'),r.get('website',''),now()))
        print(f'Imported {len(rows)} stores')
    elif args.cmd=='import-prices': print(ingest(db,json.loads(Path(args.file).read_text())))
    elif args.cmd=='collect': collect(db,json.loads(Path(args.file).read_text()))
    elif args.cmd=='basket':
        if args.max_age_hours<=0: p.error('max-age-hours must be positive')
        print(json.dumps(compare(db,json.loads(Path(args.file).read_text()),args.channel,args.max_age_hours),indent=2))
    elif args.cmd=='coverage':
        stores=[dict(r) for r in db.execute('''SELECT s.*,COUNT(o.id) observations,MAX(o.observed_at) last_price
          FROM stores s LEFT JOIN offers o ON s.id=o.store_id GROUP BY s.id''')]
        print(json.dumps({'warning':'OSM discovery is incomplete; observation counts are historical, not proof of current coverage.',
                          'stores':stores,'runs':[dict(r) for r in db.execute('SELECT * FROM runs')]},indent=2))

if __name__=='__main__': main()
