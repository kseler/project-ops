import { Router, Request, Response } from 'express';
// import { trace } from '@opentelemetry/api';
import { getProjectById, getTaskListById, addTaskList, addTask } from '../store';

const router = Router();
// const tracer = trace.getTracer('projectops-api');

// POST /api/projects/:projectId/tasklists
router.post('/projects/:projectId/tasklists', (req: Request, res: Response) => {
  // const span = tracer.startSpan('tasklists.create');
  // span.setAttribute('project.id', req.params.projectId);
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
    // span.setAttribute('tasklist.id', taskList.id);
    res.status(201).json({ ...taskList, tasks: [] });
  } finally {
    // span.end();
  }
});

// POST /api/tasklists/:taskListId/tasks
router.post('/tasklists/:taskListId/tasks', (req: Request, res: Response) => {
  // const span = tracer.startSpan('tasks.create');
  // span.setAttribute('tasklist.id', req.params.taskListId);
  try {
    const taskList = getTaskListById(req.params.taskListId);
    if (!taskList) {
      res.status(404).json({ error: 'Task list not found' });
      return;
    }
    const { name, description, priority, assignee } = req.body;
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
    });
    // span.setAttribute('task.id', task.id);
    res.status(201).json(task);
  } finally {
    // span.end();
  }
});

export default router;
