import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gem, LockKeyhole, ShoppingBag, Sparkles, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import { api } from '../game/transport.js';
import { useDialogFocus } from '../game/useDialogFocus.js';

export default function SecretStash({ onSessionExpired }) {
  const [state, setState] = useState({ loading: true, stash: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [lots, setLots] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef(null);
  const dialogRef = useDialogFocus(confirming, () => {
    if (!busy && !pending.current) setConfirming(false);
  });

  useEffect(() => {
    let active = true;
    setState(current => ({ ...current, loading: true, error: '' }));
    api.get('/api/game/stash').then(({ data }) => {
      if (active) setState({ loading: false, stash: data.stash, error: '' });
    }).catch(error => {
      if (!active) return;
      if (error.status === 401) onSessionExpired();
      else setState(current => ({ ...current, loading: false, error: error.message }));
    });
    return () => { active = false; };
  }, [retry]);

  async function exchange() {
    if (busy) return;
    const payload = pending.current || { requestId: crypto.randomUUID(), lots };
    pending.current = payload;
    setBusy(true);
    setNotice('');
    setState(current => ({ ...current, error: '' }));
    try {
      const { data } = await api.post('/api/game/exchange', payload);
      setState({ loading: false, stash: data.stash, error: '' });
      setNotice(data.notice || 'Your XP has been exchanged. The coins are saved in your stash.');
      pending.current = null;
      setConfirming(false);
    } catch (error) {
      if (error.status === 401) onSessionExpired();
      else {
        if (error.status && error.status < 500) pending.current = null;
        setState(current => ({ ...current, error: error.message }));
      }
    } finally { setBusy(false); }
  }

  const stash = state.stash;
  const amount = lots * 1250;
  const coins = stash?.coins || { gold: 0, silver: 0, copper: 0 };
  return (
    <div className="ef-rpg">
      <main className="stash-page">
        <nav className="stash-nav" aria-label="Secret Stash navigation">
          <Link to="/">Eldritch Fable</Link>
          <Link to="/play">Return to the realm</Link>
          <Link to="/account">Your account</Link>
        </nav>
        <div className="eyebrow"><LockKeyhole size={14} /> FOR YOUR EYES ONLY</div>
        <h1>The Secret Stash</h1>
        <p>Your adventures become treasures. Earn XP in the realm, keep it for future abilities, or exchange it for coins. Your stash is private and stays with your account.</p>
        {state.loading && <p role="status">Opening your stash…</p>}
        {state.error && <div className="error-banner" role="alert"><span>{state.error}</span><button onClick={() => pending.current ? exchange() : setRetry(value => value + 1)}>{pending.current ? 'Retry this exchange' : 'Refresh stash'}</button></div>}
        {notice && <p className="stash-status" role="status">{notice}</p>}
        {stash && <>
          <section className="stash-balance" aria-label="Your private XP balance">
            <div><div className="eyebrow">XP AVAILABLE TO SAVE OR EXCHANGE</div><strong>{stash.balanceXp.toLocaleString()} XP</strong><small>{stash.lifetimeXp.toLocaleString()} lifetime XP · Character levels use lifetime XP.</small></div>
            <Gem aria-hidden="true" />
          </section>
          <p className="stash-value">{(stash.shopCreditPennies || 0).toLocaleString()} pennies of saved shop value · Gear redemption opens with checkout.</p>
          <section className="coin-purse" aria-label="Your saved coins">
            <div><span className="coin gold-coin" /><strong>{coins.gold.toLocaleString()}</strong><small>GOLD</small></div>
            <div><span className="coin silver-coin" /><strong>{coins.silver.toLocaleString()}</strong><small>SILVER</small></div>
            <div><span className="coin copper-coin" /><strong>{coins.copper.toLocaleString()}</strong><small>COPPER</small></div>
          </section>
          <section className="exchange-card" aria-labelledby="exchange-title">
            <div><div className="eyebrow">THE REALM EXCHANGE</div><h2 id="exchange-title">Turn experience into treasure.</h2><p><strong>1,250 XP = 1 gold = 100 silver = 1,000 copper</strong></p><p>1 gold = 1 penny of shop value. 125,000 XP = 100 gold = 100 pennies.</p><p>Exchanges use whole lots of 1,250 XP. Your level and lifetime XP stay unchanged.</p></div>
            <form onSubmit={event => { event.preventDefault(); setConfirming(true); }}>
              <label htmlFor="exchange-lots">Gold to receive</label>
              <input id="exchange-lots" type="number" min="1" max="100" step="1" required value={lots} disabled={busy || !!pending.current} onChange={event => {
                const value = Number(event.target.value);
                if (Number.isSafeInteger(value) && value >= 1 && value <= 100) setLots(value);
              }} />
              <small>{amount.toLocaleString()} XP → {lots} gold</small>
              <button className="primary-button" disabled={busy || stash.balanceXp < amount || !!pending.current}><ArrowRightLeft size={15} /> Exchange XP</button>
              {stash.balanceXp < amount && <small>Earn {(amount - stash.balanceXp).toLocaleString()} more XP for this exchange.</small>}
            </form>
          </section>
          <div className="stash-grid">
            <article>
              <ShoppingBag size={24} aria-hidden="true" />
              <h2>From adventure to artifact.</h2>
              <p>Save gold, silver, and copper toward actual gear from the Eldritch Fable shop.</p>
              <span className="stash-status">Gear redemption is not open yet</span>
              <p>Coin prices and checkout must be connected before purchases can use your stash. Your coins remain saved.</p>
              <Link className="secondary-button" to="/shop">Browse the shop <ArrowUpRight size={13} /></Link>
            </article>
            <article>
              <Sparkles size={24} aria-hidden="true" />
              <h2>Power worth waiting for.</h2>
              <p>Your starter class skills are included in the realm. Keep unexchanged XP for future ability unlocks. Exchanging XP reduces what is available for unlocks, without lowering your character level.</p>
              <span className="stash-status">Additional ability unlocks are being prepared</span>
              <p>Additional ability choices and their XP prices will appear here when available.</p>
              <Link className="primary-button" to="/play">Earn more XP <ArrowUpRight size={13} /></Link>
            </article>
          </div>
          <section className="stash-history" aria-labelledby="stash-history-title">
            <h2 id="stash-history-title">The record of your adventures.</h2>
            <p className="eyebrow">RECENT REWARDS AND EXCHANGES</p>
            {stash.history.length ? <ol>{stash.history.map(entry => (
              <li key={entry.id}>
                <span>{entry.reason}<time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString()}</time></span>
                <span><b>{entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString()} {entry.currency === 'COPPER' ? 'copper' : 'XP'}</b><small>{entry.balanceAfter.toLocaleString()} {entry.currency === 'COPPER' ? 'copper' : 'XP'} after transaction</small></span>
              </li>
            ))}</ol> : <p>No rewards yet. Enter the realm to begin your story.</p>}
          </section>
        </>}
      </main>
      {confirming && <div className="modal-backdrop" onClick={() => { if (!busy && !pending.current) setConfirming(false); }}>
        <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="exchange-confirm-title" onClick={event => event.stopPropagation()}>
          <div className="eyebrow">CONFIRM YOUR EXCHANGE</div>
          <h2 id="exchange-confirm-title">Trade {amount.toLocaleString()} XP for {lots} gold?</h2>
          <p>The coins will be saved to your Secret Stash. This spends your available XP; lifetime XP and your character level remain unchanged.</p>
          <div className="modal-actions">
            <button className="secondary-button" disabled={busy || !!pending.current} onClick={() => setConfirming(false)}>Keep my XP</button>
            <button className="primary-button" disabled={busy} onClick={() => void exchange()}>{busy ? 'Exchanging…' : pending.current ? 'Retry this exchange' : 'Confirm exchange'}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}