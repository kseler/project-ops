# ProjectOps

A full-stack project and task management application built around complex, data-heavy workflows.

ProjectOps started as a frontend-focused project and is being developed toward a production-style SaaS architecture. It currently combines persistent PostgreSQL storage, a typed Express API, runtime validation, authentication with multi-tenant organizations and roles, realtime collaboration, TanStack Query server-state management, task dependencies, and a custom interactive Gantt view.

The project is also a place for me to explore architectural decisions deliberately rather than adding abstractions or libraries before the product needs them.

<img src="./demo/images/gantt.png" width="600" />

---

## Screenshots

### Project dashboard

<img src="./demo/images/dashboard.png" width="600" />

### Project planning

<img src="./demo/images/list.png" width="600" />

### Task details

<img src="./demo/images/task-drawer.png" width="600" />

## Features

### Projects

Create and manage projects with:

- status tracking
- descriptions
- due dates, highlighted when overdue
- task count and completion progress
- task lists
- project-level task views

Project name, description and due date can be edited inline from the project page.

### Task Lists

Organize project work into independent task lists.

Task lists can be renamed inline and deleted. Deleting a list asks for confirmation and removes its tasks with it.

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
- dependencies on other tasks
- creation/update timestamps

Tasks can be created, edited and deleted through the UI.

### Task Details Drawer

Tasks can be opened in a dedicated side drawer for editing without leaving the project view.

The drawer supports:

- auto-saving field changes
- status and priority editing
- date validation
- assignee editing
- task dependencies
- delete confirmation
- loading and saving states
- synchronized TanStack Query caches

The selected task is URL-addressable, allowing task details to behave as part of the navigation model rather than hidden global UI state.

### Task Dependencies

A task can block other tasks. There is a single relationship type, *A blocks B*, which the UI shows from whichever task is open:

- **Blocking** — the open task blocks another task
- **Waiting on** — the open task is blocked by another task

In the drawer's dependencies section:

- a searchable picker links a task as soon as it is selected
- clicking a dependency's icon flips its direction between Blocking and Waiting on
- the header shows how many linked tasks are done, e.g. `[1/3]`

The server enforces that:

- both tasks belong to the same project and organization
- a task cannot depend on itself, and a dependency cannot be added twice
- no circular dependency can be created, however long the chain

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
- automatic edge scrolling while dragging
- dynamically expanding timeline ranges
- scrolling in both directions with a sticky date header and task column
- dependency arrows between tasks
- current-day highlighting
- completed tasks shown crossed out
- synchronized task updates
- shared project/task-list data

The Gantt loads all tasks and dependencies belonging to a project:

```text
GET /api/tasks?projectId=...
GET /api/task-dependencies?projectId=...
```

The backend resolves those relationships through the task-list hierarchy rather than duplicating `projectId` on every task.

Dependencies are drawn as a single SVG layer above the task bars, with one `<path>` per dependency. Each line runs from the end of the blocking bar to the start of the dependent bar, with rounded right-angle corners and an arrowhead. When the dependent task starts before its blocker ends, the line detours through the gap between rows so it can still enter from the left. Bars and arrows share the same positioning function, so they can never drift apart, and the SVG ignores the pointer so bars stay draggable.

### Team & Roles

Each organization has two roles:

| Ability | Admin | User |
|---|:-:|:-:|
| See all members | ✓ | ✓ |
| Change own name | ✓ | ✓ |
| Rename the organization | ✓ | |
| Invite members | ✓ | |
| Change other members' roles | ✓ | |
| Remove other members | ✓ | |

Nobody can change their own role or remove themselves, and the last admin can never be demoted or removed. All rules are enforced on the server; the UI only hides what a user cannot do.

Members are managed on the `/settings` page. The current user's name and role are shown in the sidebar.

### Invitations

Admins invite people by email. The invitation link opens `/accept-invitation/:id`:

- signed-out users are sent through sign-in or sign-up and brought back, and the invitation is accepted automatically
- signing up from an invitation joins the existing organization instead of creating a new one
- users who are already signed in get an explicit Accept / Decline choice

Invitations are sent with Resend. Without an API key, the invitation link is printed in the server log instead, so the flow still works locally.

### Realtime Collaboration

Every open project joins a Socket.IO room. Changes made by any member are pushed to everyone viewing the same project:

```text
task:created          task-list:created          task-dependency:created
task:updated          task-list:updated          task-dependency:updated
task:deleted          task-list:deleted          task-dependency:deleted
```

The client reacts by invalidating the affected TanStack Query caches, so views refetch only what changed.

---

## Engineering Highlights

### PostgreSQL Persistence

Application data is stored in PostgreSQL rather than in-memory frontend/backend state.

Core relationships:

```text
Organization
  │
  ├── Members (users with a role)
  ├── Invitations
  │
  └── Projects
        │
        └── Task Lists
              │
              └── Tasks ──── Task Dependencies (task blocks dependent task)
```

