"""Export a bounded, fresh store-price snapshot for the Next.js POC."""
import argparse,json,sqlite3
from datetime import datetime,timezone,timedelta
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--db',default='grocery.sqlite');p.add_argument('--out',default='data/live.json');p.add_argument('--channel',default='in_store');a=p.parse_args()
db=sqlite3.connect(a.db);db.row_factory=sqlite3.Row
cutoff=(datetime.now(timezone.utc)-timedelta(hours=24)).isoformat()
rows=db.execute('''SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY store_id,product_key,channel ORDER BY observed_at DESC,id DESC) rn FROM offers WHERE channel=?) WHERE rn=1 AND available=1 AND observed_at>=?''',(a.channel,cutoff)).fetchall()
products={};storeids=set()
for r in rows:
    key=r['product_key'];storeids.add(r['store_id'])
    item=products.setdefault(key,dict(id=key,name=r['name'],brand='Collected product',category='Other',size=r['package'],icon='🛒',offers=[]))
    if item['size']!=r['package']: raise ValueError('Product key has mismatched package sizes: '+key)
    item['offers'].append(dict(storeId=r['store_id'],cents=r['cents'],available=True,observedAt=r['observed_at'],sourceUrl=r['source_url']))
if len(products)>5000: raise ValueError('POC snapshot limit is 5,000 products. Use a dedicated search service for larger catalogs; do not ship full catalogs to the browser.')
stores=[dict(id=r['id'],name=r['name'],area=r['address'],color='#356148') for r in db.execute('SELECT * FROM stores') if r['id'] in storeids]
Path(a.out).write_text(json.dumps(dict(products=list(products.values()),stores=stores,channel=a.channel,exportedAt=datetime.now(timezone.utc).isoformat()),indent=2))
print(f'Exported {len(products)} products across {len(stores)} stores')
