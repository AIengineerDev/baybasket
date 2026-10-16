import json,unittest
from collect_retail import target_products,mercato_product,cents
from robots_rules import Rules
class RetailTests(unittest.TestCase):
 def target_page(self,loc='2289',price=None,classification='Fruits'):
  p={'__typename':'ProductSummary','tcin':'123','price':price or {'current_retail':2.79},'item':{'product_description':{'title':'Fresh Strawberries - 1lb'},'enrichment':{'buy_url':'https://www.target.com/p/a/-/A-123','image_info':{'primary_image':{'url':'https://target.scene7.com/is/image/Target/photo'}}}},'fulfillment':{'store_options':[{'location_id':loc,'order_pickup':{'availability_status':'IN_STOCK'}}]}}
  p['item']['product_classification']={'item_type':{'name':classification}}
  return '<script>self.__next_f.push('+json.dumps([1,json.dumps(p,separators=(',',':'))])+')</script>'
 def test_general_store_food_only(self):
  store={'id':'2289','url':'https://www.target.com/sl/test/2289','groceryTypes':['Fruits']}
  self.assertEqual(len(target_products(self.target_page(),store,'2026-10-14T17:00:00Z')),1)
  with self.assertRaises(ValueError):target_products(self.target_page(classification='Fashion Dolls'),store,'2026-10-14T17:00:00Z')
  with self.assertRaises(ValueError):target_products(self.target_page(classification=''),store,'2026-10-14T17:00:00Z')
 def test_target_context(self):
  store={'id':'2289','url':'https://www.target.com/sl/tampa/2289/grocery'}
  x=target_products(self.target_page(),store,'2026-10-14T17:00:00Z')[0]
  self.assertEqual(x['offers'][0]['cents'],279);self.assertEqual(x['offers'][0]['channel'],'pickup')
  with self.assertRaises(ValueError):target_products(self.target_page('999'),store,'2026-10-14T17:00:00Z')
 def test_reject_parent_range(self):
  with self.assertRaises(ValueError):target_products(self.target_page(price={'current_retail':2.79,'is_current_price_range':True}),{'id':'2289','url':'x'},'2026-10-14T17:00:00Z')
 def test_robot_literal_query(self):
  r=Rules('User-agent: *\nDisallow: /s?\nDisallow: /shop/\nDisallow: /*/private$\nAllow: /shop/allowed')
  self.assertTrue(r.can_fetch('BayBasketResearch','https://www.target.com/sl/tampa/2289/grocery'))
  self.assertFalse(r.can_fetch('BayBasketResearch','https://www.target.com/s?searchTerm=milk'))
  self.assertFalse(r.can_fetch('BayBasketResearch','https://www.target.com/shop/foo'))
  self.assertTrue(r.can_fetch('BayBasketResearch','https://www.target.com/shop/allowed'))
  self.assertFalse(r.can_fetch('BayBasketResearch','https://www.target.com/a/private'))
 def test_invalid_price(self):
  for price in ['NaN','Infinity','-2','1.999',0]:
   with self.assertRaises(ValueError):cents(price)
 def test_mercato_wrong_store(self):
  p={'props':{'pageProps':{'initialState':{'productDetails':{'productModalRaw':{'storeId':999}}}}}}
  html='<script id="__NEXT_DATA__" type="application/json">'+json.dumps(p)+'</script>'
  with self.assertRaises(ValueError):mercato_product(html,{'id':'1323'},'2026-10-14T17:00:00Z','https://www.mercato.com/item/a')
 def test_mercato_wrong_product(self):
  p={'props':{'pageProps':{'initialState':{'productDetails':{'productModalRaw':{'storeId':1323,'actualProductId':999}}}}}}
  html='<script id="__NEXT_DATA__" type="application/json">'+json.dumps(p)+'</script>'
  with self.assertRaisesRegex(ValueError,'Product mismatch'):mercato_product(html,{'id':'1323'},'2026-10-15T16:00:00Z','https://www.mercato.com/item/a',1095)
if __name__=='__main__':unittest.main()
