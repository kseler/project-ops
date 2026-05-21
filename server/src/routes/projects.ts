import { Router, Request, Response } from 'express';
import { trace } from '@opentelemetry/api';
import {
  getProjects,
  getProjectById,
  getTaskListsByProject,
  getTasksByTaskList,
  addProject,
} from '../store';

const router = Router();
const tracer = trace.getTracer('project-ops-api');

// GET /api/projects
router.get('/', (_req: Request, res: Response) => {
  const span = tracer.startSpan('projects.list');
  try {
    const projects = getProjects();
    // Enrich each project with task counts
    const enriched = projects.map((project) => {
      const taskLists = getTaskListsByProject(project.id);
      const allTasks = taskLists.flatMap((tl) => getTasksByTaskList(tl.id));
      return {
        ...project,
        taskCount: allTasks.length,
        completedCount: allTasks.filter((t) => t.status === 'done').length,
      };
    });
    span.setAttribute('projects.count', enriched.length);
    res.json(enriched);
  } finally {
    span.end();
  }
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  const span = tracer.startSpan('projects.get');
  span.setAttribute('project.id', req.params.id);
  try {
    const project = getProjectById(req.params.id);
    if (!project) {
      span.setAttribute('error', true);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const taskLists = getTaskListsByProject(project.id);
    const allTasks = taskLists.flatMap((tl) => getTasksByTaskList(tl.id));
    res.json({
      ...project,
      taskCount: allTasks.length,
      completedCount: allTasks.filter((t) => t.status === 'done').length,
    });
  } finally {
    span.end();
  }
});

// POST /api/projects
router.post('/', (req: Request, res: Response) => {
  const span = tracer.startSpan('projects.create');
  try {
    const { name, description, status, dueDate } = req.body;
    if (!name || !dueDate) {
      res.status(400).json({ error: 'name and dueDate are required' });
      return;
    }
    const project = addProject({
      name,
      description: description ?? '',
      status: status ?? 'active',
      dueDate,
    });
    span.setAttribute('project.id', project.id);
    res.status(201).json(project);
  } finally {
    span.end();
  }
});

// GET /api/projects/:id/tasklists
router.get('/:id/tasklists', (req: Request, res: Response) => {
  const span = tracer.startSpan('projects.tasklists');
  span.setAttribute('project.id', req.params.id);
  try {
    const project = getProjectById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const taskLists = getTaskListsByProject(req.params.id);
    const enriched = taskLists.map((tl) => ({
      ...tl,
      tasks: getTasksByTaskList(tl.id),
    }));
    span.setAttribute('tasklists.count', enriched.length);
    res.json(enriched);
  } finally {
    span.end();
  }
});

export default router;
