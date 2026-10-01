# ProjectOps

A full-stack project and task management application built around complex, data-heavy workflows.

ProjectOps started as a frontend-focused project and is being developed toward a production-style SaaS architecture. It currently combines persistent PostgreSQL storage, a typed Express API, runtime validation, TanStack Query server-state management, editable task workflows, and a custom interactive Gantt view.

The project is also a place for me to explore architectural decisions deliberately rather than adding abstractions or libraries before the product needs them.

---

## Features

### Projects

Create and manage projects with:

- status tracking
- descriptions
- due dates
- task lists
- project-level task views

### Task Lists

Organize project work into independent task lists.

The List view fetches tasks per task list, which keeps the data model ready for independent pagination as project sizes grow.

### Tasks

Tasks support:

- title
- description
- status
- priority
- assignee
- start date
- due date
- creation/update timestamps

Tasks can be created, edited and deleted through the UI.

### Task Details Drawer

Tasks can be opened in a dedicated side drawer for editing without leaving the project view.

The drawer supports:

- auto-saving field changes
- status and priority editing
- date validation
- assignee editing
- delete confirmation
- loading and saving states
- synchronized TanStack Query caches

The selected task is URL-addressable, allowing task details to behave as part of the navigation model rather than hidden global UI state.

### List View

A structured project view for working with tasks grouped by task list and status.

Task data is fetched independently per task list:

```text
GET /api/tasks?taskListId=...
```

This design is intentionally different from the Gantt data strategy and leaves room for per-list pagination later.

### Custom Gantt View

ProjectOps includes a custom-built Gantt timeline rather than relying on a third-party Gantt component.

It supports:

- task timeline visualization
- start/end date positioning
- draggable task bars
- left/right date resizing
- dynamically expanding timeline ranges
- current-day highlighting
- synchronized task updates
- shared project/task-list data

The Gantt loads all tasks belonging to a project:

```text
GET /api/tasks?projectId=...
```

The backend resolves that relationship through the task-list hierarchy rather than duplicating `projectId` on every task.

---

## Engineering Highlights

### PostgreSQL Persistence

Application data is stored in PostgreSQL rather than in-memory frontend/backend state.

Core relationships:

```text
Project
  │
  └── Task Lists
        │
        └── Tasks
```

The schema uses:

- UUID primary keys
- PostgreSQL enums
- foreign keys
- `ON DELETE CASCADE`
- indexes on relationship columns
- timezone-aware event timestamps
- `DATE` fields for calendar dates
- database-level date constraints

For example, PostgreSQL prevents a task's due date from being earlier than its start date.

---

### Drizzle ORM

The backend uses Drizzle for typed database access while keeping queries close to SQL.

Current data flow:

```text
Express
   ↓
Drizzle
   ↓
pg
   ↓
PostgreSQL
```

Database schema changes are managed through generated Drizzle migrations.

A repository layer has intentionally not been introduced yet because the current queries remain small and readable directly at the route boundary.

---

### Runtime Validation with Zod

TypeScript protects the codebase at compile time, but HTTP input still needs runtime validation.

All important API inputs are validated with Zod before database operations are performed.

```text
HTTP request
    ↓
Zod validation
    ↓
route logic
    ↓
Drizzle
    ↓
PostgreSQL constraints
```

Validation covers:

- route parameters
- query parameters
- project creation
- task-list creation
- task creation
- task updates
- ISO calendar dates
- task date relationships

PostgreSQL constraints remain the final data-integrity boundary.

---

### TanStack Query

Server state is managed with TanStack Query.

The frontend no longer maintains a duplicate global copy of project/task data.

```text
API
 ↓
TanStack Query
 ↓
React
```

Task queries deliberately use two cache shapes:

```ts
['tasks', 'project', projectId]
```

for Gantt data, and:

```ts
['tasks', 'taskList', taskListId]
```

for task-list data.

This reflects two genuinely different access patterns rather than forcing every view through the same endpoint.

Mutations update the relevant query caches directly when the server response provides enough information to do so safely.

---

### No Global State Library

ProjectOps previously used Zustand for application/server state.

After migrating remote data to TanStack Query, the remaining state did not justify a global client store, so Zustand was removed completely.

The current frontend state model is:

```text
React Router
→ navigation / URL state

TanStack Query
→ server state

React state
→ local UI state
```

A global state library will only be reintroduced if a real shared-client-state requirement appears.

---

### API Design

The API uses resource-oriented endpoints with query parameters where relationships act as filters.

Examples:

```text
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects

GET    /api/tasklists?projectId=...
POST   /api/tasklists

GET    /api/tasks/:id
GET    /api/tasks?taskListId=...
GET    /api/tasks?projectId=...
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
```

