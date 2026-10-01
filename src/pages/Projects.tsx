import { Plus } from 'lucide-react';
import { useState } from 'react';

import { addToast } from '@/lib/toast';
import { hasErrors, validateProject } from '@/lib/validation';
import { useCreateProject, useProjects } from '@/queries/projects';

import { ProjectCard } from '../components/ProjectCard';

interface CreateProjectForm {
  name: string
  description: string
  dueDate: string
}

export function Projects() {
  const [form, setForm] = useState<CreateProjectForm | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<CreateProjectForm>>({});

  const {
    data: projects = [],
    isLoading,
    error,
  } = useProjects();

  const createProjectMutation = useCreateProject();

  const handleCreate = async () => {
    if (!form) return;
    const errors = validateProject(form);
    if (hasErrors(errors)) { setFormErrors(errors); return; }

    await createProjectMutation.mutateAsync({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate,
    }, {
      onSuccess: () => addToast('Project created'),
      onSettled: () => { setForm(null); setFormErrors({}); },
    });
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
          onClick={() => { setForm({ name: '', description: '', dueDate: '' }); setFormErrors({}); }}
          className="flex items-center gap-1.5 text-sm px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> New project
        </button>
      </div>

      {/* New project form */}
      {form && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">New project</h3>
          <div className="space-y-3">
            <div>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f!, name: e.target.value })); setFormErrors((fe) => ({ ...fe, name: undefined })); }}
                placeholder="Project name"
                className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 ${formErrors.name ? 'border-red-300' : 'border-slate-200'}`}
              />
              {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
            </div>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f!, description: e.target.value }))}
              placeholder="Description (optional)"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => { setForm((f) => ({ ...f!, dueDate: e.target.value })); setFormErrors((fe) => ({ ...fe, dueDate: undefined })); }}
                className={`text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 ${formErrors.dueDate ? 'border-red-300' : 'border-slate-200'}`}
              />
              {formErrors.dueDate && <p className="text-xs text-red-500 mt-1">{formErrors.dueDate}</p>}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={createProjectMutation.isPending}
              className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => { setForm(null); setFormErrors({}); }}
              className="text-sm px-4 py-2 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error.message}</p>}

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
