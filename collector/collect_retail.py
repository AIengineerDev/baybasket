#!/usr/bin/env python3
"""Collect a bounded real catalog from public store pages, not search-time scraping.
No authentication, private endpoints, browser fingerprints, or fabricated prices.
Run: python3 collector/collect_retail.py --download-images
"""
import argparse,hashlib,html,json,re,time,urllib.request,urllib.parse,urllib.robotparser
from pathlib import Path
from datetime import datetime,timezone
from decimal import Decimal
from robots_rules import Rules
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
UA='BayBasketResearch/0.2'

def timestamp():return datetime.now(timezone.utc).isoformat()
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA})
    with urllib.request.urlopen(req,timeout=30) as r:
        body=r.read(8_000_001)
        if len(body)>8_000_000:raise ValueError('Response too large')
        return body

def robots(origin):
    return Rules(get(origin+'/robots.txt').decode())

def unwrap(x):
    if isinstance(x,dict):
        if '_type' in x and 'data' in x:return unwrap(x['data'])
        return {k:unwrap(v) for k,v in x.items()}
    if isinstance(x,list):return [unwrap(v) for v in x]
    return x

def next_data(body):
    m=re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',body,re.S)
    if not m:raise ValueError('Expected public page data missing')
    return unwrap(json.loads(m[1]))

def cents(price):
    value=Decimal(str(price))
    if not value.is_finite() or value<=0 or value*100!=(value*100).to_integral_value():raise ValueError('Invalid unit price')
    return int(value*100)

def category(text):
    t=text.lower()
    for name,words in [('Dairy',['milk','butter','cheese','yogurt','eggs']),('Produce',['fruit','vegetable','strawberr','avocado','broccoli','spinach','pineapple','cabbage']),('Meat & seafood',['chicken','beef','pork','bacon','sausage','turkey','shellfish','seafood','salmon','deli meats']),('Bakery',['bread','bagel','cake','donut','pastries','muffin','rolls and buns']),('Frozen',['frozen','ice cream','pizza','waffle','pancake']),('Beverages',['drink','water','juice','tea','coffee'])]:
        if any(w in t for w in words):return name
    return 'Pantry'

def size(name):
    # Human-readable label only. Identity remains retailer's exact product ID.
    m=re.search(r'\b\d+(?:\.\d+)?\s*(?:fl\.?\s*oz|fluid ounces?|ounces?|oz|pounds?|lb|gallon|grams?|count|ct)(?:\s*/\s*\d+\s*ct)?\b',name,re.I)
    return m[0] if m else ('each' if re.search(r'\beach\b',name,re.I) else 'See product for package size')

def target_products(body,store,observed):
    frames=[]
    for m in re.finditer(r'self\.__next_f\.push\((\[.*?\])\)',body,re.S):
        try:
            a=json.loads(m[1])
            if len(a)>1 and isinstance(a[1],str):frames.append(a[1])
        except (ValueError,TypeError):pass
    text=''.join(frames);decoder=json.JSONDecoder();out={};skipped=0
    for m in re.finditer(r'\{"__typename":"ProductSummary"',text):
        try:
            p=decoder.raw_decode(text[m.start():])[0];item=p['item'];price=p.get('price',{})
            cls=item.get('product_classification',{}).get('item_type',{}).get('name','')
            # General store landing pages also list clothes/toys: only explicitly
            # configured food classifications may pass for those sources.
            if store.get('groceryTypes') is not None and cls not in store['groceryTypes']:continue
            # Skip parent variants, price ranges, defaults and records without exact store context.
            if 'current_retail' not in price or price.get('is_current_price_range') or price.get('default_price'):continue
            options=p.get('fulfillment',{}).get('store_options',[])
            loc=next((x for x in options if str(x.get('location_id'))==store['id']),None)
            if not loc:continue
            stock=loc.get('order_pickup',{}).get('availability_status')
            if stock not in ('IN_STOCK','OUT_OF_STOCK','UNAVAILABLE'):continue
            img=item.get('enrichment',{}).get('image_info',{}).get('primary_image',{}).get('url')
            if not img or not img.startswith('https://target.scene7.com/'):continue
            name=html.unescape(item['product_description']['title']);pid='target:'+p['tcin']
            product_url=item.get('enrichment',{}).get('buy_url','')
            if not product_url.startswith('https://www.target.com/'):continue
            out[pid]=dict(id=pid,name=name,brand='Target catalog',category=category(cls+' '+name),size=size(name),icon='🛒',
                imageUrl=img+'?wid=360&hei=360&fmt=jpeg',imageSource=img,
                offers=[dict(storeId='target:'+store['id'],cents=cents(price['current_retail']),available=stock=='IN_STOCK',
                    observedAt=observed,sourceUrl=store['url'],productUrl=product_url,channel='pickup',
                    availability=stock,priceType=price.get('formatted_current_price_type','regular'),
                    unitPrice=(price.get('formatted_unit_price','')+price.get('formatted_unit_price_suffix','')).replace('$$','$'),
                    evidence='Exact Target product and fulfillment location IDs on public store page',
                    estimated=False)])
        except (KeyError,ValueError,TypeError,StopIteration):skipped+=1
    if not out:raise ValueError('No exact store-linked offers; parser/source needs review')
    return list(out.values())

