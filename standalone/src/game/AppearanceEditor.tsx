import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw, X } from 'lucide-react';
import { APPEARANCE_OPTIONS, sanitizeAppearance, defaultAppearance } from '../../shared/appearance-catalog.mjs';
import { renderCharacterPreview } from '../../shared/hero-renderer.mjs';
import { CLASSES, type Player, type Appearance } from './shared/game';
import { useDialogFocus } from './useDialogFocus';

const fields: Array<[keyof Appearance, string]> = [
  ['skinTone', 'Skin tone'], ['hairStyle', 'Hair style'], ['hairColor', 'Hair color'],
  ['outfit', 'Clothing palette'], ['accent', 'Trim'], ['build', 'Build'],
];

export default function AppearanceEditor({ player, onSave, onClose }: {
  player: Player; onSave: (appearance: Appearance) => Promise<void>; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Appearance>(() => sanitizeAppearance(player.appearance));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [facing, setFacing] = useState(Math.PI / 2);
  const [pose, setPose] = useState<'idle' | 'walk' | 'attack'>('idle');
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useDialogFocus(true, () => { if (!pending) onClose(); });

  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const draw = (stamp: number) => {
      const time = stamp / 1000;
      renderCharacterPreview(target, {
        classId: player.heroClass, appearance: draft, facingX: Math.cos(facing), facingY: Math.sin(facing),
        motion: { heading: facing, speed: pose === 'walk' ? 3.8 : 0, phase: time * 9, leanX: 0, leanY: 0 },
      }, { time, facing, moving: pose === 'walk', attackFx: pose === 'attack' ? .24 * (1 - (time % 1.5) / 1.5) : 0, reducedMotion: reduced.matches, classColor: CLASSES[player.heroClass].color });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [draft, facing, pose, player.heroClass]);

  return <div className="modal-backdrop" onClick={() => { if (!pending) onClose(); }}>
    <section ref={dialog} className="modal appearance-modal" role="dialog" aria-modal="true" aria-labelledby="appearance-title" onClick={event => event.stopPropagation()}>
      <button type="button" className="modal-close icon-button" aria-label="Cancel character customization" disabled={pending} onClick={onClose}><X size={20} /></button>
      <div className="eyebrow">YOUR CHARACTER</div>
      <h2 id="appearance-title">Make this hero yours</h2>
      <p>{CLASSES[player.heroClass].name} · Your calling, equipment and combat power stay the same.</p>
      <div className="appearance-layout">
        <div className="appearance-preview">
          <canvas ref={canvas} width={280} height={280} aria-label={CLASSES[player.heroClass].name + ' appearance preview'} />
          <div className="appearance-turn"><button type="button" aria-label="Turn preview left" onClick={() => setFacing(v => v - Math.PI / 2)}><RotateCcw size={16} /></button><span>Turn your hero</span><button type="button" aria-label="Turn preview right" onClick={() => setFacing(v => v + Math.PI / 2)}><RotateCw size={16} /></button></div>
          <div className="appearance-poses" aria-label="Preview motion">
            {(['idle', 'walk', 'attack'] as const).map(value => <button type="button" key={value} aria-pressed={pose === value} onClick={() => setPose(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
          </div>
        </div>
        <div className="appearance-fields">
          {fields.map(([field, label]) => <div key={field}><label htmlFor={"appearance-field-" + field}>{label}</label><select id={"appearance-field-" + field} aria-label={label} value={draft[field]} disabled={pending} onChange={event => setDraft(v => ({ ...v, [field]: event.target.value }))}>
            {APPEARANCE_OPTIONS[field].map((option: { id: string; label: string }) => <option value={option.id} key={option.id}>{option.label}</option>)}
          </select></div>)}
          <button type="button" className="appearance-reset" disabled={pending} onClick={() => setDraft(defaultAppearance())}>Reset preview</button>
        </div>
      </div>
      {error && <p className="appearance-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Cancel</button><button type="button" className="primary-button" disabled={pending} onClick={async () => {
        setPending(true); setError('');
        try { await onSave(draft); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this look. Please try again.'); setPending(false); }
      }}>{pending ? 'Saving look…' : 'Save look'}</button></div>
    </section>
  </div>;
}
