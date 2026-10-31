import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

// Accessible modal: focus moves in, Escape and backdrop close, focus returns on close.
export default function Modal({ title, onClose, children, footer, labelledBy }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current?.querySelector('textarea, input, select, button:not([data-close])');
    (first || ref.current)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll('button, [href], input, textarea, select')].filter((el) => !el.disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy || 'modal-title'} ref={ref} tabIndex={-1}>
        {title !== undefined && (
          <div className="modal-head">
            <h2 id="modal-title">{title}</h2>
            <button className="icon-btn" type="button" data-close onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
        )}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
