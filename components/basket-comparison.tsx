"use client";
import {ArrowDown,Check,Download,Minus,Plus,ShoppingBasket} from 'lucide-react';
import {ProductImage} from './product-image';
import {compareBasket} from '../lib/basket-comparison.mjs';
import type {GroceryStore} from '../lib/catalog';

type Comparison=ReturnType<typeof compareBasket>;
const money=(cents:number)=>'$'+(cents/100).toFixed(2);
const grocer=(store:GroceryStore)=>store.chain||store.name;
const items=(count:number)=>`${count} ${count===1?'item':'items'}`;

export function BasketSummary({comparison,onDetails}:{comparison:Comparison;onDetails:()=>void}){
 if(!comparison.lineCount)return null;
 const subset=comparison.shared.rows.length>0&&comparison.shared.rows.length<comparison.lineCount;
 return <section className="basket-live-summary" aria-label="Automatic basket totals">
  <div className="summary-label"><span className="tiny-dot"/> Totals update as you shop</div>
  {comparison.pricedStores.map(s=><div key={s.store.id} className={'quick-total '+(s.complete?'complete':'partial')}>
   <span><b>{grocer(s.store)}</b><small>{s.complete?`Full basket · ${items(comparison.itemCount)}`:`Subtotal · ${s.pricedCount} of ${comparison.lineCount} products priced`}</small></span>
   <strong>{money(s.cents!)}</strong>
  </div>)}
  {!comparison.pricedStores.length&&<p className="basket-no-quotes">No collected prices for this basket at the selected branches.</p>}
  {subset&&<div className="quick-shared"><b>Compare the same {items(comparison.shared.itemCount)}</b>
   {comparison.shared.stores.map(s=><span key={s.store.id}>{grocer(s.store)} <strong>{money(s.cents)}</strong></span>)}
   <small>Only products priced at each grocer above.</small>
  </div>}
  <button className="basket-details-link" onClick={onDetails}>See item-by-item comparison <ArrowDown size={14}/></button>
 </section>;
}

export function BasketComparison({comparison,onChange,onExport,mode}:{comparison:Comparison;onChange:(id:string,delta:number)=>void;onExport:()=>void;mode:'live'|'demo'}){
 const {rows,pricedStores,shared}=comparison;
 const isSubset=shared.rows.length>0&&shared.rows.length<rows.length;
 const sharedIds=new Set(shared.rows.map(r=>r.id));
 return <section id="basket-comparison" className="basket-matrix" tabIndex={-1} aria-labelledby="basket-comparison-title">
  <div className="matrix-heading"><div><span className="eyebrow">YOUR BASKET, SIDE BY SIDE</span><h2 id="basket-comparison-title">Compare totals for your groceries</h2><p>{items(comparison.itemCount)} · {rows.length} different products · Quantities update every total automatically</p></div><button className="matrix-export" onClick={onExport}><Download size={15}/> Export</button></div>
  {pricedStores.length>0?<div className="matrix-scroll" tabIndex={0} role="region" aria-label="Item prices and totals by grocery store">
   <table><caption className="sr-only">Collected prices for your selected items, with one branch per grocer. Partial subtotals exclude missing prices.</caption>
    <thead><tr><th scope="col">Item & quantity</th>{pricedStores.map(s=><th scope="col" key={s.store.id}><span>{grocer(s.store)}</span><small>{s.store.name}</small>{s.store.distanceMiles!==undefined&&<small>{s.store.distanceMiles.toFixed(1)} mi away</small>}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.id}><th scope="row"><div className="matrix-product">{row.product?<ProductImage product={row.product} small/>:<ShoppingBasket size={24}/>}<div><strong>{row.name}</strong>{isSubset&&sharedIds.has(row.id)&&<small className="shared-tag">Included in shared-item total</small>}<div className="matrix-quantity"><button aria-label={'Remove one '+row.name} onClick={()=>onChange(row.id,-1)}><Minus size={12}/></button><span>Qty {row.quantity}</span><button aria-label={'Add one '+row.name} onClick={()=>onChange(row.id,1)} disabled={row.quantity>=99}><Plus size={12}/></button></div></div></div></th>
     {pricedStores.map(s=>{const offer=row.offers[s.store.id];return <td key={s.store.id}>{offer?<><strong>{money(offer.lineCents)}</strong><small>{money(offer.cents)} × {row.quantity}</small></>:<span className="matrix-missing">Price not collected</span>}</td>})}</tr>)}</tbody>
    <tfoot><tr className="full-basket-row"><th scope="row">Basket totals<small>{items(comparison.itemCount)} · {rows.length} products</small></th>{pricedStores.map(s=><td key={s.store.id} className={s.complete?'complete-total':'partial-total'}><strong>{money(s.cents!)}</strong><small>{s.complete?'Complete basket':`Partial subtotal · ${s.pricedCount}/${rows.length} products`}</small>{comparison.bestFullStoreIds.includes(s.store.id)&&<span className="total-badge"><Check size={11}/>{comparison.bestFullStoreIds.length>1?'Joint lowest full basket':'Lowest full basket'}</span>}</td>)}</tr>
     {isSubset&&<tr className="shared-basket-row"><th scope="row">Same items at each grocer<small>{items(shared.itemCount)} · {shared.rows.length} shared products</small></th>{pricedStores.map(s=>{const total=shared.stores.find(t=>t.store.id===s.store.id);return <td key={s.store.id}>{total?<><strong>{money(total.cents)}</strong><small>{items(shared.itemCount)} priced</small></>:<span className="matrix-missing">Not all shared items priced</span>}</td>})}</tr>}
    </tfoot>
   </table>
  </div>:<div className="matrix-no-quotes">No prices are collected for these items at the selected branches. Choose another ZIP code or add a currently priced product.</div>}
  {isSubset&&<div className="shared-explanation"><strong>Compare the same {items(shared.itemCount)} at {shared.stores.map(s=>grocer(s.store)).join(' and ')}</strong><p>{shared.rows.map(r=>`${r.quantity} × ${r.name}`).join(' · ')}</p>{shared.savingsCents>0&&<span>{grocer(shared.stores[0].store)} is {money(shared.savingsCents)} less for this shared selection{shared.stores.length>2?' than the next-lowest quote':''}.</span>}</div>}
  {comparison.unpricedStores.length>0&&<p className="matrix-coverage">{comparison.unpricedStores.map(s=>grocer(s.store)).join(', ')}: no collected prices for the selected items.</p>}
  <p className="matrix-note">{mode==='demo'?'Illustrative sample prices.':'Collected online prices, checked within 24 hours.'} A partial subtotal is not a full basket price. Taxes, fees and substitutions are excluded.</p>
 </section>;
}
