import { useId, useRef, useState } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';
import type { Task } from '@/types';

export interface TaskOption {
  task: Task;
  listName: string;
}

interface Props {
  options: TaskOption[];
  placeholder: string;
  onSelect: (task: Task) => void;
  disabled?: boolean;
}

export function TaskPicker({ options, placeholder, onSelect, disabled = false }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useClickOutside(containerRef, () => setOpen(false), open);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? options.filter(({ task }) => task.name.toLowerCase().includes(needle))
    : options;

  const select = (task: Task) => {
    onSelect(task);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (open && option) select(option.task);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[activeIndex] ? optionId(activeIndex) : undefined}
        aria-label={placeholder}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); setOpen(true); }}
        onKeyDown={handleKeyDown}
        className="w-full text-sm text-slate-700 bg-transparent placeholder:text-slate-400 focus:outline-none py-0.5 disabled:opacity-50"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-20 max-h-56 overflow-y-auto py-1 bg-white border border-slate-200 rounded-md shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-xs text-slate-400">
              {options.length === 0 ? 'No other tasks to link.' : 'No matching tasks.'}
            </li>
          ) : (
            filtered.map(({ task, listName }, index) => (
              <li
                key={task.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // keep focus in the input so the list doesn't close before the click lands
                onMouseDown={(e) => { e.preventDefault(); select(task); }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer ${
                  index === activeIndex ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-slate-700">{task.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{listName}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
