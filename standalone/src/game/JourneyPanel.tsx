import EncounterCanvas from './EncounterCanvas';
import { useEffect, useRef, useState } from 'react';
import type { Player } from './shared/game';
import './journey.css';

type Props = {
  journey: any;
  authored: any;
  player: Player;
  enabled: boolean;
  serverTime?: number;
  onAction: (kind: string, extra?: Record<string, unknown>) => void;
};

// This component renders only the authenticated viewer's earned server projection.
// It contains no future destinations, story catalog, eligibility rules or outcomes.
export default function JourneyPanel({ journey, authored, player, enabled, serverTime = Date.now(), onAction }: Props) {
  const [clock, setClock] = useState(Date.now());
  const anchor = useRef({ serverTime, receivedAt: Date.now() });
  if (anchor.current.serverTime !== serverTime) anchor.current = { serverTime, receivedAt: Date.now() };
  const now = anchor.current.serverTime + Math.max(0, clock - anchor.current.receivedAt);
  const encounter = authored?.encounter;
  const active = journey?.active;
  const timers = !!encounter || !!active;
  useEffect(() => {
    if (!timers) return;
    const timer = window.setInterval(() => { if (!document.hidden) setClock(Date.now()); }, 200);
    return () => window.clearInterval(timer);
  }, [timers]);
  if (!encounter && !active && !journey?.nearby?.length && !authored?.equipment?.length && !authored?.effects?.length) return null;
  return <section className="journey-scene card" aria-label="Your journey">
    {encounter ? <>
      <div className="section-kicker">YOUR JOURNEY</div><h2>{encounter.title}</h2>
      <EncounterCanvas scene={{ name: encounter.title, theme: 'ruins' }}
        enemy={encounter.enemyMaxHp ? { name: 'Your opponent', hp: encounter.enemyHp, maxHp: encounter.enemyMaxHp } : null}
        members={[{ playerId: player.id, name: player.name, heroClass: player.heroClass, hp: encounter.hp, maxHp: encounter.maxHp }]} />
      <p className="scene-description">{encounter.text}</p>
      <div className="journey-actions">
        {encounter.canAttack && <button type="button" disabled={!enabled || encounter.attackReadyAt > now} className="attack-button" onClick={() => onAction('encounterAttack', { eventId: encounter.id })}>Attack</button>}
        {(encounter.canAttack ? encounter.skills || [] : []).map((skill: any) => <button type="button" key={skill.id} disabled={!enabled || skill.readyAt > now} className="secondary-button" onClick={() => onAction('encounterSkill', { eventId: encounter.id, skillId: skill.id })}>{skill.name}</button>)}
        {encounter.canRecover && <button type="button" disabled={!enabled} className="secondary-button" onClick={() => onAction('encounterReturn', { eventId: encounter.id })}>Return safely</button>}
        {!encounter.witnessed && !encounter.canContinue && <button type="button" disabled={!enabled} className="secondary-button" onClick={() => onAction('encounterWitness', { eventId: encounter.id, sceneKey: encounter.sceneKey })}>Take this in</button>}
        {encounter.canContinue && <button type="button" disabled={!enabled} className="secondary-button" onClick={() => onAction('encounterContinue', { eventId: encounter.id, sceneKey: encounter.sceneKey })}>Continue</button>}
      </div>
      {!encounter.canAttack && !encounter.canContinue && <p>Your companions can continue. Your place is saved if you reconnect.</p>}
    </> : active ? <>
      <div className="section-kicker">{active.routeName} · STAGE {active.stage} / {active.stageCount}</div>
      <h2>{active.scene.name}</h2>
      <EncounterCanvas scene={active.scene} enemy={active.enemy} members={active.members} />
      <p className="scene-description">{active.scene.description}</p>
      <div className="journey-actions">
        {active.actions.attack && <button type="button" className="attack-button" disabled={!enabled || active.actions.attackReadyAt > now} onClick={() => onAction('expeditionAttack')}>Attack</button>}
        {(active.actions.skills || []).map((skill: any) => <button type="button" className="secondary-button" key={skill.id} disabled={!enabled || skill.readyAt > now} onClick={() => onAction('expeditionSkill', { skillId: skill.id })}>{skill.name}</button>)}
        {active.actions.advance && <button type="button" className="secondary-button" disabled={!enabled} onClick={() => onAction('expeditionAdvance')}>Continue onward</button>}
        {active.actions.rest && <button type="button" className="secondary-button" disabled={!enabled} onClick={() => onAction('expeditionRest')}>Rest at camp</button>}
        {active.actions.return && <button type="button" className="secondary-button" disabled={!enabled} onClick={() => onAction('expeditionReturn')}>Return to entrance</button>}
      </div>
      <p className="journey-footnote">Move onward when you choose. Only companions in this chamber can fight or heal together. Your progress stays saved.</p>
    </> : <>
      {(journey?.nearby || []).map((place: any) => <div className="journey-discovery" key={place.id}>
        <div><h3>{place.label}</h3><p>{place.discovered ? 'A passage you can enter when you choose.' : 'Something here invites a closer look.'}</p></div>
        <button type="button" className="secondary-button" disabled={!enabled} onClick={() => onAction(place.discovered ? 'expeditionEnter' : 'expeditionDiscover', { routeId: place.id })}>{place.discovered ? 'Enter passage' : 'Investigate'}</button>
      </div>)}
    </>}
    {!!authored?.equipment?.length && <details className="journey-possessions"><summary>Your equipment</summary>
      {authored.equipment.map((item: any) => <div className="journey-discovery" key={item.id}><span>{item.name}<small>{item.slot} · Bound to your class</small></span>
        <button type="button" disabled={!enabled || !!encounter || !!active || item.equipped} className="secondary-button" onClick={() => onAction('equip', { itemId: item.id })}>{item.equipped ? 'Equipped' : 'Equip'}</button></div>)}
    </details>}
    {!!authored?.effects?.length && <details className="journey-possessions"><summary>Your lasting effects</summary><ul>{authored.effects.map((effect: any, index: number) => <li key={index}>{effect.name}</li>)}</ul></details>}
  </section>;
}
