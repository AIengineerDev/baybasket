import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cleanBasket, decodeLists, mutateLists, STORAGE_KEY, MAX_LISTS} from '../lib/saved-lists.mjs';

function memory() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}
const create = (id = 'one', name = 'Weekly shop', mode = 'live') => ({type: 'create', id, name, mode, basket: {'milk': 2, 'retired-product': 1}});

test('save, reload, rename and delete preserve quantities and isolate snapshots', () => {
  const storage = memory(), action = create();
  mutateLists(storage, action);
  action.basket.milk = 9;
  const saved = decodeLists(storage.getItem(STORAGE_KEY));
  assert.deepEqual(saved[0].basket, {milk: 2, 'retired-product': 1});
  assert.equal(mutateLists(storage, {type: 'rename', id: 'one', name: ' Weekend '})[0].name, 'Weekend');
  assert.deepEqual(mutateLists(storage, {type: 'delete', id: 'one'}), []);
});

test('duplicate names do not overwrite a list, but modes can use the same name', () => {
  const storage = memory();
  mutateLists(storage, create());
  assert.throws(() => mutateLists(storage, create('two', ' WEEKLY SHOP ')), /Duplicate/);
  mutateLists(storage, create('two', 'Weekly shop', 'demo'));
  assert.equal(decodeLists(storage.getItem(STORAGE_KEY)).length, 2);
});

test('malformed, future-version and dangerous data never gets overwritten', () => {
  const storage = memory();
  for (const raw of ['{', '{"version":2,"lists":[]}', '{"version":1,"lists":[{}]}']) {
    storage.setItem(STORAGE_KEY, raw);
    assert.throws(() => mutateLists(storage, create()));
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
  for (const value of [{}, [], {milk: 0}, {milk: 100}, {milk: 1.5}, {milk: '2'}, JSON.parse('{"__proto__":2}')]) {
    assert.throws(() => cleanBasket(value));
  }
  assert.throws(() => mutateLists(memory(), create('one', ' ')));
  assert.throws(() => mutateLists(memory(), create('one', 'a'.repeat(61))));
});

test('storage failures propagate without claiming a successful save', () => {
  assert.throws(() => mutateLists({getItem() {throw Error('Access denied');}}, create()), /Access denied/);
  assert.throws(() => mutateLists({getItem: () => null, setItem() {throw Error('Quota exceeded');}}, create()), /Quota exceeded/);
});

test('later actions preserve another tab’s writes and detect deleted lists', () => {
  const storage = memory();
  mutateLists(storage, create());
  mutateLists(storage, create('two', 'Other tab'));
  assert.equal(mutateLists(storage, {type: 'rename', id: 'one', name: 'Renamed'}).length, 2);
  mutateLists(storage, {type: 'delete', id: 'one'});
  assert.throws(() => mutateLists(storage, {type: 'rename', id: 'one', name: 'Oops'}), /removed/);
});

test('list limit rejects additions without deleting existing data', () => {
  const storage = memory();
  for (let i = 0; i < MAX_LISTS; i++) mutateLists(storage, create(String(i), `List ${i}`));
  const before = storage.getItem(STORAGE_KEY);
  assert.throws(() => mutateLists(storage, create('overflow')), /up to/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});
