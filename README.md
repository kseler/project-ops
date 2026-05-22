# ProjectOps

A full-stack project and task management app for tracking work across teams. Organize projects into task lists, monitor progress in real time, and visualize timelines with a built-in Gantt view.

---

## Features

- **Dashboard** — At-a-glance stats and charts: task status breakdown, completion trends, per-project progress, and open tasks by priority
- **Projects** — Create and manage projects with status tracking (Active, On Hold, Completed)
- **Task Lists** — Group tasks within a project into named lists
- **Tasks** — Track individual work items with priority levels, status, and assignees
- **List View** — Kanban-style columns organized by task status
- **Gantt View** — Timeline visualization of tasks across a project

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router 7 |
| State | Zustand |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Express 5, Node.js, TypeScript |
| Observability | OpenTelemetry (OTLP) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+

### Installation

```bash
git clone <repo-url>
cd project-ops

# Install root + client dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### Running in Development

```bash
npm run dev
```

This starts both the Vite dev server and the Express API concurrently:

| Service | URL |
|---|---|
| Client | http://localhost:5173 |
| API | http://localhost:3001 |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start client + server together |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express server only (with watch) |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format code with Prettier |

---

## API Overview

```
GET    /health
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/tasklists
POST   /api/projects/:id/tasklists
POST   /api/tasklists/:id/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
```

---

## Project Structure

```
project-ops/
├── src/                    # React frontend
│   ├── pages/              # Dashboard, Projects, ProjectDetail
│   ├── components/         # Layout, cards, view components
│   ├── lib/
│   │   ├── api.ts          # API client
│   │   ├── store.ts        # Zustand store
│   │   └── types.ts        # Shared TypeScript types
│   └── App.tsx             # Route definitions
└── server/
    └── src/
        ├── routes/         # projects, task-lists, tasks
        ├── store.ts        # In-memory data store
        ├── telemetry.ts    # OpenTelemetry setup
        └── index.ts        # Express entry point
```

---

## Notes

- The backend uses **in-memory storage** — data resets on server restart. The store is seeded with sample projects on startup, making it easy to explore the app without any setup.
- The server port defaults to `3001` and is configurable via the `PORT` environment variable.
- OpenTelemetry tracing is enabled by default; configure the OTLP endpoint via environment variables to export traces to your collector.
