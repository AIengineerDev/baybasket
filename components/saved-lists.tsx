'use client';

import {useEffect, useState} from 'react';
import {decodeLists, mutateLists, STORAGE_KEY} from '../lib/saved-lists.mjs';

type SavedList = {id: string; name: string; mode: 'live' | 'demo'; basket: Record<string, number>};
type Props = {basket: Record<string, number>; mode: 'live' | 'demo'; onLoad: (basket: Record<string, number>) => void};

export function SavedLists({basket, mode, onLoad}: Props) {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{type: 'load' | 'delete'; list: SavedList} | null>(null);

  useEffect(() => {
    function read() {
      try { setLists(decodeLists(window.localStorage.getItem(STORAGE_KEY))); setError(''); setReady(true); }
      catch (e) { setError(e instanceof Error ? e.message : 'Browser storage is unavailable.'); setReady(false); }
    }
    read();
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) read(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function update(action: Parameters<typeof mutateLists>[1], success: string) {
    try {
      setLists(mutateLists(window.localStorage, action));
      setError(''); setMessage(success); setName(''); setEditing(null);
    } catch (e) { setMessage(''); setError(e instanceof Error ? e.message : 'Could not save changes.'); }
  }

  function load(list: SavedList, confirmed = false) {
    try {
      const latest = decodeLists(window.localStorage.getItem(STORAGE_KEY)).find((item: SavedList) => item.id === list.id);
      if (!latest) throw new Error('This list was removed in another tab.');
      if (latest.mode !== mode) throw new Error('This list belongs to a different catalog.');
      if (Object.keys(basket).length && !confirmed) {setPending({type: 'load', list: latest}); return;}
      onLoad({...latest.basket}); setError(''); setMessage(`Loaded “${latest.name}”. Prices use your current location and availability.`);
    } catch (e) { setMessage(''); setError(e instanceof Error ? e.message : 'Could not load this list.'); }
  }

  return <section className="saved-lists" aria-label="Saved shopping lists">
    <h3>Saved shopping lists</h3>
    <p>Stored in this browser. {mode === 'demo' ? 'Demo' : 'Real-product'} lists only. Loading replaces your basket; prices are recalculated.</p>
    <form onSubmit={event => {
      event.preventDefault();
      update(editing ? {type: 'rename', id: editing, name} : {type: 'create', id: crypto.randomUUID(), name, mode, basket}, editing ? 'List renamed.' : 'Shopping list saved.');
    }}>
      <label htmlFor="saved-list-name">{editing ? 'Rename list' : 'New list name'}</label>
      <input id="saved-list-name" value={name} maxLength={60} required onChange={event => setName(event.target.value)} />
      <div className="saved-list-actions">
        <button type="submit" disabled={!ready || (!editing && !Object.keys(basket).length)}>{editing ? 'Save name' : 'Save current basket'}</button>
        {editing && <button type="button" onClick={() => {setEditing(null); setName('');}}>Cancel</button>}
      </div>
    </form>
    {error && <p role="alert">{error}</p>}
    <p role="status">{message}</p>
    {pending && <div role="group" aria-label="Confirm shopping list action">
      <p>{pending.type === 'load' ? `Replace your current basket with “${pending.list.name}”?` : `Delete saved list “${pending.list.name}”? Your current basket will stay unchanged.`}</p>
      <div className="saved-list-actions">
        <button type="button" onClick={() => {
          if (pending.type === 'load') load(pending.list, true);
          else update({type: 'delete', id: pending.list.id}, 'List deleted.');
          setPending(null);
        }}>{pending.type === 'load' ? 'Replace basket' : 'Delete saved list'}</button>
        <button type="button" onClick={() => setPending(null)}>Keep current</button>
      </div>
    </div>}
    {ready && !lists.some(list => list.mode === mode) && <p>No saved lists yet.</p>}
    <ul>{lists.filter(list => list.mode === mode).map(list => <li key={list.id}>
      <strong>{list.name}</strong><span>{Object.keys(list.basket).length} products</span>
      <div className="saved-list-actions">
        <button type="button" aria-label={`Load ${list.name}`} onClick={() => load(list)}>Load</button>
        <button type="button" aria-label={`Rename ${list.name}`} onClick={() => {setEditing(list.id); setName(list.name);}}>Rename</button>
        <button type="button" aria-label={`Delete ${list.name}`} onClick={() => {
          setPending({type: 'delete', list});
        }}>Delete</button>
      </div>
    </li>)}</ul>
  </section>;
}
