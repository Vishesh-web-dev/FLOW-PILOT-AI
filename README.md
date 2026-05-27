# 🚀 FlowPilot AI — AI Workflow Automation Platform

FlowPilot AI is a full-stack productivity platform that lets you manage tasks, sprints, and projects through natural language AI commands with real-time collaboration.

---

## ✨ Features

- 🤖 **AI Command Input** — Type natural language commands like *"Create a high-priority task to fix the login bug due Friday"*
- 🗂 **Kanban Board** — Drag-and-drop task management with 4 status columns
- 🏃 **Sprint Planner** — Create and manage sprints with AI-generated plans
- 📊 **Dashboard** — Stats, charts, and recent activity overview
- 🔔 **Smart Reminders** — Real-time socket notifications when reminders trigger
- 📋 **Activity Timeline** — Full audit trail of all workspace actions
- 🌓 **Dark Theme** — Beautiful dark UI with indigo accent color

---

## 🏗 Tech Stack

### Backend
- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** + **Prisma ORM**
- **JWT** Authentication
- **Socket.io** for real-time events
- **OpenAI GPT-4o-mini** for AI commands
- **node-cron** for background reminder jobs

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Ant Design 5** (dark theme)
- **Tailwind CSS**
- **React Query** for server state
- **Zustand** for auth state
- **@dnd-kit** for drag-and-drop
- **Recharts** for data visualizations
- **Socket.io-client** for real-time updates

---

## 🚦 Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **OpenAI API Key** (from https://platform.openai.com)

---

## ⚙️ Setup

### 1. Clone & Navigate

```bash
git clone <repo-url>
cd flow-pilot-ai
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/flowpilot"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
OPENAI_API_KEY="sk-..."
FRONTEND_URL="http://localhost:5173"
PORT=5000
NODE_ENV=development
```

```bash
# Run database migrations
npx prisma migrate dev --name init

# Seed demo data
npm run prisma:seed

# Start development server
npm run dev
```

Backend runs at: **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## 🔑 Demo Credentials

After seeding, log in with:

| Field    | Value                |
|----------|----------------------|
| Email    | demo@flowpilot.ai    |
| Password | demo123456           |

---

## 📁 Project Structure

```
flow-pilot-ai/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database models
│   │   └── seed.ts             # Demo data seeder
│   ├── src/
│   │   ├── config/             # DB + env config
│   │   ├── controllers/        # Route handlers
│   │   ├── middleware/         # Auth, error, validate
│   │   ├── routes/             # Express routes
│   │   ├── services/           # Business logic (AI, Activity)
│   │   ├── socket/             # Socket.io setup
│   │   ├── jobs/               # Cron jobs (reminders)
│   │   ├── types/              # TypeScript types
│   │   ├── utils/              # Helpers (JWT, logger, response)
│   │   └── index.ts            # App entry point
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/                # Axios API clients
    │   ├── components/
    │   │   ├── ai/             # AICommandInput, AIResponseCard
    │   │   ├── dashboard/      # StatsCards, Charts, Timeline
    │   │   ├── kanban/         # Board, Column, TaskCard, Modal
    │   │   └── layout/         # AppLayout, Sidebar, Header
    │   ├── hooks/              # useSocket
    │   ├── pages/              # Dashboard, Kanban, Sprints, etc.
    │   ├── store/              # Zustand auth store
    │   ├── types/              # TypeScript interfaces
    │   └── utils/              # Helpers, formatters
    └── package.json
```

---

## 🤖 AI Command Examples

- *"Create a task called Fix authentication bug with high priority due tomorrow"*
- *"Show me all overdue tasks"*
- *"Plan a 2-week sprint for the Q1 redesign project"*
- *"Set a reminder to review the PR at 3pm today"*
- *"Summarize my team's recent activity"*
- *"Mark task 'Update documentation' as done"*

---

## 🚀 Production Build

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
# Serve dist/ with nginx or similar
```

---

## 📜 License

MIT
