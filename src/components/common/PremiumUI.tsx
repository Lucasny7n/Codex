import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Tone = 'ready' | 'warning' | 'error' | 'offline' | 'info';

interface PremiumModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function PremiumModal({ open, title, description, onClose, children, className }: PremiumModalProps): JSX.Element | null {
  const panelRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // Keep onClose current without putting it in the effect deps — doing so would
  // re-run the focus-to-first logic on every parent re-render (e.g. each
  // keystroke in a controlled input inside the modal), which steals focus.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const panel = panelRef.current;
    const explicit = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? undefined;
    const first = explicit ?? (panel ? focusableElements(panel)[0] : undefined);
    first?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function isTopModal(): boolean {
      const overlays = Array.from(document.querySelectorAll('.premium-modal-overlay'));
      return overlays[overlays.length - 1] === overlayRef.current;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (!isTopModal()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = focusableElements(panelRef.current);
      if (focusables.length === 0) return;
      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [open]);

  if (!open) return null;

  const overlay = (
    <div className="premium-modal-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }} ref={overlayRef}>
      <section
        ref={panelRef}
        className={`premium-modal-panel ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="premium-modal-header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="premium-modal-body">{children}</div>
      </section>
    </div>
  );

  return createPortal(overlay, document.body);
}

interface PopupMenuProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: 'left' | 'right';
  placement?: 'auto' | 'top' | 'bottom';
  className?: string;
}

export function PopupMenu({ open, onClose, children, align = 'right', placement = 'auto', className }: PopupMenuProps): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition(): void {
      const anchor = anchorRef.current?.parentElement ?? anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const width = menuRef.current?.offsetWidth ?? 176;
      const height = menuRef.current?.offsetHeight ?? 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const opensUp =
        placement === 'top' ||
        (placement === 'auto' && spaceBelow < height + 16 && spaceAbove > spaceBelow);
      const preferredTop = opensUp ? rect.top - height - 6 : rect.bottom + 6;
      const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
      const preferredLeft = align === 'right' ? rect.right - width : rect.left;
      const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8));
      setPosition({ top, left });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, open, placement]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node;
      const anchor = anchorRef.current?.parentElement;
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!menuRef.current || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End')) return;
      const items = focusableElements(menuRef.current).filter((item) => item.getAttribute('aria-disabled') !== 'true');
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.findIndex((item) => item === document.activeElement);
      if (event.key === 'Home') {
        items[0].focus();
        return;
      }
      if (event.key === 'End') {
        items[items.length - 1].focus();
        return;
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex === -1 ? (direction > 0 ? 0 : items.length - 1) : (currentIndex + direction + items.length) % items.length;
      items[nextIndex].focus();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  const marker = <span ref={anchorRef} className="popup-menu-anchor-marker" aria-hidden="true" />;
  if (!open) return marker;

  return (
    <>
      {marker}
      {createPortal(
        <div
          ref={menuRef}
          className={`popup-menu menu-surface popup-menu-${align} ${className ?? ''}`}
          role="menu"
          style={{ top: position.top, left: position.left }}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

interface CredentialInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}

export function CredentialInput({ value, placeholder, onChange, onBlur, invalid }: CredentialInputProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`credential-input ${invalid ? 'invalid' : ''}`}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {value.trim() ? (
        <button type="button" className="icon-button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Ocultar chave' : 'Mostrar chave'}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      ) : null}
    </div>
  );
}

export function StatusDot({ tone }: { tone: Tone }): JSX.Element {
  return <span className={`status-dot-v13 status-dot-v13-${tone}`} aria-hidden="true" />;
}

export function ActionPill({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button type="button" className="action-pill" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps): JSX.Element | null {
  return (
    <PremiumModal open={open} title={title} onClose={onCancel} className="compact-modal">
      <p className="dialog-copy">{message}</p>
      <div className="dialog-actions">
        <button type="button" className="btn-modern" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={`btn-modern ${danger ? 'btn-danger' : 'btn-modern-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </PremiumModal>
  );
}

interface ExportDialogProps {
  open: boolean;
  title: string;
  onExport: (format: 'markdown' | 'json' | 'txt') => void;
  onCancel: () => void;
}

export function ExportDialog({ open, title, onExport, onCancel }: ExportDialogProps): JSX.Element | null {
  return (
    <PremiumModal open={open} title="Exportar sessão" description={title} onClose={onCancel} className="compact-modal">
      <div className="export-format-grid">
        <button type="button" className="btn-modern btn-modern-primary" onClick={() => onExport('markdown')}>
          .md
        </button>
        <button type="button" className="btn-modern" onClick={() => onExport('json')}>
          .json
        </button>
        <button type="button" className="btn-modern" onClick={() => onExport('txt')}>
          .txt
        </button>
      </div>
    </PremiumModal>
  );
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }): JSX.Element {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) => window.setTimeout(() => onDismiss(toast.id), 3000));
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [onDismiss, toasts]);

  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span>{toast.message}</span>
          <button type="button" className="icon-button" onClick={() => onDismiss(toast.id)} aria-label="Dispensar">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
