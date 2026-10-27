import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BookOpen, Shield, Sparkles, Sword } from 'lucide-react';
import { CLASSES, type HeroClass } from './shared/game';

type EquippedItem = { id: string; name: string; slot: string; rarity: string; description: string };

export function CallingPreview({ heroClass }: { heroClass: HeroClass }) {
  const calling = CLASSES[heroClass];
  return <section className="calling-preview" aria-label={calling.name + ' calling'} style={{ '--calling-color': calling.color } as CSSProperties}>
    <div className="calling-title"><span>{calling.role}</span><strong>{calling.name}</strong></div>
    <p className="calling-summary">{calling.description}</p>
    <p className="calling-lore">{calling.lore}</p>
    <div className="calling-stats"><span><Sword size={12} /> {calling.damage} damage</span><span>{calling.range}-tile reach</span><span><Shield size={12} /> {calling.armor} armor</span></div>
    <h3>Your starter skills</h3>
    <dl className="calling-skill-list">{calling.skills.map(skill => <div key={skill.id}><dt>{skill.name}</dt><dd>{skill.description}</dd></div>)}</dl>
    <details className="starter-equipment"><summary>Starting equipment · {calling.equipment.length} items</summary><EquipmentList items={calling.equipment} /></details>
    <small className="starter-note">Your calling, skills, and equipment are saved with your character. Starter skills cost no XP.</small>
  </section>;
}

export function EquipmentList({ items }: { items: EquippedItem[] }) {
  return <ul className="equipment-list" aria-label="Equipped items">{items.map(item => <li key={item.id}>
    <span className="equipment-slot">{item.slot}</span><strong>{item.name}</strong><span className={'equipment-rarity ' + (item.rarity === 'SSS' ? 'sss' : '')}>{item.rarity}</span><p>{item.description}</p>
  </li>)}</ul>;
}

export function CharacterCalling({ heroClass, equipment }: { heroClass: HeroClass; equipment?: EquippedItem[] }) {
  const calling = CLASSES[heroClass];
  return <section className="card calling-card" aria-label="Character lore and equipment">
    <div className="section-kicker"><BookOpen size={13} /> YOUR CALLING</div>
    <h2>Your calling</h2><div className="calling-title"><strong>{calling.name}</strong><span>{calling.role}</span></div>
    <p className="calling-lore">{calling.lore}</p>
    <h3>Equipped for the journey</h3><EquipmentList items={equipment || calling.equipment} />
  </section>;
}

export function SkillBar({ heroClass, cooldowns = {}, serverTime, enabled, onUse }: {
  heroClass: HeroClass; cooldowns?: Record<string, number>; serverTime: number; enabled: boolean; onUse: (skillId: string) => void;
}) {
  const skills = CLASSES[heroClass].skills;
  const [clock, setClock] = useState(Date.now);
  const offset = useRef(serverTime - Date.now());
  useEffect(() => { offset.current = serverTime - Date.now(); }, [serverTime]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  const serverNow = clock + offset.current;
  return <section className="skill-panel" aria-label="Class skills">
    <div className="skill-panel-heading"><span><Sparkles size={14} /> CLASS SKILLS</span><small>Starter skills · no XP cost</small></div>
    <div className="skill-bar">{skills.map((skill, index) => {
      const seconds = Math.max(0, Math.ceil(((cooldowns[skill.id] || 0) - serverNow) / 1000));
      const passive = skill.type === 'passive';
      return passive ? <div className="skill-button skill-passive" key={skill.id}><span className="skill-symbol"><Shield size={19} /></span><strong>{skill.name}</strong><small>Passive · always active</small><span className="skill-description">{skill.description}</span></div>
        : <button type="button" key={skill.id} className={'skill-button ' + (seconds ? 'cooling-down' : '')} aria-label={skill.name} aria-describedby={'skill-description-' + skill.id} disabled={!enabled || seconds > 0} onClick={() => onUse(skill.id)}>
          <span className="skill-symbol">{skill.type === 'ward' || skill.type === 'heal' ? <Shield size={19} /> : <Sparkles size={19} />}</span><strong>{skill.name}</strong><small>{seconds ? seconds + 's · recovering' : 'Ready'} <kbd>{index + 1}</kbd></small><span className="skill-description" id={'skill-description-' + skill.id}>{skill.description}</span>
        </button>;
    })}</div>
  </section>;
}
