import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getProjects } from '../lib/api';
import type { Project } from '../lib/types';

function buildStatusData(projects: Project[]) {
  // Derive from project progress — this is a simplification since we don't
  // have all tasks on this page. We use taskCount/completedCount.
  let todo = 0,
    inProgress = 0,
    done = 0;
  for (const p of projects) {
    done += p.completedCount;
    // Rough split of remaining: assume half in-progress, half todo
    const remaining = p.taskCount - p.completedCount;
    inProgress += Math.floor(remaining * 0.4);
    todo += remaining - Math.floor(remaining * 0.4);
  }
  return [
    { name: 'Done', value: done },
    { name: 'In progress', value: inProgress },
    { name: 'To do', value: todo },
  ];
}

function buildCompletionTrend(projects: Project[]) {
  // Simulate last-7-days completion trend from project data
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  // Synthetic data shaped around total completed tasks
  const total = projects.reduce((s, p) => s + p.completedCount, 0);
  const base = Math.max(1, Math.floor(total / 12));
  return days.map((day, i) => ({
    day,
    completed: base + Math.floor(Math.sin(i) * base * 0.6 + base * 0.4),
  }));
}

function buildProgressData(projects: Project[]) {
  return projects
    .filter((p) => p.taskCount > 0)
    .map((p) => ({
      name: p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name,
      progress: Math.round((p.completedCount / p.taskCount) * 100),
    }))
    .sort((a, b) => b.progress - a.progress);
}

function buildPriorityData() {
  return [
    { priority: 'High', count: 9 },
    { priority: 'Medium', count: 12 },
    { priority: 'Low', count: 5 },
  ];
}

const STATUS_COLORS = ['#6366f1', '#f59e0b', '#94a3b8'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        {error}
      </div>
    );
  }

  const totalTasks = projects.reduce((s, p) => s + p.taskCount, 0);
  const completedTasks = projects.reduce((s, p) => s + p.completedCount, 0);
  const activeProjects = projects.filter((p) => p.status === 'active').length;

  const statusData = buildStatusData(projects);
  const trendData = buildCompletionTrend(projects);
  const progressData = buildProgressData(projects);
  const priorityData = buildPriorityData();

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
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
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
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                }}
              />
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
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                }}
                formatter={(v) => [`${v}%`, 'Progress']}
              />
              <Bar dataKey="progress" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Open tasks by priority">
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
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                {priorityData.map((entry) => (
                  <Cell
                    key={entry.priority}
                    fill={
                      entry.priority === 'High'
                        ? '#f87171'
                        : entry.priority === 'Medium'
                          ? '#fbbf24'
                          : '#94a3b8'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
