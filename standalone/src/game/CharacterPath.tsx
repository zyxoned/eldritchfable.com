import { useEffect, useState } from 'react';
import { Check, Shield, Sparkles } from 'lucide-react';
import { STANCES, TACTICS, tacticalAdvice } from '../../shared/character-development.mjs';
import { CLASSES, type Player, type Realm } from './shared/game';
export type Development = { level: number; role: string; stanceId: string; tacticId: string; availableStances: string[]; lessons: { id: string; name: string; level: number; unlocked: boolean; description: string }[] };
export default function CharacterPath({ player, development, realm, cooldowns = {}, enabled, onSave }: {
  player: Player; development?: Development | null; realm: Realm | null; cooldowns?: Record<string, number>; enabled: boolean; onSave: (stanceId: string, tacticId: string) => Promise<boolean>;
}) {
  const [stanceId, setStance] = useState(development?.stanceId || 'balanced');
  const [tacticId, setTactic] = useState(development?.tacticId || 'manual');
  useEffect(() => { setStance(development?.stanceId || 'balanced'); setTactic(development?.tacticId || 'manual'); }, [player.id, development?.stanceId, development?.tacticId]);
  if (!development) return null;
  const changed = stanceId !== development.stanceId || tacticId !== development.tacticId;
  const ready = CLASSES[player.heroClass].skills.find(skill => skill.type !== 'passive' && (cooldowns[skill.id] || 0) <= (realm?.serverTime || 0));
  const advice = tacticalAdvice({ tacticId: development.tacticId, hp: player.hp, nearEnemy: realm?.enemies.some(enemy => enemy.hp > 0 && Math.hypot(enemy.x-player.x, enemy.y-player.y) <= 4), readySkillName: ready?.name || '' });
  return <section className="card character-path" aria-label="Character path">
    <div className="section-kicker"><Sparkles size={13} /> GROW INTO YOUR CALLING</div>
    <h2>Character path</h2><p>{development.role} · Level {development.level}</p>
    <div className="path-current"><Shield size={14} /><strong>{STANCES.find(item => item.id === development.stanceId)?.name}</strong><span>Current stance</span></div>
    <p className="tactical-advice">{advice}</p>
    <details><summary>Lessons &amp; battle preferences</summary>
      <ol className="path-lessons">{development.lessons.map(lesson => <li key={lesson.id} className={lesson.unlocked ? 'unlocked' : 'locked'}>
        <span className="lesson-mark">{lesson.unlocked ? <Check size={12} /> : lesson.level}</span><div><strong>{lesson.name}</strong><small>{lesson.unlocked ? 'Learned' : 'Unlocks at level ' + lesson.level}</small><p>{lesson.description}</p></div>
      </li>)}</ol>
      <label htmlFor="hero-stance">Battle stance</label>
      <select id="hero-stance" value={stanceId} disabled={!enabled} onChange={event => setStance(event.target.value)}>{STANCES.map(stance => <option key={stance.id} value={stance.id} disabled={!development.availableStances.includes(stance.id)}>{stance.name}{development.availableStances.includes(stance.id) ? '' : ' · Level ' + stance.level}</option>)}</select>
      <p>{STANCES.find(item => item.id === stanceId)?.description}</p>
      <label htmlFor="hero-tactic">Tactical advice</label>
      <select id="hero-tactic" value={tacticId} disabled={!enabled} onChange={event => setTactic(event.target.value)}>{TACTICS.map(tactic => <option key={tactic.id} value={tactic.id}>{tactic.name}</option>)}</select>
      <p>{TACTICS.find(item => item.id === tacticId)?.description}</p>
      <button type="button" className="secondary-button" disabled={!enabled || !changed} onClick={() => void onSave(stanceId, tacticId)}>Save battle preferences</button>
      <small className="path-note">Unlocked by lifetime XP. No XP or coins are spent. Advice never plays for you.</small>
    </details>
  </section>;
}
