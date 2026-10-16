import unittest
from grocery import connect,ingest,compare,now,page_rows
class TestPrices(unittest.TestCase):
 def setUp(self):
  self.db=connect(':memory:')
  self.db.execute('INSERT INTO stores VALUES (?,?,?,?,?,?,?,?)',('a','Market A','','',0,0,'',now()))
  self.row=dict(store_id='a',product_key='milk',name='Milk',package='1 gal',price='3.99',currency='USD',channel='in_store',available=True,observed_at=now(),source_url='https://example.com')
 def test_complete_and_missing(self):
  ingest(self.db,[self.row]);self.assertEqual(compare(self.db,{'milk':2},'in_store',24)[0]['total'],'7.98')
  self.assertIsNone(compare(self.db,{'milk':1,'eggs':1},'in_store',24)[0]['total'])
 def test_invalid_price(self):
  for value in ['NaN','-1','1.999']:
   with self.assertRaises(ValueError):ingest(self.db,[{**self.row,'price':value}])
 def test_stale(self):
  ingest(self.db,[{**self.row,'observed_at':'2020-01-01T00:00:00Z'}]);self.assertFalse(compare(self.db,{'milk':1},'in_store',24)[0]['complete'])
 def test_latest_unavailable(self):
  ingest(self.db,[self.row]);ingest(self.db,[{**self.row,'available':False,'observed_at':now()}]);self.assertFalse(compare(self.db,{'milk':1},'in_store',24)[0]['complete'])
 def test_ambiguous_page(self):
  with self.assertRaises(ValueError):page_rows('<html></html>',{'sku':'123'})
if __name__=='__main__':unittest.main()
