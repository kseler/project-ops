import { Router, Request, Response } from 'express';
import { trace } from '@opentelemetry/api';
import { getProjectById, getTaskListById, addTaskList, addTask } from '../store';

const router = Router();
const tracer = trace.getTracer('project-ops-api');

// POST /api/projects/:projectId/tasklists
router.post('/projects/:projectId/tasklists', (req: Request, res: Response) => {
  try {
    const project = getProjectById(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const taskList = addTaskList({ projectId: req.params.projectId, name });
    res.status(201).json({ ...taskList, tasks: [] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/tasklists/:taskListId/tasks
router.post('/tasklists/:taskListId/tasks', (req: Request, res: Response) => {
  try {
    const taskList = getTaskListById(req.params.taskListId);
    if (!taskList) {
      res.status(404).json({ error: 'Task list not found' });
      return;
    }
    const { name, description, priority, assignee, startDate, dueDate } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const task = addTask({
      taskListId: req.params.taskListId,
      name,
      description,
      status: 'todo',
      priority: priority ?? 'medium',
      assignee,
      startDate: startDate ?? undefined,
      dueDate: dueDate ?? undefined,
    });
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
