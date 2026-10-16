const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

// Render the actual TSX dialog in Node, without a browser or a preview server.
const prior=require.extensions['.tsx'];
require.extensions['.tsx']=(module,filename)=>{
 const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}
 });
 module._compile(output.outputText,filename);
};
let ProductPriceDialog;
try{({ProductPriceDialog}=require('../components/product-price-dialog.tsx'))}
finally{if(prior)require.extensions['.tsx']=prior;else delete require.extensions['.tsx']}

const now=Date.now();
const stores=[{id:'target',chain:'Target',name:'Target nearby'},{id:'bravo',chain:'Bravo',name:'Bravo nearby'},{id:'nutrition',chain:'Nutrition Smart',name:'Nutrition Smart nearby'}];
const offer=(storeId,cents)=>({storeId,cents,available:true,estimated:false,observedAt:new Date(now-1000).toISOString(),sourceUrl:'https://www.mercato.com/item/example',channel:'online'});
const product={id:'dialog-fixture',name:'Garlic & Herb Butter',size:'3.5 oz',category:'Dairy',brand:'Kerrygold',offers:[offer('nutrition',370)]};
const render=p=>renderToStaticMarkup(React.createElement(ProductPriceDialog,{product:p,stores,now,mode:'live',observed:()=> 'Today',onClose:()=>{},onCompare:()=>{}}));
const single=render(product);
assert.equal((single.match(/<article(?:\s|>)/g)||[]).length,1,'The screenshot item should render only one real quote');
assert(single.includes('$3.70')&&single.includes('One collected price'));
assert(!single.includes('Target nearby')&&!single.includes('Bravo nearby'));
assert(!single.includes('Price not collected')&&!single.includes('>—<'));
assert(!single.includes('Lowest collected price'),'One store is not a comparison');
const comparison=render({...product,offers:[offer('bravo',350),offer('nutrition',370)]});
assert.equal((comparison.match(/<article(?:\s|>)/g)||[]).length,2);
assert(comparison.includes('2 grocers with a price'));
assert(comparison.indexOf('$3.50')<comparison.indexOf('$3.70'));
assert(comparison.includes('Lowest collected price'));
const expired=render({...product,offers:[{...offer('nutrition',370),observedAt:'2020-01-01T00:00:00Z'}]});
assert(!/<article(?:\s|>)/.test(expired)&&!expired.includes('$3.70'));
assert(expired.includes('Price needs refreshing'));
console.log('Actual product dialog render passed: numeric quotes only, single-store label, ordered comparison, expiry state.');
