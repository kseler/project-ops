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
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const project = getProjectById(req.params.id);
    if (!project) {
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
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/projects
router.post('/', (req: Request, res: Response) => {
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
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/projects/:id/tasklists
router.get('/:id/tasklists', (req: Request, res: Response) => {
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
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
