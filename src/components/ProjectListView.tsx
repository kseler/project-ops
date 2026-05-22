import { Plus } from 'lucide-react';
import { useState } from 'react';

import { createTaskList } from '../lib/api';
import { useProjectDetail } from '../lib/store';
import { TaskListView } from './TaskListView';

interface Props {
  projectId: string;
}

export function ProjectListView({ projectId }: Props) {
  const { taskLists, addTaskList } = useProjectDetail();
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAddList = async () => {
    if (!newListName.trim() || busy) return;
    setBusy(true);
    try {
      const list = await createTaskList(projectId, newListName.trim());
      addTaskList(list);
      setNewListName('');
      setAddingList(false);
    } finally {
      setBusy(false);
    }
  };

  const cancelAdd = () => {
    setAddingList(false);
    setNewListName('');
  };

  return (
    <div className="space-y-4">
      {taskLists.map((tl) => (
        <TaskListView key={tl.id} taskList={tl} />
      ))}

      <div>
        {addingList ? (
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddList();
                if (e.key === 'Escape') cancelAdd();
              }}
              placeholder="List name…"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAddList}
                disabled={busy}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                Add list
              </button>
              <button
                onClick={cancelAdd}
                className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingList(true)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus size={14} /> Add task list
          </button>
        )}
      </div>
    </div>
  );
}
