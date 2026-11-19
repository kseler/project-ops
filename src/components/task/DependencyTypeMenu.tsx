import { CircleMinus, CirclePause, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';

export type DependencyDirection = 'blocking' | 'waiting';

export const DEPENDENCY_DIRECTIONS: Record<
  DependencyDirection,
  { label: string; icon: LucideIcon; color: string }
> = {
  blocking: { label: 'Blocking', icon: CircleMinus, color: 'text-red-400' },
  waiting: { label: 'Waiting on', icon: CirclePause, color: 'text-amber-400' },
};

interface Props {
  value: DependencyDirection;
  onChange: (direction: DependencyDirection) => void;
  disabled?: boolean;
}

export function DependencyTypeMenu({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setOpen(false), open);

  const { label, icon: Icon, color } = DEPENDENCY_DIRECTIONS[value];

  const select = (direction: DependencyDirection) => {
    setOpen(false);
    if (direction !== value) onChange(direction);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Dependency type: ${label}`}
        title={label}
        className={`flex items-center justify-center w-6 h-6 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 ${color}`}
      >
        <Icon size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-20 w-44 py-1 bg-white border border-slate-200 rounded-md shadow-lg"
        >
          {(Object.keys(DEPENDENCY_DIRECTIONS) as DependencyDirection[]).map((direction) => {
            const option = DEPENDENCY_DIRECTIONS[direction];
            const OptionIcon = option.icon;
            return (
              <button
                key={direction}
                type="button"
                role="menuitemradio"
                aria-checked={direction === value}
                onClick={() => select(direction)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-slate-700 text-left transition-colors ${
                  direction === value ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <OptionIcon size={16} className={option.color} />
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
