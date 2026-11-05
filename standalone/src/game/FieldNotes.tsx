import { useEffect, useState } from 'react';
import { LANDMARKS, knownLandmarkIds, nearestLandmark } from '../../shared/exploration-catalog.mjs';
import type { Player } from './shared/game';
import './field-notes.css';

export default function FieldNotes({ player, accountId }: { player: Player; accountId: string }) {
  const key = 'eldritch-field-notes-v1-' + accountId;
  const [notes, setNotes] = useState<{ owner: string; ids: string[] }>({ owner: '', ids: [] });
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const nearby = nearestLandmark(player);
  const ids = notes.owner === accountId ? notes.ids : [];
  useEffect(() => {
    let ids: string[] = [];
    try { ids = knownLandmarkIds(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch { setStorageAvailable(false); }
    setNotes({ owner: accountId, ids });
    setExpanded(false);
  }, [accountId, key]);
  function examine() {
    // Position comes from the latest realm projection. Notes are cosmetic, not reward proof.
    if (!nearby) return;
    const next = knownLandmarkIds([...ids, nearby.id]);
    setNotes({ owner: accountId, ids: next });
    setExpanded(true);
    try { localStorage.setItem(key, JSON.stringify(next)); }
    catch { setStorageAvailable(false); }
  }
  return <section className="card field-notes" aria-label="Field notes">
    <div className="section-kicker">ALONG THE WAY</div>
    <h2>Your field notes</h2>
    <p>Look for small lantern-marked places as you wander. There is no required order.</p>
    {nearby ? <button type="button" className="field-note-examine" onClick={examine}>
      {ids.includes(nearby.id) ? 'Read again' : 'Examine'} · {nearby.title}
    </button> : <p className="field-note-hint">Approach a landmark to examine it.</p>}
    <button type="button" className="field-note-toggle" aria-expanded={expanded} aria-controls="field-note-entries" onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Close notebook' : 'Open notebook'} · {ids.length} {ids.length === 1 ? 'note' : 'notes'}
    </button>
    {expanded && <div id="field-note-entries" className="field-note-entries">
      {!ids.length && <p>A blank page, ready for whatever catches your eye.</p>}
      {ids.map(id => {
        const note = LANDMARKS.find(item => item.id === id);
        return note && <article key={id}><h3>{note.title}</h3><p>{note.text}</p></article>;
      })}
    </div>}
    <small>{storageAvailable ? 'Notes stay in this browser, separately from your saved hero.' : 'Browser storage is unavailable. Notes last for this visit.'} Reading grants no XP or coins.</small>
  </section>;
}
