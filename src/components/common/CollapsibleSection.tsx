import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children
}: CollapsibleSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-section${open ? ' open' : ''}`}>
      <button
        type="button"
        className="collapsible-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <div className="collapsible-title">
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
        <div className="collapsible-meta">
          {badge ? <span className="collapsible-badge">{badge}</span> : null}
          <span className="collapsible-chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
        </div>
      </button>
      {open ? <div className="collapsible-content">{children}</div> : null}
    </section>
  );
}
