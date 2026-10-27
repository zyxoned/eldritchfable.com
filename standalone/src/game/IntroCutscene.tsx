import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from './useDialogFocus';
import './intro.css';

const SCENES = [
  {
    chapter: 'I · THE LAST GATE',
    title: 'Six shadows. One promise.',
    caption: 'Before the woods learned to whisper, six mysterious heroes stood at the last gate. No chronicle kept their names. The Hollow King had come to unmake every story.',
  },
  {
    chapter: 'II · THE UNBROKEN COMPANY',
    title: 'Together, they held the dark.',
    caption: 'Blade and bow, spell and song, spirit and faith. Six lights struck as one against the Hollow King. Where one faltered, another stood. The realm remembers the courage of their company.',
  },
  {
    chapter: 'III · THE STORY CONTINUES',
    title: 'Their names were lost. The fable lived.',
    caption: 'The six sealed the Hollow King beyond the moon gate, then vanished into its light. Now the seal is stirring. A new company gathers in the Whispering Glade. Your chapter begins here.',
  },
];

function SixHeroes({ scene }: { scene: number }) {
  const heroes = [
    { x: 225, y: 465, color: '#92b887', style: 'bow' },
    { x: 335, y: 491, color: '#d2ac73', style: 'blade' },
    { x: 445, y: 517, color: '#c092c6', style: 'song' },
    { x: 555, y: 517, color: '#e8d2a1', style: 'faith' },
    { x: 665, y: 491, color: '#92bdd9', style: 'spell' },
    { x: 775, y: 465, color: '#82bfb1', style: 'spirit' },
  ];
  return <g className="intro-six-heroes">
    {heroes.map((hero, index) => <g key={hero.style} data-testid="intro-hero" className={'intro-hero intro-hero-' + index} transform={'translate(' + hero.x + ' ' + hero.y + ')'}>
      <ellipse cx="0" cy="21" rx="33" ry="8" fill="#00091a" opacity=".8" />
      <path d="M-13-40C-27-5-29 7-35 22Q0 39 35 22C26-1 24-15 13-40Z" fill="url(#heroCloak)" stroke={hero.color} strokeWidth="1.1" />
      <path d="M-15-41Q-16-72 0-75Q17-72 15-41L8-46Q0-51-8-46Z" fill="#18212f" stroke={hero.color} strokeWidth="1.2" />
      <path d="M-8-48Q0-64 8-48L7-36H-7Z" fill="#080e19" />
      <path d="M-8 16L-12 33M9 16L13 33" stroke="#121c29" strokeWidth="9" strokeLinecap="round" />
      <path d="M-10-10L10-10" stroke={hero.color} strokeWidth="3" />
      {hero.style === 'bow' && <><path d="M27-59Q62-19 27 14M27-59V14" fill="none" stroke="#b7c6a0" strokeWidth="3" /><path d="M8-32L45-20" stroke={hero.color} strokeWidth="3" /></>}
      {hero.style === 'blade' && <><path d="M25 11L35-87" stroke="#e8ddba" strokeWidth="5" /><path d="M20-13L43-10" stroke="#d3b37d" strokeWidth="5" /><path d="M-38-38L-17-34V-6L-28 9L-43-8Z" fill="#323343" stroke="#b6a57e" strokeWidth="2" /></>}
      {hero.style === 'song' && <><ellipse cx="25" cy="-10" rx="15" ry="20" fill="#89694d" stroke="#ddbc8a" strokeWidth="2" /><path d="M25-26L29-62" stroke="#ddbc8a" strokeWidth="7" /><path d="M23 5L30-64" stroke="#f4dc9c" strokeWidth="1" /><path className="intro-musical-rune" d="M50-54V-77L67-81V-59M49-54C41-60 38-49 46-48M66-59C58-65 55-54 63-53" fill="none" stroke="#e3b2cd" strokeWidth="2" /></>}
      {hero.style === 'faith' && <><path d="M29 20V-80M18-68H40" stroke="#e5cea0" strokeWidth="5" /><circle cx="29" cy="-68" r="18" fill="none" stroke="#edd9aa" strokeWidth="1" opacity=".5" /></>}
      {hero.style === 'spell' && <><path d="M-18-67L5-115L17-66Z" fill="#2c4057" stroke="#98b9d4" strokeWidth="1.5" /><path d="M32 24L36-76" stroke="#b4a993" strokeWidth="4" /><path d="M36-98L46-83L36-68L26-83Z" fill="#a5cce4" /><circle className="intro-spell-orb" cx="36" cy="-84" r="25" fill="url(#spellGlow)" /></>}
      {hero.style === 'spirit' && <><path d="M-36 11L36-66" stroke="#b3c5a0" strokeWidth="4" /><path d="M-35-20L-51-35M31-18L47-32" stroke="#b6d6ba" strokeWidth="5" strokeLinecap="round" /><circle cx="-50" cy="-35" r="10" fill="none" stroke="#91cebd" strokeWidth="2" /></>}
      {scene === 1 && <path className="intro-hero-beam" d={'M0-45Q' + (500 - hero.x) / 2 + ' -145 ' + (500 - hero.x) + ' ' + (215 - hero.y)} fill="none" stroke={hero.color} strokeWidth="5" opacity=".65" />}
    </g>)}
  </g>;
}

