import { useEffect, useRef } from 'react';
import { UiIcon, type UiIconName } from './AppIcons';
import { PROJECT_COLOR_CHOICES, PROJECT_ICON_CHOICES } from './projectAppearanceOptions';

interface ProjectAppearancePickerProps {
  open: boolean;
  icon: UiIconName;
  color: string;
  onClose: () => void;
  onSelectIcon: (icon: UiIconName) => void;
  onSelectColor: (color: string) => void;
}

export function ProjectAppearancePicker({
  open,
  icon,
  color,
  onClose,
  onSelectIcon,
  onSelectColor,
}: ProjectAppearancePickerProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointer(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="appearance-picker" role="dialog" aria-label="Ícone e cor do projeto" ref={ref}>
      <div className="appearance-picker-section">
        <span className="appearance-picker-label">Ícone</span>
        <div className="appearance-icon-grid">
          {PROJECT_ICON_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`appearance-icon-button ${choice === icon ? 'active' : ''}`}
              aria-label={`Ícone ${choice}`}
              aria-pressed={choice === icon}
              onClick={() => onSelectIcon(choice)}
            >
              <UiIcon name={choice} className="appearance-icon" />
            </button>
          ))}
        </div>
      </div>
      <div className="appearance-picker-section">
        <span className="appearance-picker-label">Cor</span>
        <div className="appearance-color-row">
          {PROJECT_COLOR_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`appearance-color-button ${choice === color ? 'active' : ''}`}
              style={{ background: choice }}
              aria-label={`Cor ${choice}`}
              aria-pressed={choice === color}
              onClick={() => onSelectColor(choice)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
