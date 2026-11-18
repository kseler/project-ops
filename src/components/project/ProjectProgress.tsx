interface Props {
  taskCount: number;
  completedCount: number;
}

export function ProjectProgress({ taskCount, completedCount }: Props) {
  const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">Progress</span>
        <span className="text-xs font-medium text-slate-600">{progress}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Project progress"
        className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