function CinematicArt({ scene }: { scene: number }) {
  return <svg className={'intro-art intro-scene-' + scene} viewBox="0 0 1000 620" role="img" aria-label={scene === 0 ? 'Six cloaked heroes face the crowned Hollow King before a broken moon gate.' : scene === 1 ? 'Six mysterious heroes combine their weapons and magic against the Hollow King.' : 'The six heroes stand before a shining sealed moon gate, leaving a path for a new company.'}>
    <defs>
      <linearGradient id="introSky" x2="0" y2="1"><stop stopColor="#1b1d38" /><stop offset=".55" stopColor="#41405a" /><stop offset="1" stopColor="#111a29" /></linearGradient>
      <radialGradient id="introMoon"><stop stopColor="#dce1d8" /><stop offset=".7" stopColor="#adb9bf" /><stop offset="1" stopColor="#8993aa" /></radialGradient>
      <radialGradient id="introGate"><stop stopColor="#e5d9ae" stopOpacity=".85" /><stop offset=".35" stopColor="#aab3d7" stopOpacity=".6" /><stop offset="1" stopColor="#8b9cc0" stopOpacity="0" /></radialGradient>
      <radialGradient id="spellGlow"><stop stopColor="#b8e4f5" stopOpacity=".65" /><stop offset="1" stopColor="#adc9ef" stopOpacity="0" /></radialGradient>
      <linearGradient id="kingRobe" x2=".3" y2="1"><stop stopColor="#202137" /><stop offset="1" stopColor="#050d19" /></linearGradient>
      <linearGradient id="heroCloak" x2="1" y2="1"><stop stopColor="#394054" /><stop offset=".55" stopColor="#172737" /><stop offset="1" stopColor="#091523" /></linearGradient>
      <linearGradient id="introMist" x2="0" y2="1"><stop stopColor="#c6cad2" stopOpacity="0" /><stop offset=".5" stopColor="#b8c4c8" stopOpacity=".13" /><stop offset="1" stopColor="#4c6880" stopOpacity="0" /></linearGradient>
    </defs>
    <path fill="url(#introSky)" d="M0 0H1000V620H0Z" />
    <g className="intro-stars" fill="#e5dfc9" opacity=".5">{Array.from({ length: 42 }, (_, i) => <circle key={i} cx={(i * 113 + 49) % 1000} cy={(i * 59 + 28) % 290} r={i % 3 ? .9 : 1.5} />)}</g>
    <circle cx="500" cy="152" r="88" fill="url(#introMoon)" opacity=".75" />
    <path d="M435 98Q461 141 431 173M487 79Q469 107 490 122M533 164Q561 181 544 208" fill="none" stroke="#7e8b9b" opacity=".35" strokeWidth="9" />
    <path d="M0 273L54 215L117 244L181 173L259 251L326 202L408 281L478 242L555 292L627 197L714 260L794 169L865 242L929 203L1000 274V620H0Z" fill="#101c2c" />
    <path d="M0 330L121 284L198 319L296 255L397 332L488 279L622 340L736 265L829 321L939 278L1000 330V620H0Z" fill="#142432" />
    <g opacity=".75" fill="#091b28">
      {Array.from({ length: 15 }, (_, i) => <path key={i} d={'M' + (i * 75 - 18) + ' 428l26-112 28 112h-17l14 27h-52l14-27Z'} />)}
    </g>
    <path d="M0 464Q230 411 500 444Q732 411 1000 461V620H0Z" fill="#1c2934" />
    <path d="M0 546Q224 461 500 470Q768 473 1000 548V620H0Z" fill="#26313b" />
    <path d="M338 620L433 411H567L662 620" fill="#56616a" opacity=".3" />
    <g className="intro-gate">
      <ellipse cx="500" cy="290" rx={scene === 2 ? 190 : 130} ry={scene === 2 ? 210 : 160} fill="url(#introGate)" opacity={scene === 2 ? .9 : .25} />
      <path d="M365 413V256Q365 99 500 98Q635 99 635 256V413" fill="none" stroke="#354251" strokeWidth="39" />
      <path d="M365 413V256Q365 99 500 98Q635 99 635 256V413" fill="none" stroke="#7c8585" strokeWidth="27" />
      <path d="M373 409V255Q372 111 500 111Q628 111 628 255V409" fill="none" stroke="#a1a39a" strokeWidth="2" />
      <path d="M350 375H383M350 313H383M350 253H383M615 375H649M615 313H649M615 253H649M385 170L407 185M438 116L451 145M500 92V123M559 116L548 145M611 170L590 185" stroke="#303d4c" strokeWidth="4" />
      <path d="M356 238L370 229L357 219M356 291L371 282L357 272M356 344L371 335L357 325M630 238L644 229L631 219M630 291L645 282L631 272M630 344L645 335L631 325" fill="none" stroke="#d0bd87" strokeWidth="2" opacity=".7" />
      {scene === 2 && <><ellipse className="intro-seal-light" cx="500" cy="270" rx="95" ry="151" fill="url(#introGate)" /><path d="M500 163L558 270L500 376L442 270Z" fill="none" stroke="#e2d4a9" strokeWidth="2" /><circle cx="500" cy="270" r="59" fill="none" stroke="#ded5ba" strokeWidth="1.5" /><path d="M467 270H533M500 237V303" stroke="#e7deb9" strokeWidth="2" /></>}
    </g>
    {scene < 2 && <g className="intro-hollow-king">
      <path d="M435 265Q400 292 389 372L365 437Q500 464 635 437L610 372Q598 289 565 265Z" fill="url(#kingRobe)" stroke="#798094" strokeWidth="1.2" />
      <path d="M441 300L412 372L436 411M559 300L588 372L564 411" fill="none" stroke="#3e4158" strokeWidth="14" />
      <path d="M463 215Q458 188 466 173L480 190L499 160L518 190L533 173Q540 189 536 215Z" fill="#3f4151" stroke="#b6a383" strokeWidth="2" />
      <path d="M465 213Q459 259 478 282L500 291L521 282Q541 259 536 213Z" fill="#101726" stroke="#6a7387" strokeWidth="2" />
      <path d="M473 235L488 241M512 241L527 235" stroke="#c1b0d7" strokeWidth="3" strokeLinecap="round" />
      <path d="M488 269L500 263L512 269" fill="none" stroke="#62667c" strokeWidth="2" />
      <path d="M421 314L387 283L379 325L409 344M579 314L613 283L621 325L591 344" fill="#31354b" stroke="#818297" strokeWidth="1.5" />
      <path d="M503 295L477 337L500 378L525 337Z" fill="none" stroke="#7e7398" strokeWidth="2" />
      <g className="intro-king-shadow" fill="none" stroke="#8b82a6" strokeWidth="3" opacity=".45"><path d="M410 320Q310 292 306 178" /><path d="M590 320Q690 292 694 178" /></g>
    </g>}
    <g className="intro-battle-runes" opacity={scene === 1 ? .75 : .2} fill="none" stroke="#b8c7d0">
      <ellipse cx="500" cy="359" rx="170" ry="36" strokeWidth="1" />
      <ellipse cx="500" cy="359" rx="155" ry="29" strokeWidth=".6" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={'M' + (500 + Math.cos(i * Math.PI / 6) * 162) + ' ' + (359 + Math.sin(i * Math.PI / 6) * 32) + 'l3-6 4 6-4 3Z'} />)}
    </g>
    <SixHeroes scene={scene} />
    <path className="intro-mist intro-mist-one" d="M0 409Q237 366 501 407Q754 367 1000 409V487Q754 447 501 481Q237 446 0 487Z" fill="url(#introMist)" />
    <path className="intro-mist intro-mist-two" d="M0 525Q237 484 501 518Q754 485 1000 525V600H0Z" fill="url(#introMist)" />
    {scene === 1 && <g className="intro-impact"><circle cx="500" cy="255" r="49" fill="url(#spellGlow)" /><path d="M461 220L536 291M464 289L537 218M500 204V306" stroke="#e8e3c6" strokeWidth="1" opacity=".7" /></g>}
    <path fill="#070c15" opacity=".45" d="M0 0H1000V34H0ZM0 594H1000V620H0Z" />
  </svg>;
}

