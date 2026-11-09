import { useId, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import './adventure-journal.css';

export default function AdventureJournal({ open, onClose, pages, onPageChange, feedback }) {
  const id = useId();
  const dialog = useRef(null);
  const tabList = useRef(null);
  const content = useRef(null);
  const backdropPressed = useRef(false);
  const [selectedId, setSelectedId] = useState(pages[0]?.id);
  const activeId = pages.some(page => page.id === selectedId) ? selectedId : pages[0]?.id;

  useLayoutEffect(() => {
    if (!open) return;

    const element = dialog.current;
    const opener = document.activeElement;
    element.showModal();
    tabList.current.querySelector('[aria-selected="true"]')?.focus();

    return () => {
      element.close();
      if (document.activeElement === document.body && opener instanceof HTMLElement && opener.getClientRects().length) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open]);

  useLayoutEffect(() => {
    content.current.scrollTop = 0;
    if (open) onPageChange(activeId);
  }, [activeId, open, onPageChange]);

  function handleTabKey(event, index) {
    let next;
    switch (event.key) {
      case 'ArrowLeft': next = (index + pages.length - 1) % pages.length; break;
      case 'ArrowRight': next = (index + 1) % pages.length; break;
      case 'Home': next = 0; break;
      case 'End': next = pages.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setSelectedId(pages[next].id);
    tabList.current.children[next].focus();
  }

  function isBackdrop(event) {
    if (event.target !== event.currentTarget) return false;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
  }

  return <dialog
    ref={dialog}
    className="adventure-journal"
    aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onPointerDown={event => { backdropPressed.current = isBackdrop(event); }}
    onClick={event => { if (backdropPressed.current && isBackdrop(event)) onClose(); }}
  >
    <div className="adventure-journal-heading">
      <span className="adventure-journal-emblem" aria-hidden="true"><BookOpen size={20} /></span>
      <div>
        <span className="adventure-journal-kicker">Eldritch Fable</span>
        <h2 id={`${id}-title`}>Adventure journal</h2>
      </div>
      <button type="button" className="adventure-journal-close" aria-label="Close journal" onClick={onClose}><X size={21} /></button>
    </div>
    <div ref={tabList} className="adventure-journal-tabs" role="tablist" aria-label="Journal pages">
      {pages.map((page, index) => <button
        key={page.id}
        id={`${id}-${page.id}-tab`}
        className="adventure-journal-tab"
        type="button"
        role="tab"
        aria-selected={page.id === activeId}
        aria-controls={`${id}-${page.id}-page`}
        tabIndex={page.id === activeId ? 0 : -1}
        onClick={() => setSelectedId(page.id)}
        onKeyDown={event => handleTabKey(event, index)}
      >{page.label}</button>)}
    </div>
    {feedback}
    <div ref={content} className="adventure-journal-content">
      {pages.map(page => <section
        key={page.id}
        id={`${id}-${page.id}-page`}
        className="adventure-journal-page"
        role="tabpanel"
        aria-labelledby={`${id}-${page.id}-tab`}
        tabIndex={0}
        hidden={page.id !== activeId}
      >{page.content}</section>)}
    </div>
  </dialog>;
}
