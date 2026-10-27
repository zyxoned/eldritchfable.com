import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../game/useDialogFocus.js';

const INVITE_URL = 'https://eldritchfable.com/play';

export default function AdventureWelcome({ open, onDismiss, returnFocusRef, pending = false, needsVerification = false }) {
  const dialogRef = useDialogFocus(open, onDismiss);
  const inviteRef = useRef(null);
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) {
      setInviteMessage('');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef?.current?.focus();
    }
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(INVITE_URL);
      setInviteMessage('Invite link copied. Share it with your friends!');
    } catch {
      inviteRef.current?.focus();
      inviteRef.current?.select();
      setInviteMessage('Copy the selected link and share it with your friends.');
    }
  }

  return <dialog ref={dialogRef} className="adventure-welcome" aria-labelledby="adventure-welcome-title" aria-describedby="adventure-welcome-intro"
    onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <div className="adventure-welcome-heading">
      <span className="adventure-welcome-eyebrow">A new chapter in Eldritch Fable</span>
      <button type="button" className="auth-secondary adventure-welcome-close" aria-label="Close adventure welcome" onClick={onDismiss}>×</button>
    </div>
    <h2 id="adventure-welcome-title">Your adventure keeps going.</h2>
    <p id="adventure-welcome-intro">Your site account also opens the door to a shared realm, right here on Eldritch Fable.</p>
    <ul className="adventure-welcome-features">
      <li><h3>A character to call your own</h3><p>Create a persistent character linked to your account. Your character, progress, and private Secret Stash stay with you when you leave and return.</p></li>
      <li><h3>Bring your friends</h3><p>Play together with up to six adventurers in the realm at a time. Be sure to invite your friends!</p></li>
      <li><h3>Earn XP. Build your stash.</h3><p>Earn XP as you play, then trade it for gold, silver, or copper in your Secret Stash. Save your coins toward actual gear from the shop, or keep your XP for future abilities.</p>
        <p className="adventure-welcome-rate"><strong>1,250 XP = 1 gold = 100 silver = 1,000 copper.</strong><br />1 gold is worth 1 penny.</p>
        <p className="adventure-welcome-note">XP exchange is open now. Buying shop gear with coins and unlocking abilities are coming soon.</p>
      </li>
    </ul>
    <div className="adventure-welcome-invite">
      <label htmlFor="adventure-invite-link">Invite your party</label>
      <div><input ref={inviteRef} id="adventure-invite-link" aria-label="Adventure invite link" type="url" readOnly value={INVITE_URL} onFocus={event => event.currentTarget.select()} />
        <button type="button" className="auth-secondary" onClick={copyInvite}>Copy invite link</button></div>
      {inviteMessage && <p role="status">{inviteMessage}</p>}
    </div>
    {needsVerification && <p className="adventure-welcome-verification">Verify your email and sign in before creating your character and entering the realm.</p>}
    <button type="button" className="adventure-welcome-done" onClick={onDismiss}>{pending ? 'Got it — check my inbox' : 'Got it'}</button>
  </dialog>;
}
