const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const previous={'.tsx':require.extensions['.tsx'],'.ts':require.extensions['.ts']};
for(const ext of Object.keys(previous))require.extensions[ext]=(module,filename)=>{
 const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}});
 module._compile(output.outputText,filename);
};
let GroceryApp;
try{GroceryApp=require('../components/grocery-app.tsx').default}
finally{for(const [ext,prior] of Object.entries(previous)){if(prior)require.extensions[ext]=prior;else delete require.extensions[ext]}}
const live=require('../data/live.json'),places=require('../data/places.json');
const now=Math.max(...live.products.flatMap(p=>p.offers.map(o=>Date.parse(o.observedAt))))+1000;
const milk='mercato:34017',butter='mercato:4054',berries='mercato:94963';
const render=initialBasket=>renderToStaticMarkup(React.createElement(GroceryApp,{initialLocation:places.cities.tampa,initialRadius:20,initialNow:now,initialBasket}));
const html=render({[milk]:1,[butter]:1,[berries]:1});
const matrix=html.match(/<section id="basket-comparison"[\s\S]*?<\/section>/)?.[0];
assert(matrix,'The actual app must render an open comparison for a selected basket');
assert(html.indexOf('id="basket-comparison"')<html.indexOf('class="catalog"'),'Comparison must be visible above the catalog');
assert(html.indexOf('class="basket-live-summary"')<html.indexOf('class="basket-items"'),'Quick totals must appear before the long basket item list');
assert.equal((matrix.match(/<th scope="row">/g)||[]).length,5,'Three product rows and two separate total rows');
assert(matrix.includes('$20.57')&&matrix.includes('$14.08')&&matrix.includes('$14.40'));
assert(matrix.includes('Partial subtotal · 2/3 products')&&matrix.includes('Complete basket'));
assert(matrix.includes('Same items at each grocer')&&matrix.includes('$0.32'));
assert(matrix.includes('Target: no collected prices for the selected items.'));
assert(!matrix.includes('$0.00')&&!matrix.includes('Lowest full basket'));
assert(!matrix.includes('<details')&&!html.includes('Compare basket totals'));
for(const id of [milk,butter,berries]){
 const name=live.products.find(p=>p.id===id).name;
 assert(matrix.includes(renderToStaticMarkup(React.createElement('span',null,name)).slice(6,-7)));
}
const full=render({[milk]:1,[butter]:1});
assert(full.includes('Lowest full basket'));
assert(!full.includes('Partial subtotal ·')&&!full.includes('Same items at each grocer'));
const more=render({[milk]:1,[butter]:2,[berries]:1});
assert(more.includes('$27.77')&&more.includes('$20.87')&&more.includes('$21.60'));
const empty=render({});assert(!empty.includes('id="basket-comparison"'));
console.log('Actual React app render passed: open item table, totals before basket list, full vs partial labels, shared comparison, quantities and empty basket.');