The schema uses:

- UUID primary keys
- PostgreSQL enums
- foreign keys
- `ON DELETE CASCADE`
- indexes on relationship columns
- unique and check constraints
- timezone-aware event timestamps
- `DATE` fields for calendar dates
- database-level date constraints

For example, PostgreSQL prevents a task's due date from being earlier than its start date, and a task from depending on itself.

---

### Preventing Circular Dependencies

Adding the dependency *A blocks B* creates a cycle exactly when A is already downstream of B. The server checks that with a recursive query that walks every task reachable from B:

```sql
WITH RECURSIVE downstream(id) AS (
  SELECT dependent_task_id FROM task_dependencies WHERE task_id = :B
  UNION
  SELECT d.dependent_task_id FROM task_dependencies d
  JOIN downstream ON d.task_id = downstream.id
)
SELECT 1 FROM downstream WHERE id = :A
```

`UNION` (rather than `UNION ALL`) removes duplicates, so the walk terminates even on diamond-shaped graphs, which are still allowed.

Checking first and inserting afterwards would race: two requests adding *A blocks B* and *B blocks A* at the same time could both pass the check. So the check and the insert run in one transaction under a per-project advisory lock (`pg_advisory_xact_lock`), which serialises dependency writes within a project. A test fires both requests concurrently and asserts that exactly one succeeds.

Reversing a dependency runs through the same lock and check, ignoring the dependency being flipped, and leaves the original untouched if the reversed version would create a cycle.

---

### Authentication and Tenant Isolation

Authentication uses Better Auth with email/password sessions and its organization plugin for organizations, memberships, roles and invitations.

Every data query is scoped to the session's active organization. A session can outlive a membership, for example when an admin removes someone. So the auth middleware and the Socket.IO handshake both verify membership on every request, and removing a member also detaches their open sessions from the organization. A removed member loses access immediately.

Additional rules that Better Auth does not enforce on its own, such as never changing your own role, are applied in a server-side auth hook.

---

### Server-Side Aggregation

Project task counts and progress are computed in the same query that loads projects:

```sql
SELECT projects.*,
       count(tasks.id) AS task_count,
       count(tasks.id) FILTER (WHERE tasks.status = 'done') AS completed_count
FROM projects
LEFT JOIN task_lists ON task_lists.project_id = projects.id
LEFT JOIN tasks ON tasks.task_list_id = task_lists.id
GROUP BY projects.id
```

The project list therefore never needs to load tasks just to show progress.

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
- project creation and updates
- task-list creation and updates
- task creation and updates
- task dependencies
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

Query keys come from small factories (`projectKeys`, `taskListKeys`, `taskKeys`, `taskDependencyKeys`) so every query, mutation and realtime handler refers to the same keys.

Task queries deliberately use two cache shapes:

```ts
['tasks', 'project', projectId]
```

for Gantt data, and:

```ts
['tasks', 'taskList', taskListId]
```

for task-list data.

This reflects two genuinely different access patterns rather than forcing every view through the same endpoint. The trade-off is that the same task can live in several caches, so mutations keep them in sync. Saving a task updates its task list, the project-wide list and the single-task cache. A dependency is cached under both of its tasks and under its project. Cache helpers only update lists that are already loaded and never create empty ones.

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

```text
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PATCH  /api/projects/:id

GET    /api/task-lists?projectId=...
POST   /api/task-lists
PATCH  /api/task-lists/:id
DELETE /api/task-lists/:id

GET    /api/tasks/:id
GET    /api/tasks?taskListId=...
GET    /api/tasks?projectId=...
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id

GET    /api/task-dependencies?taskId=...
GET    /api/task-dependencies?projectId=...
POST   /api/task-dependencies
POST   /api/task-dependencies/:id/reverse
DELETE /api/task-dependencies/:id

*      /api/auth/*        Better Auth (sessions, organizations, members, invitations)
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

### Testing

| Layer | Tools | Covers |
|---|---|---|
| Unit | Vitest | Gantt geometry and dependency routing, validation, cache helpers, redirect safety, mouse auto-scroll |
| Component | Vitest, Testing Library | task drawer sections, settings by role, invitation flow, route guards |
| API integration | Vitest, supertest | tenant isolation, roles and invitations, task dependencies and cycles, project aggregates |

API integration tests run against a separate test database that is truncated before each test.

---

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | React 19 (React Compiler) |
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
| Authentication | Better Auth (organizations, roles, invitations) |
| Realtime | Socket.IO |
| Email | Resend |
| Testing | Vitest, Testing Library, supertest |
| Package Manager | pnpm |

---

## Architecture

```text
React
  │
  ├── React Router
  ├── TanStack Query
  ├── Socket.IO client
  └── Local React state
  │
  ▼
HTTP API  ◄──── Socket.IO (project rooms)
  │
  ▼
