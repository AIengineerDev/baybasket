const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost'});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const {act} = React;
const {createRoot} = require('react-dom/client');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.tsx'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}
  }).outputText, filename);
};
const {SavedLists} = require('../components/saved-lists.tsx');
const {STORAGE_KEY, mutateLists} = require('../lib/saved-lists.mjs');
let basket = {milk: 2}, loaded;
const root = createRoot(document.getElementById('root'));
const render = mode => act(() => root.render(React.createElement(SavedLists, {key: mode, mode, basket, onLoad: value => {loaded = value;}})));
const click = label => act(() => {
  const button = [...document.querySelectorAll('button')].find(el => (el.getAttribute('aria-label') || el.textContent) === label);
  assert(button, `Missing button: ${label}`);
  button.click();
});
const input = value => act(() => {
  const el = document.querySelector('input');
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
});
const text = () => document.body.textContent;

render('live');
input('Weekly shop'); click('Save current basket');
assert(text().includes('Shopping list saved.'));
assert(window.localStorage.getItem(STORAGE_KEY).includes('Weekly shop'));
input('weekly SHOP'); click('Save current basket');
assert(text().includes('Duplicate saved shopping list'));
click('Rename Weekly shop'); input('Weekend'); click('Save name');
assert(text().includes('List renamed.'));

// Changing catalog and remounting must not leak demo/live lists.
render('demo'); assert(!text().includes('Weekend'));
render('live'); assert(text().includes('Weekend'));
click('Load Weekend'); assert.equal(loaded, undefined);
click('Keep current'); assert.equal(loaded, undefined);
click('Load Weekend'); click('Replace basket');
assert.deepEqual(loaded, {milk: 2});
loaded.milk = 9;
assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).lists[0].basket.milk, 2);

// Storage events make another tab's list visible without overwriting local state.
mutateLists(window.localStorage, {type: 'create', id: 'other', name: 'Other tab', mode: 'live', basket: {bread: 1}});
act(() => window.dispatchEvent(new dom.window.StorageEvent('storage', {key: STORAGE_KEY})));
assert(text().includes('Other tab'));
click('Delete Weekend'); click('Keep current'); assert(text().includes('Weekend'));
click('Delete Weekend'); click('Delete saved list');
assert(!document.querySelector('[aria-label="Rename Weekend"]'));
assert.equal(basket.milk, 2);
assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).lists.length, 1);

// Denied writes report an error and do not add a phantom list to the UI.
const originalSet = dom.window.Storage.prototype.setItem;
dom.window.Storage.prototype.setItem = () => {throw Error('Storage quota exceeded');};
input('Cannot save'); click('Save current basket');
assert(text().includes('Storage quota exceeded'));
assert(!document.querySelector('[aria-label="Rename Cannot save"]'));
dom.window.Storage.prototype.setItem = originalSet;
act(() => root.unmount());
console.log('Saved-list UI passed: create, duplicate, rename, mode separation, remount persistence, load/cancel, delete/cancel, cross-tab update and write failure.');
