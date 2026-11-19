import { format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useDashboard } from '@/queries/dashboard';
import { useProjects } from '@/queries/projects';
import type { DashboardAnalytics, Project, TaskPriority, TaskStatus } from '@/types';

const STATUS_CHART: Record<TaskStatus, { label: string; fill: string }> = {
  done: { label: 'Done', fill: '#6366f1' },
  'in-progress': { label: 'In progress', fill: '#f59e0b' },
  todo: { label: 'To do', fill: '#94a3b8' },
};

const PRIORITY_CHART: Record<TaskPriority, { label: string; fill: string }> = {
  high: { label: 'High', fill: '#f87171' },
  medium: { label: 'Medium', fill: '#f59e0b' },
  low: { label: 'Low', fill: '#94a3b8' },
};

const tooltipStyle = { fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6 };

// ── Real API data → Recharts data ────────────────────────────────────────────

const toStatusSlices = (tasksByStatus: DashboardAnalytics['tasksByStatus']) =>
  tasksByStatus
    .filter(({ count }) => count > 0)
    .map(({ status, count }) => ({ name: STATUS_CHART[status].label, value: count, fill: STATUS_CHART[status].fill }));

const toPriorityBars = (openTasksByPriority: DashboardAnalytics['openTasksByPriority']) =>
  openTasksByPriority.map(({ priority, count }) => ({
    priority: PRIORITY_CHART[priority].label,
    count,
    fill: PRIORITY_CHART[priority].fill,
  }));

const toCompletionPoints = (completedLast7Days: DashboardAnalytics['completedLast7Days']) =>
  completedLast7Days.map(({ date, count }) => ({ day: format(parseISO(date), 'd MMM'), completed: count }));

const toProjectProgress = (projects: Project[]) =>
  projects
    .filter((p) => p.taskCount > 0)
    .map((p) => ({
      name: p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name,
      progress: Math.round((p.completedCount / p.taskCount) * 100),
    }))
    .sort((a, b) => b.progress - a.progress);

// ── Layout pieces ───────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">{message}</div>;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function Dashboard() {
  const projectsQuery = useProjects();
  const dashboardQuery = useDashboard();

  if (projectsQuery.isLoading || dashboardQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  const error = projectsQuery.error ?? dashboardQuery.error;
  if (error || !projectsQuery.data || !dashboardQuery.data) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        {error?.message ?? 'Failed to load the dashboard.'}
      </div>
    );
  }

  const projects = projectsQuery.data;
  const analytics = dashboardQuery.data;

  // from /api/projects
  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0);
  const completedTasks = projects.reduce((s, p) => s + p.completedCount, 0);
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const progressData = toProjectProgress(projects);

  // from /api/dashboard
  const statusData = toStatusSlices(analytics.tasksByStatus);
  const priorityData = toPriorityBars(analytics.openTasksByPriority);
  const hasOpenTasks = analytics.openTasksByPriority.some(({ count }) => count > 0);
  const trendData = toCompletionPoints(analytics.completedLast7Days);

  return (
    <div className="px-8 py-8">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview across all projects</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total projects" value={projects.length} />
        <StatCard label="Active projects" value={activeProjects} />
        <StatCard label="Total tasks" value={totalTasks} />
        <StatCard
          label="Completion rate"
          value={
            totalTasks > 0 ? `${Math.round((completedTasks / totalTasks) * 100)}%` : '—'
          }
          sub={`${completedTasks} of ${totalTasks} done`}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <ChartCard title="Tasks by status">
          {statusData.length === 0 ? (
            <EmptyChart message="No tasks yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart data={statusData}>
                <Pie
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Tasks completed — last 7 days">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={trendData}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              {/* keep a visible scale when every day is 0 */}
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(dataMax, 4)]}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#completedGrad)"
                dot={{ r: 3, fill: '#6366f1' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Progress by project">
          {progressData.length === 0 ? (
            <EmptyChart message="No projects with tasks yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={progressData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Progress']} />
                <Bar dataKey="progress" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Open tasks by priority">
          {!hasOpenTasks ? (
            <EmptyChart message="No open tasks" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={priorityData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="priority"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
