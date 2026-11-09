import { useEffect, useRef } from 'react';
import { analogAxes } from './free-controls.mjs';

export default function AnalogStick({ label, name, axes, enabled, onStart }) {
  const host = useRef(null), grip = useRef(null), pointer = useRef(null);

  function release() {
    const id = pointer.current;
    pointer.current = null;
    axes.x = axes.y = 0;
    if (grip.current) grip.current.style.transform = '';
    if (id !== null && host.current?.hasPointerCapture(id)) host.current.releasePointerCapture(id);
  }

  useEffect(() => {
    if (!enabled) release();
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      window.removeEventListener('pagehide', release);
      document.removeEventListener('visibilitychange', release);
      release();
    };
  }, [axes, enabled]);

  function steer(event) {
    if (event.pointerId !== pointer.current) return;
    const rect = event.currentTarget.getBoundingClientRect(), radius = rect.width * .34;
    const x = (event.clientX - rect.left - rect.width / 2) / radius;
    const y = (event.clientY - rect.top - rect.height / 2) / radius;
    Object.assign(axes, analogAxes(x, y));
    grip.current.style.transform = 'translate(' + axes.x * radius + 'px, ' + axes.y * radius + 'px)';
  }

  function start(event) {
    if (!enabled || document.hidden || event.button !== 0 || pointer.current !== null) return;
    event.preventDefault();
    onStart?.();
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    steer(event);
  }

  function stop(event) {
    if (event.pointerId === pointer.current) release();
  }

  return <div className="bellhouse-stick-slot">
    <div ref={host} className="bellhouse-stick" role="group" aria-label={name} aria-disabled={!enabled}
      onPointerDown={start} onPointerMove={steer} onPointerUp={stop}
      onPointerCancel={stop} onLostPointerCapture={stop}>
      <span ref={grip} className="bellhouse-stick-grip" aria-hidden="true" />
    </div>
    <span aria-hidden="true">{label}</span>
  </div>;
}
