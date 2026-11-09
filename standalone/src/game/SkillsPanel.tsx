import { useEffect, useId, useRef, useState } from 'react';
import { Fish, Leaf, Navigation, Pickaxe, Sprout } from 'lucide-react';
import { RESOURCE_NODES } from '../../shared/skill-catalog.mjs';
import { DEFAULT_REGION_ID, regionById, type GatheringProfile, type GatheringSkillId, type Player, type Realm } from './shared/game';

const ICONS = { foraging: Leaf, mining: Pickaxe, fishing: Fish };
const VERBS = { foraging: 'Forage', mining: 'Mine', fishing: 'Fish' };
const seconds = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));

export default function SkillsPanel({ player, realm, gathering, enabled, supplyEnabled = enabled, inventoryFirst = false, onWalk, onGather, onUseSupply }: {
  player: Player; realm: Realm | null; gathering?: GatheringProfile | null; enabled: boolean; supplyEnabled?: boolean; inventoryFirst?: boolean;
  onUseSupply?: (materialId: string) => Promise<boolean>;
  onWalk: (x: number, y: number) => void; onGather: (nodeId: string) => Promise<boolean>;
}) {
  const titleId = useId();
  const [clock, setClock] = useState(Date.now());
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const anchor = useRef({ realm, serverTime: realm?.serverTime || Date.now(), receivedAt: Date.now() });
  if (anchor.current.realm !== realm) anchor.current = { realm, serverTime: realm?.serverTime || Date.now(), receivedAt: Date.now() };
  const now = anchor.current.serverTime + Math.max(0, clock - anchor.current.receivedAt);
  const nodes = (realm?.resourceNodes || []).filter(node => node.regionId === (realm?.regionId || DEFAULT_REGION_ID));
  const hasTimer = !!gathering && (gathering.cooldownUntil > now || nodes.some(node => node.availableAt > now));
  useEffect(() => {
    if (!hasTimer) return;
    const tick = () => { if (!document.hidden) setClock(Date.now()); };
    tick();
    const timer = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [hasTimer, realm?.serverTime]);
  useEffect(() => { setPending(null); setFeedback(''); }, [player.id, realm?.regionId]);
  if (!gathering) return null;
  const busy = pending !== null;
  const cooldown = seconds(gathering.cooldownUntil, now);
  const totalMaterials = gathering.inventory.reduce((sum, item) => sum + item.quantity, 0);
  const nearest = [...nodes].sort((a, b) => Math.hypot(player.x-a.x, player.y-a.y) - Math.hypot(player.x-b.x, player.y-b.y))[0];

  async function gather(nodeId: string) {
    if (!enabled || busy) return;
    setPending(nodeId); setFeedback('');
    try {
      const accepted = await onGather(nodeId);
      setFeedback(accepted ? 'Gathered. Your skill progress is saved.' : 'Gathering did not complete. Check the realm message before trying again.');
    }
    catch { setFeedback('Gathering was interrupted. Check your connection and try again.'); }
    finally { setPending(null); }
  }

  async function useSupply(materialId: string) {
    if (!supplyEnabled || !onUseSupply || busy || cooldown > 0 || player.hp >= (player.maxHp || 100)) return;
    setPending('supply:' + materialId); setFeedback('');
    try {
      const accepted = await onUseSupply(materialId);
      setFeedback(accepted ? 'Supply used. Your health and pouch are updated.' : 'The supply was not used. Check the realm message before trying again.');
    }
    catch { setFeedback('The request was interrupted. Check your connection before trying again.'); }
    finally { setPending(null); }
  }

  const materialsPouch = (
    <details className="gathering-pack" open={inventoryFirst || undefined}><summary>Materials pouch <span>{totalMaterials} collected</span></summary>
      {totalMaterials ? <ul>{gathering.inventory.filter(item => item.quantity > 0).map(item => <li key={item.id} className="supply-row">
        <span>{item.name}{!!item.healHp && <small>Restores up to {item.healHp} health</small>}</span><strong aria-label={item.quantity + ' in pouch'}>{item.quantity}</strong>
        {!!item.healHp && <button type="button" className="supply-use" aria-label={'Use ' + item.name + ' to restore up to ' + item.healHp + ' health'}
          disabled={!supplyEnabled || !onUseSupply || busy || cooldown > 0 || player.hp <= 0 || player.hp >= (player.maxHp || 100)}
          onClick={() => void useSupply(item.id)}>
          {pending === 'supply:' + item.id ? 'Using…' : player.hp >= (player.maxHp || 100) ? 'Full health' : cooldown ? `Ready in ${cooldown}s` : `Use (+${item.healHp} HP)`}
        </button>}
      </li>)}</ul> : <p>Your first gathering action will add materials here.</p>}
      <p>Herbs and fish restore health when you use them. Mining supplies are saved for future crafting; crafting is not available yet.</p>
      <small>Up to {gathering.maxInventory} of each material. A full stack still allows skill practice.</small>
    </details>
  );

  return <section className="card gathering-card" aria-labelledby={titleId}>
    <div className="gathering-heading"><div><span className="section-kicker">PRACTICE. EXPLORE. GROW.</span><h2 id={titleId}>Wilderness skills</h2></div><Sprout size={22} aria-hidden="true" /></div>
    {inventoryFirst && materialsPouch}
    <p className="gathering-intro">Build a craft between battles. Higher skill levels open richer gathering grounds.</p>
    <div className="gathering-skills">{gathering.skills.map(skill => {
      const Icon = ICONS[skill.id];
      const capped = skill.level >= skill.maxLevel;
      const next = RESOURCE_NODES.filter(node => node.skillId === skill.id && node.requiredLevel > skill.level).sort((a, b) => a.requiredLevel - b.requiredLevel)[0];
      return <div className={'gathering-skill skill-' + skill.id} key={skill.id}>
        <div className="gathering-skill-title"><Icon size={16} aria-hidden="true" /><strong>{skill.name}</strong><span>Lv. {skill.level}</span></div>
        <progress aria-label={skill.name + ' progress to next level'} value={capped ? 1 : skill.levelXp} max={capped ? 1 : Math.max(1, skill.nextLevelXp)} />
        <div className="gathering-skill-progress"><span>{capped ? 'Mastered' : `${skill.levelXp} / ${skill.nextLevelXp} skill XP`}</span><span>{skill.totalGathered} gathered</span></div>
        <small>{next ? `Level ${next.requiredLevel}: ${regionById(next.regionId).name}` : 'All current gathering grounds unlocked'}</small>
      </div>;
    })}</div>
    <div className="gathering-spots-heading"><h3>Gathering grounds</h3><span>{regionById(realm?.regionId).name}</span></div>
    <p className="gathering-route-hint">{nearest ? `Closest: ${nearest.name}. Walk to a marker, then gather.` : 'Explore a region to find gathering grounds.'}</p>
    <ul className="gathering-spots">{nodes.map(node => {
      const skill = gathering!.skills.find(item => item.id === node.skillId);
      const Icon = ICONS[node.skillId as GatheringSkillId];
      const near = Math.hypot(player.x-node.x, player.y-node.y) <= 1.6;
      const locked = !skill || skill.level < node.requiredLevel;
      const regrowing = seconds(node.availableAt, now);
      const wait = Math.max(regrowing, cooldown);
      const status = locked ? `Requires ${skill?.name || node.skillId} level ${node.requiredLevel}` : regrowing ? `Regrows in ${regrowing}s` : cooldown ? `Ready in ${cooldown}s` : near ? 'Within reach' : `${Math.ceil(Math.hypot(player.x-node.x, player.y-node.y))} tiles away`;
      const label = pending === node.id ? 'Gathering…' : !near ? 'Walk here' : locked ? `Level ${node.requiredLevel}` : wait ? `Ready in ${wait}s` : VERBS[node.skillId];
      return <li key={node.id} className={'gathering-spot' + (near ? ' is-near' : '') + (locked ? ' is-locked' : '')}>
        <span className={'gathering-node-icon skill-' + node.skillId}><Icon size={18} aria-hidden="true" /></span>
        <div className="gathering-node-copy"><strong>{node.name}</strong><span>{status}</span><small>+{node.xp} {skill?.name.toLowerCase() || node.skillId} XP</small></div>
        <button type="button" className="gathering-action" aria-label={(near ? 'Gather ' : 'Walk to ') + node.name} title={status}
          disabled={!enabled || busy || (near && (locked || wait > 0))}
          onClick={() => near ? void gather(node.id) : onWalk(node.x, node.y)}>
          {!near && <Navigation size={12} aria-hidden="true" />}{label}
        </button>
      </li>;
    })}</ul>
    <div className="gathering-feedback" role="status" aria-live="polite">{pending ? 'Waiting for the realm to confirm your action…' : feedback}</div>
    {!inventoryFirst && materialsPouch}
    <p className="gathering-footnote">Saved to your character. Skill XP and materials are separate from reward XP and cannot be exchanged for coins or shop rewards. Each gather is a manual action.</p>
  </section>;
}
