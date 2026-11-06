export const STORAGE_KEY = 'baybasket.saved-lists.v1';
export const MAX_LISTS = 30;

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Validate stored quantities without dropping products removed from today's catalog. */
export function cleanBasket(value) {
  if (!record(value)) throw new Error('Invalid shopping list items.');
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 500) throw new Error('A list must contain 1–500 products.');
  for (const [id, quantity] of entries) {
    if (!id || id.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(id) ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error('Invalid product or quantity in shopping list.');
    }
  }
  return Object.fromEntries(entries);
}

export function listName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 60) {
    throw new Error('Use a list name between 1 and 60 characters.');
  }
  return value.trim();
}

export function decodeLists(raw) {
  if (raw === null) return [];
  if (raw.length > 2_000_000) throw new Error('Saved lists are too large to read.');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Saved lists could not be read. Existing data has not been changed.'); }
  if (!record(data) || data.version !== 1 || !Array.isArray(data.lists) || data.lists.length > MAX_LISTS) {
    throw new Error('Unsupported saved-list data. Existing data has not been changed.');
  }
  const ids = new Set(), names = new Set();
  return data.lists.map(list => {
    if (!record(list) || typeof list.id !== 'string' || !list.id || list.id.length > 100 || ids.has(list.id) ||
        !['live', 'demo'].includes(list.mode)) throw new Error('Invalid saved shopping list.');
    const name = listName(list.name), key = `${list.mode}:${name.toLowerCase()}`;
    if (names.has(key)) throw new Error('Duplicate saved shopping list.');
    ids.add(list.id); names.add(key);
    return {id: list.id, name, mode: list.mode, basket: cleanBasket(list.basket)};
  });
}

/** Re-read before every action so another tab's latest changes are preserved. */
export function mutateLists(storage, action) {
  let lists = decodeLists(storage.getItem(STORAGE_KEY));
  if (action.type === 'create') {
    if (lists.length >= MAX_LISTS) throw new Error(`You can save up to ${MAX_LISTS} lists. Delete one first.`);
    lists = [...lists, {id: action.id, name: listName(action.name), mode: action.mode, basket: cleanBasket(action.basket)}];
  } else {
    if (!lists.some(list => list.id === action.id)) throw new Error('This list was removed in another tab.');
    if (action.type === 'rename') lists = lists.map(list => list.id === action.id ? {...list, name: listName(action.name)} : list);
    else if (action.type === 'delete') lists = lists.filter(list => list.id !== action.id);
    else throw new Error('Unknown shopping list action.');
  }
  const raw = JSON.stringify({version: 1, lists});
  const validated = decodeLists(raw);
  storage.setItem(STORAGE_KEY, raw);
  return validated;
}