Express + TypeScript
  │
  ├── Better Auth (sessions, organizations, roles)
  ├── Membership check
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
│   ├── api/              # HTTP API client
│   ├── components/
│   │   ├── project/      # project cards, Gantt, dependency arrows
│   │   ├── task/         # task lists, task items, drawer, dependencies
│   │   ├── settings/     # profile, organization, members, invitations
│   │   └── ui/           # ConfirmModal, Toaster, DragHandle
│   ├── hooks/            # realtime sync, drag handling, mouse auto-scroll
│   ├── lib/              # Gantt geometry, validation, roles, MouseScroller
│   ├── pages/            # Dashboard, Projects, ProjectDetail, Settings, auth, invitations
│   ├── queries/          # TanStack Query hooks, key factories, cache helpers
│   ├── routes/           # protected, public and organization route guards
│   ├── services/         # auth client, socket, toasts
│   ├── types/
│   ├── __tests__/
│   └── App.tsx
│
└── server/
    ├── drizzle/          # Generated database migrations
    ├── src/
    │   ├── auth/         # Better Auth configuration and role rules
    │   ├── db/           # schema, auth schema, seed
    │   ├── email/        # invitation emails
    │   ├── middleware/   # authentication and membership check
    │   ├── routes/
    │   │   ├── projects.ts
    │   │   ├── task-lists.ts
    │   │   ├── tasks.ts
    │   │   └── task-dependencies.ts
    │   ├── app.ts        # Express app
    │   └── index.ts      # HTTP + Socket.IO server
    └── test/             # API integration tests
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

### 3. Configure the server

Create a local PostgreSQL database for ProjectOps.

Copy the example environment file:

```bash
cp server/.env.example server/.env
```

Configure:

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/project_ops

# a long random string, e.g. from `openssl rand -base64 32`
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3001

# frontend URL, used to build invitation links
APP_URL=http://localhost:5173

# invitation emails via Resend; leave empty to print invite links to the server log
RESEND_API_KEY=
EMAIL_FROM=ProjectOps <invites@your-verified-domain.com>
```

Without a verified domain, Resend only delivers to the email address of your Resend account.

### 4. Run database migrations

```bash
pnpm --dir server db:migrate
```

### 5. Start the application

```bash
pnpm dev
```

Development services:

| Service | URL |
|---|---|
| React | http://localhost:5173 |
| Express API | http://localhost:3001 |

### 6. Create your account

Sign up at http://localhost:5173. Signing up creates your organization, and you become its admin.

### 7. Add sample data (optional)

```bash
pnpm --dir server db:seed
```

The seed adds a "ProjectOps (sample)" project with task lists and tasks to an existing organization. That's the oldest one, or the one in `SEED_ORGANIZATION_ID` if you set it. It never deletes or changes existing data, and does nothing if the sample project already exists.

---

## Running Tests

Frontend unit and component tests:

```bash
pnpm test
```

API integration tests need their own database, because it is truncated before every test. Create a `project_ops_test` database, then copy the env file and point it at that database:

```bash
cp server/.env.example server/.env.test
```

```bash
pnpm --dir server db:migrate:test
```

```bash
pnpm --dir server test
```

Email variables are blanked for server tests, so they never send real emails.

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
pnpm db:migrate:test
```

Apply pending migrations to the test database.

```bash
pnpm db:seed
```

Add the sample project to an existing organization (add-only).

### Upgrading an existing database

Organization creators used to receive the `owner` role. Roles are now `admin` and `member` only, so convert existing owners once:

```sql
UPDATE member SET role = 'admin' WHERE role = 'owner';
```

---

## Current Development Focus

With authentication, multi-tenancy, roles, realtime collaboration and task dependencies in place, the focus moves to delivery and quality:

- end-to-end tests for the main user flows
- continuous integration running lint, type checks and both test suites
- production deployment
- database-backed dashboard analytics

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
- [x] Authentication
- [x] Organizations and memberships
- [x] Multi-tenant authorization
- [x] Realtime task synchronization with Socket.IO
- [x] ADMIN and USER roles with corresponding abilities
- [x] Email invitations
- [x] Project editing, task counts and progress
- [x] Task list renaming and deletion
- [x] Task dependencies with cycle prevention
- [x] Gantt dependency arrows
- [x] Unit, component and API integration tests

Next:
- [ ] End-to-end tests
- [ ] CI
- [ ] Production deployment
- [ ] Database-backed dashboard analytics

Later:
- [ ] Organization switcher for users in several organizations
- [ ] Account deletion
- [ ] Lazy-loaded task picker for dependencies

Non MVP:
- [ ] Google OAuth
- [ ] Custom dashboards

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
- graph constraints and concurrency

The goal is not to add as many technologies as possible.

The goal is to understand why each part of the architecture exists, introduce it when the product needs it, and keep the system understandable as the application grows.