Project-wide task queries use a SQL join through `task_lists`:

```text
tasks
INNER JOIN task_lists
  ON tasks.task_list_id = task_lists.id
WHERE task_lists.project_id = ?
```

This keeps the relational model normalized while supporting the Gantt's project-wide data requirements.

---

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | React 19 |
| Language | TypeScript |
| Build tooling | Vite |
| Routing | React Router |
| Server state | TanStack Query |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL |
| ORM / Query Builder | Drizzle ORM |
| Runtime Validation | Zod |
| PostgreSQL Driver | pg |
| Observability | OpenTelemetry |
| Package Manager | pnpm |

---

## Architecture

```text
React
  │
  ├── React Router
  ├── TanStack Query
  └── Local React state
  │
  ▼
HTTP API
  │
  ▼
Express + TypeScript
  │
  ├── Zod validation
  ├── Route logic
  └── Drizzle
  │
  ▼
PostgreSQL
```

The project is deliberately being built incrementally.

New infrastructure is added when an actual product or architectural requirement appears rather than preemptively.

---

## Project Structure

```text
project-ops/
│
├── src/
│   ├── components/       # Gantt, task drawer, task/list UI
│   ├── pages/            # Dashboard, projects, project detail
│   ├── queries/          # TanStack Query hooks and cache helpers
│   │   ├── projects.ts
│   │   ├── taskLists.ts
│   │   └── tasks.ts
│   ├── lib/
│   │   ├── api.ts        # HTTP API client
│   │   ├── ganttUtils.ts # Timeline calculations
│   │   ├── types.ts
│   │   └── validation.ts
│   └── App.tsx
│
└── server/
    ├── drizzle/          # Generated database migrations
    └── src/
        ├── db/
        │   ├── index.ts
        │   ├── schema.ts
        │   └── seed.ts
        ├── routes/
        │   ├── projects.ts
        │   ├── task-lists.ts
        │   └── tasks.ts
        └── index.ts
```

---

## Getting Started

### Prerequisites

- Node.js
- pnpm
- PostgreSQL

### 1. Clone the repository

```bash
git clone https://github.com/kseler/project-ops.git
cd project-ops
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure PostgreSQL

Create a local PostgreSQL database for ProjectOps.

Copy the example environment file:

```bash
cp server/.env.example server/.env
```

Configure:

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/project_ops
```

### 4. Run database migrations

```bash
pnpm --dir server db:migrate
```

### 5. Seed development data

```bash
pnpm --dir server db:seed
```

### 6. Start the application

```bash
pnpm dev
```

Development services:

| Service | URL |
|---|---|
| React | http://localhost:5173 |
| Express API | http://localhost:3001 |

---

## Database Commands

From the `server` package:

```bash
pnpm db:generate
```

Generate a migration after changing the Drizzle schema.

```bash
pnpm db:migrate
```

Apply pending migrations.

```bash
pnpm db:seed
```

Reset/populate development seed data.

---

## Current Development Focus

The next major milestone is authentication and multi-tenancy.

The planned data model introduces organizations and memberships:

```text
User
  │
  └── Membership
        │
        └── Organization
               │
               └── Projects
                      │
                      └── Task Lists
                             │
                             └── Tasks
```

Planned authentication work includes:

- email/password authentication
- persistent sessions
- protected frontend and API routes
- organizations/workspaces
- organization memberships and roles
- tenant-isolated project access
- Google OAuth
- organization invitations

Authentication will be implemented with **Better Auth** on top of the existing Drizzle/PostgreSQL stack.

---

## Roadmap

Completed:

- [x] Initial frontend application
- [x] Express API
- [x] PostgreSQL persistence
- [x] Drizzle schema and migrations
- [x] Runtime API validation with Zod
- [x] TanStack Query migration
- [x] Remove duplicated Zustand server state
- [x] Task details/editing drawer
- [x] Custom interactive Gantt workflow

Next:

- [ ] Authentication
- [ ] Organizations and memberships
- [ ] Multi-tenant authorization
- [ ] Google OAuth
- [ ] Realtime task synchronization with Socket.IO
- [ ] Database-backed dashboard analytics
- [ ] Automated testing
- [ ] CI
- [ ] Production deployment

---

## Why I Built This

I wanted a project that goes beyond implementing isolated UI components and gives me room to work through the kinds of problems that appear in real product development:

- complex interactive interfaces
- relational data modelling
- frontend/server state boundaries
- API design
- runtime validation
- caching and synchronization
- persistence and migrations
- multi-tenancy
- authorization
- realtime collaboration

The goal is not to add as many technologies as possible.

The goal is to understand why each part of the architecture exists, introduce it when the product needs it, and keep the system understandable as the application grows.