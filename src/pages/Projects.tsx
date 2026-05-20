import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ProjectCard } from '../components/ProjectCard';
import { createProject, getProjects } from '../lib/api';
import type { Project } from '../lib/types';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', dueDate: '' });

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.dueDate || busy) return;
    setBusy(true);
    try {
      const project = await createProject({
        name: form.name.trim(),
        description: form.description.trim(),
        dueDate: new Date(form.dueDate).toISOString(),
      });
      setProjects((prev) => [project, ...prev]);
      setForm({ name: '', description: '', dueDate: '' });
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  };

  const active = projects.filter((p) => p.status === 'active');
  const rest = projects.filter((p) => p.status !== 'active');

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> New project
        </button>
      </div>

      {/* New project form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">New project</h3>
          <div className="space-y-3">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Project name"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setForm({ name: '', description: '', dueDate: '' });
              }}
              className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Active
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Other
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {rest.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
