"use client";
import {ArrowRight,ArrowUpRight,X} from 'lucide-react';
import {ProductImage} from './product-image';
import {quoteRows} from '../lib/pricing.mjs';
import type {Product,GroceryStore,Offer} from '../lib/catalog';

export function ProductPriceDialog({product,stores,now,mode,observed,onClose,onCompare}:{
 product:Product;stores:GroceryStore[];now:number;mode:'demo'|'live';
 observed:(value?:string)=>string;onClose:()=>void;onCompare:()=>void;
}){
 const rows=quoteRows(product,stores,now) as {store:GroceryStore;offer:Offer}[];
 return <div className="modal-backdrop" onClick={onClose}>
  <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={e=>e.stopPropagation()}>
   <button className="modal-close" autoFocus aria-label="Close product details" onClick={onClose}><X size={20}/></button>
   <div className="detail-heading">
    <div className="detail-image"><ProductImage product={product}/></div>
    <div><span className="eyebrow">{product.category}</span><h2 id="detail-title">{product.name}</h2><p>{product.size}</p>
     <span className="quote-count">{rows.length>1?`${rows.length} grocers with a price`:rows.length===1?'One collected price':'Price needs refreshing'}</span>
    </div>
   </div>
   <div className="detail-offers">{rows.map(({store,offer},i)=><article key={store.id}>
    <div><strong>{store.chain||store.name}</strong>
     <small>{store.name}{store.distanceMiles!==undefined&&` · ${store.distanceMiles.toFixed(1)} mi away`}<br/>{store.address||store.area}</small>
     <span>{offer.channel==='pickup'?'Store pickup':offer.channel==='online'?'Mercato online':'In store'} · Listed in stock</span>
     {rows.length>1&&i===0&&<span className="best-quote">Lowest collected price</span>}
    </div>
    <b>${(offer.cents/100).toFixed(2)}<small>{offer.unitPrice||product.size}</small></b>
    <div className="offer-bottom"><small>Observed {observed(offer.observedAt)}</small>
     {mode==='live'&&<a href={offer.sourceUrl} target="_blank" rel="noreferrer">Source listing <ArrowUpRight size={12}/></a>}
    </div>
   </article>)}</div>
   {rows.length<2&&<div className="comparison-note">
    <p>{rows.length===1?'This item currently has a collected price at one nearby grocer. It is a single-store listing.':'This item has no eligible price in the latest collection. Prices must be in stock, fixed-price, and checked within 24 hours.'}</p>
    <button className="text-action" onClick={onCompare}>Find products priced at 2+ grocers <ArrowRight size={13}/></button>
   </div>}
   <p className="detail-note">Only grocers with a collected price for this exact item appear here. These online listings may differ from checkout or shelf prices. Taxes, fees, memberships and multi-buy discounts are excluded.</p>
  </section>
 </div>;
}