def mercato_product(body,store,observed,url,expected_id=None):
    state=next_data(body)['props']['pageProps']['initialState']['productDetails']
    p=state['productModalRaw']
    if not p or str(p.get('storeId'))!=store['id']:raise ValueError('Store mismatch')
    if expected_id is not None and str(p.get('actualProductId'))!=str(expected_id):raise ValueError('Product mismatch')
    if not isinstance(p.get('inStock'),bool):raise ValueError('Unknown inventory')
    if p.get('notAvailableInArea'):raise ValueError('Not available in selected area')
    image=p.get('imageUrl','')
    if not image.startswith('https://d2sg5tibg946xl.cloudfront.net/'):raise ValueError('Image host mismatch')
    name=html.unescape(p['name']);pid='mercato:'+str(p['actualProductId'])
    return dict(id=pid,name=name,brand=p.get('brand') or store.get('chain',store['name'])+' catalog',category=category(name),
        size=size(name),icon='🛒',imageUrl=image,imageSource=image,
        offers=[dict(storeId='mercato:'+store['id'],cents=cents(p['price']),available=p['inStock'] and not p.get('notAvailable',False),
            observedAt=observed,sourceUrl=url,productUrl='https://www.mercato.com'+p['longUrl'],channel='online',
            availability='IN_STOCK' if p['inStock'] else 'OUT_OF_STOCK',priceType='Marketplace',
            unitPrice=p.get('priceDisplay',''),estimated=bool(p.get('estimate')) or p.get('productPricingType')!='unit',
            evidence='Exact Mercato store ID and item offer; marketplace price, not a shelf price')])

def collect_target(stores):
    products=[];connected=[];runs=[];rp=robots('https://www.target.com')
    for store in stores:
        try:
            if not rp.can_fetch(UA,store['url']):raise ValueError('robots.txt disallows')
            body=get(store['url']).decode();observed=timestamp();items=target_products(body,store,observed);products.extend(items)
            connected.append(dict(id='target:'+store['id'],name=store['name'],area=store['area'],address=store['address'],color='#b22325',channel='pickup',sourceUrl=store['url'],collectedAt=observed,offerCount=len(items),chain='Target',regionId=store['regionId'],cityId=store['cityId'],state=store['state']))
            runs.append(dict(source=store['name'],status='ok',offers=len(items),observedAt=observed,sha256=hashlib.sha256(body.encode()).hexdigest()))
        except Exception as e:runs.append(dict(source=store['name'],status='error',detail=type(e).__name__+': '+str(e)[:100]))
        print(json.dumps(runs[-1]),flush=True);time.sleep(max(1,rp.crawl_delay(UA) or 0))
    return products,connected,runs

def collect_mercato(stores):
    products=[];connected=[];runs=[];rp=robots('https://www.mercato.com')
    for store in stores:
        try:
            if not rp.can_fetch(UA,store['url']):raise ValueError('robots.txt disallows')
            body=get(store['url']).decode();data=next_data(body)['props']['pageProps']['initialState']['store']['currentStoreData']
            if str(data['id'])!=store['id']:raise ValueError('Store mismatch')
            if data.get('status')!='active':raise ValueError('Store is not active for online ordering')
            errors=[];count=0
            candidates={str(p['productId']):p for p in data.get('footerProducts',[])[:20]+store.get('extraProducts',[])}
            for attempt,p in enumerate(candidates.values(),1):
                url='https://www.mercato.com/item/'+p['productUrl']+'/'+str(p['productId'])+'?'+urllib.parse.urlencode({'featuredStoreId':store['id'],'storeUrlName':store['slug'],'postalCode':store['postalCode']})
                try:
                    if not rp.can_fetch(UA,url):raise ValueError('robots.txt disallows')
                    item=mercato_product(get(url).decode(),store,timestamp(),url,p['productId']);products.append(item);count+=1
                except Exception as e:errors.append(dict(productId=p['productId'],error=type(e).__name__))
                if attempt%10==0:print(json.dumps({'source':store['name'],'attempted':attempt,'candidates':len(candidates),'verifiedOffers':count}),flush=True)
                time.sleep(max(1,rp.crawl_delay(UA) or 0))
            if count:connected.append(dict(id='mercato:'+store['id'],name=store['name'],area=store['area'],address=store['address'],color='#61813c',channel='online',sourceUrl=store['url'],collectedAt=timestamp(),offerCount=count,chain=store.get('chain','Nutrition Smart'),regionId=store['regionId'],cityId=store['cityId'],state=store['state']))
            runs.append(dict(source=store['name'],status='ok' if count else 'error',offers=count,errors=errors,observedAt=timestamp()))
        except Exception as e:runs.append(dict(source=store['name'],status='error',detail=type(e).__name__+': '+str(e)[:100]))
        print(json.dumps(runs[-1]),flush=True)
    return products,connected,runs

