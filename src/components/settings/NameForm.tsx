import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: string;
  onSave: (name: string) => Promise<boolean>;
  readOnly?: boolean;
}

export function NameForm({ label, value, onSave, readOnly = false }: Props) {
  const [name, setName] = useState(value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(value), [value]);

  const changed = name.trim() !== value;

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!changed) return;

    setSaving(true);
    const saved = await onSave(name.trim());
    setSaving(false);
    if (!saved) setName(value);
  };

  const handleOnNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);

    if (error) {
      setError('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <div className="flex-1 max-w-sm">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
        <input
          value={name}
          readOnly={readOnly}
          aria-label={label}
          onChange={handleOnNameChange}
          className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
            readOnly ? 'bg-slate-50 text-slate-500 border-slate-200' : error ? 'border-red-300' : 'border-slate-200'
          }`}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      {!readOnly && (
        <button
          type="submit"
          disabled={saving || !changed}
          className="mt-[22px] text-sm px-3.5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </form>
  );
}
