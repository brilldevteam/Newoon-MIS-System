import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type MenuStyle = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function getMenuStyle(trigger: HTMLElement | null): MenuStyle {
  const rect = trigger?.getBoundingClientRect();
  if (!rect) return { top: 0, left: 0, width: 0, maxHeight: 256 };

  const viewportPadding = 12;
  const searchAndPaddingHeight = 58;
  const preferredMenuHeight = 320;
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const spaceAbove = rect.top - viewportPadding;
  const shouldOpenUp = spaceBelow < 180 && spaceAbove > spaceBelow;
  const availableHeight = Math.max(140, (shouldOpenUp ? spaceAbove : spaceBelow) - searchAndPaddingHeight);

  return {
    top: shouldOpenUp ? Math.max(viewportPadding, rect.top - Math.min(preferredMenuHeight, spaceAbove)) : rect.bottom + 8,
    left: rect.left,
    width: rect.width,
    maxHeight: Math.min(256, availableHeight)
  };
}

function optionsWithOther(options: string[], allowOther?: boolean) {
  const baseOptions = options.filter((option, index, all) => all.indexOf(option) === index);
  if (!allowOther) return baseOptions;
  return [...baseOptions.filter((option) => option !== 'Other'), 'Other'];
}

export function listValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  return value ? [String(value)] : [];
}

export function resolveOtherValue(value: unknown, otherValue?: string) {
  if (value === 'Other') return otherValue?.trim() || 'Other';
  return value ? String(value) : '';
}

export function displayList(value: unknown, otherValue?: string) {
  return listValue(value)
    .map((item) => (item === 'Other' ? otherValue?.trim() || 'Other' : item))
    .join(', ');
}

type SearchableSelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  optionLabels?: Record<string, string>;
};

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  wide = false,
  allowOther = false,
  otherValue = '',
  onOtherChange,
  optionLabels = {}
}: SearchableSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<MenuStyle>({ top: 0, left: 0, width: 0, maxHeight: 256 });
  const normalizedOptions = useMemo(() => optionsWithOther(options, allowOther), [options, allowOther]);
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? normalizedOptions.filter((option) => `${option} ${optionLabels[option] || ''}`.toLowerCase().includes(search)) : normalizedOptions;
  }, [normalizedOptions, optionLabels, query]);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      setMenuStyle(getMenuStyle(triggerRef.current));
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (triggerRef.current?.contains(target) || target.closest('[data-searchable-select-menu="true"]')) return;
      setOpen(false);
      setQuery('');
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [open]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={`${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`}>
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
        className="mt-1 flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
      >
        <span className={value ? '' : 'text-slate-400'}>{value === 'Other' ? resolveOtherValue(value, otherValue) : optionLabels[value] || resolveOtherValue(value, otherValue) || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>
      {open
        ? createPortal(
            <div
              data-searchable-select-menu="true"
              className="fixed z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal text-slate-900 outline-none"
                />
              </div>
              <div className="overflow-y-auto p-2" style={{ maxHeight: menuStyle.maxHeight }}>
                {filteredOptions.length ? (
                  filteredOptions.map((option) => {
                    const selected = (value || '') === option;
                    return (
                      <button
                        key={option || 'empty'}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                          selected ? 'bg-brand-50 text-brand-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{option ? optionLabels[option] || option : placeholder}</span>
                        {selected ? <Check className="h-4 w-4 text-brand-700" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm font-normal text-slate-500">No options found</p>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
      {allowOther && value === 'Other' ? (
        <label className="mt-2 block text-sm font-medium text-slate-700">
          Specify other {label.toLowerCase()}
          <input
            value={otherValue}
            onChange={(event) => onOtherChange?.(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ) : null}
    </div>
  );
}

type SearchableMultiSelectProps = {
  label: string;
  value: unknown;
  options: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  wide?: boolean;
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
};

export function SearchableMultiSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  wide = false,
  allowOther = false,
  otherValue = '',
  onOtherChange
}: SearchableMultiSelectProps) {
  const selectedValues = listValue(value);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<MenuStyle>({ top: 0, left: 0, width: 0, maxHeight: 256 });
  const selectableOptions = useMemo(() => optionsWithOther(options, allowOther).filter(Boolean), [options, allowOther]);
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    return search ? selectableOptions.filter((option) => option.toLowerCase().includes(search)) : selectableOptions;
  }, [selectableOptions, query]);

  useEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      setMenuStyle(getMenuStyle(triggerRef.current));
    }

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (triggerRef.current?.contains(target) || target.closest('[data-searchable-select-menu="true"]')) return;
      setOpen(false);
      setQuery('');
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [open]);

  function toggle(option: string) {
    const nextValues = selectedValues.includes(option)
      ? selectedValues.filter((item) => item !== option)
      : [...selectedValues, option];
    onChange(nextValues);
    if (option !== 'Other') return;
    if (selectedValues.includes('Other')) onOtherChange?.('');
  }

  function remove(option: string) {
    onChange(selectedValues.filter((item) => item !== option));
    if (option === 'Other') onOtherChange?.('');
  }

  return (
    <div className={`${wide ? 'md:col-span-2' : ''} text-sm font-medium text-slate-700`}>
      <span>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
        className="mt-1 flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900"
      >
        <span className={selectedValues.length ? 'flex min-w-0 flex-1 flex-wrap gap-2' : 'text-slate-400'}>
          {selectedValues.length
            ? selectedValues.map((item) => (
                <span key={item} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">
                  <span className="truncate">{item === 'Other' ? resolveOtherValue(item, otherValue) : item}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      remove(item);
                    }}
                    className="inline-flex rounded-full p-0.5 hover:bg-brand-100"
                    aria-label={`Remove ${item}`}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              ))
            : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {open
        ? createPortal(
            <div
              data-searchable-select-menu="true"
              className="fixed z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-normal text-slate-900 outline-none"
                />
              </div>
              <div className="overflow-y-auto p-2" style={{ maxHeight: menuStyle.maxHeight }}>
                {filteredOptions.length ? (
                  filteredOptions.map((option) => {
                    const selected = selectedValues.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggle(option)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${
                          selected ? 'bg-brand-50 text-brand-900' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{option}</span>
                        {selected ? <Check className="h-4 w-4 text-brand-700" /> : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2 text-sm font-normal text-slate-500">No options found</p>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
      {allowOther && selectedValues.includes('Other') ? (
        <label className="mt-2 block text-sm font-medium text-slate-700">
          Specify other {label.toLowerCase()}
          <input
            value={otherValue}
            onChange={(event) => onOtherChange?.(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      ) : null}
    </div>
  );
}