def download_images(products):
    images=ROOT/'public/products';images.mkdir(parents=True,exist_ok=True)
    def download(item):
        try:
            url=item.get('imageSource') or item['imageUrl']
            parts=urllib.parse.urlsplit(url)
            if parts.hostname=='target.scene7.com':
                query=dict(urllib.parse.parse_qsl(parts.query))
                query.update(wid='360',hei='360',fmt='jpeg')
                url=urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))
            base=hashlib.sha256(url.encode()).hexdigest()[:20]
            existing=next(iter(images.glob(base+'.*')),None)
            blob=existing.read_bytes() if existing else get(url)
            # JPEG/PNG are served with image MIME types by the current host.
            ext='png' if blob.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if blob.startswith(b'\xff\xd8\xff') else None
            if not ext:raise ValueError('Expected JPEG or PNG image')
            name=base+'.'+ext
            (images/name).write_bytes(blob);item['imageUrl']='/products/'+name
            return True
        except Exception as e:
            print(json.dumps({'imageError':item['id'],'detail':type(e).__name__}),flush=True)
            return False
    with ThreadPoolExecutor(4) as pool:ok=sum(pool.map(download,products))
    print(json.dumps({'downloadedImages':ok,'total':len(products)}),flush=True)
    return ok

def main():
    p=argparse.ArgumentParser();p.add_argument('--download-images',action='store_true')
    p.add_argument('--images-only',action='store_true',help='Refresh photos without changing price observations')
    p.add_argument('--store',action='append',help='Refresh only this retailer-prefixed store ID, preserving other observations')
    a=p.parse_args()
    if a.images_only:
        out=ROOT/'data/live.json';snapshot=json.loads(out.read_text())
        if download_images(snapshot['products'])!=len(snapshot['products']):
            raise SystemExit('Photo refresh incomplete; prior catalog left unchanged.')
        tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')));tmp.replace(out)
        return
    config=json.loads((ROOT/'collector/retail_sources.json').read_text());products={};stores=[];runs=[]
    selected=set(a.store or []);prior=None
    if selected:
        known={retailer+':'+s['id'] for retailer,entries in config.items() for s in entries}
        if selected-known:raise SystemExit('Unknown store IDs: '+', '.join(sorted(selected-known)))
        config={retailer:[s for s in entries if retailer+':'+s['id'] in selected] for retailer,entries in config.items()}
        prior=json.loads((ROOT/'data/live.json').read_text())
    # One collector per public host; one request at a time per host with crawl pacing.
    with ThreadPoolExecutor(2) as pool:
        futures=[pool.submit(fn,config[key]) for key,fn in [('target',collect_target),('mercato',collect_mercato)] if config[key]]
        for f in futures:
            try:items,ss,rr=f.result()
            except Exception as e:runs.append(dict(source='collector',status='error',detail=type(e).__name__+': '+str(e)[:100]));continue
            stores.extend(ss);runs.extend(rr)
            for item in items:
                if item['id'] not in products:products[item['id']]=item
                else:products[item['id']]['offers'].extend(item['offers'])
    if not products:raise SystemExit('No verified offers collected; prior snapshot left unchanged.')
    if prior:
        refreshed_names={s['name'] for entries in config.values() for s in entries}
        stores=[s for s in prior['stores'] if s['id'] not in selected]+stores
        runs=[r for r in prior.get('runs',[]) if r.get('source') not in refreshed_names]+runs
        for old in prior['products']:
            offers=[o for o in old['offers'] if o['storeId'] not in selected]
            if not offers:continue
            if old['id'] in products:products[old['id']]['offers'].extend(offers)
            else:products[old['id']]=dict(old,offers=offers)
    if a.download_images:download_images(list(products.values()))
    snapshot=dict(products=list(products.values()),stores=stores,collectedAt=timestamp(),runs=runs,
        scope='Selected public grocery listings in Tampa Bay, Silicon Valley and San Francisco. Not complete inventory or all chains.',
        channels=['pickup','online'],refreshPolicy='Manual collector; expires from comparison after 24 hours',
        matchingPolicy='Exact retailer or marketplace item IDs; cross-platform equivalence is not inferred')
    out=ROOT/'data/live.json';tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':')));tmp.replace(out)
    print(json.dumps({'products':len(products),'offers':sum(len(p['offers']) for p in products.values()),'stores':len(stores)}),flush=True)

if __name__=='__main__':main()