export default function IntroCutscene({ open, onComplete }: { open: boolean; onComplete: () => void }) {
  const [scene, setScene] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [paused, setPaused] = useState(reduced);
  const complete = useRef(onComplete); complete.current = onComplete;
  const dialogRef = useDialogFocus(open, () => complete.current());

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(query.matches); if (query.matches) setPaused(true); };
    query.addEventListener('change', update); return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) { setScene(0); setPaused(reduced); if (!dialog.open) dialog.showModal(); }
    else if (dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [open]);
  useEffect(() => {
    if (!open || paused) return;
    const timer = window.setTimeout(() => { if (scene < 2) setScene(value => value + 1); else complete.current(); }, 8000);
    return () => window.clearTimeout(timer);
  }, [open, scene, paused]);

  const next = () => { if (scene < 2) setScene(value => value + 1); else complete.current(); };
  const current = SCENES[scene];
  return <dialog ref={dialogRef} className={'ef-intro-dialog' + (paused ? ' intro-paused' : '') + (reduced ? ' intro-reduced-motion' : '')}
    aria-labelledby="intro-title" aria-describedby="intro-caption"
    onCancel={event => { event.preventDefault(); complete.current(); }}>
    <div className="intro-cinema-header">
      <span>ELDRITCH FABLE <i /> THE FIRST COMPANY</span>
      <button type="button" onClick={() => complete.current()}>Skip intro <span aria-hidden="true">↗</span></button>
    </div>
    <div className="intro-film"><CinematicArt scene={scene} /><span className="intro-film-mark" aria-hidden="true">SIX LIGHTS AGAINST THE HOLLOW</span></div>
    <div className="intro-story">
      <div className="intro-scene-indicator"><span>{current.chapter}</span><span>{scene + 1} / 3</span></div>
      <h2 id="intro-title">The Six at the Last Gate</h2>
      <h3>{current.title}</h3>
      <p id="intro-caption" aria-live="polite">{current.caption}</p>
      <div className="intro-timeline" aria-hidden="true">{SCENES.map((_, i) => <span key={i} className={i < scene ? 'complete' : i === scene ? 'current' : ''}><i key={String(scene) + '-' + String(paused)} /></span>)}</div>
      <div className="intro-cinema-controls">
        <button type="button" className="intro-pause" onClick={() => setPaused(value => !value)}>{paused ? 'Play cinematic' : 'Pause cinematic'}</button>
        <span>{reduced ? 'Reduced motion · advance at your own pace' : 'A legend shared by every adventurer'}</span>
        <button type="button" className="intro-next" onClick={next}>{scene < 2 ? 'Next scene' : 'Enter the story'} <span aria-hidden="true">→</span></button>
      </div>
    </div>
  </dialog>;
}
