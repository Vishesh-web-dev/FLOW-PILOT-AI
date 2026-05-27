import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create demo user
  const hashedPassword = await bcrypt.hash("demo123456", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@flowpilot.ai" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@flowpilot.ai",
      password: hashedPassword,
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create a demo project
  const project = await prisma.project.upsert({
    where: { id: "demo-project-id" },
    update: {},
    create: {
      id: "demo-project-id",
      name: "FlowPilot Demo",
      description: "A demo project to showcase FlowPilot AI",
      color: "#6366f1",
      userId: user.id,
    },
  });

  console.log(`✅ Created project: ${project.name}`);

  // Create demo tasks
  const tasks = [
    {
      title: "Set up authentication system",
      description: "Implement JWT-based auth with login and register",
      status: "DONE" as const,
      priority: "HIGH" as const,
      labels: ["backend", "auth"],
      estimatedHours: 4,
    },
    {
      title: "Build Kanban board UI",
      description: "Create drag-and-drop Kanban board with DnD Kit",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      labels: ["frontend", "ui"],
      estimatedHours: 6,
    },
    {
      title: "Integrate OpenAI for task parsing",
      description: "Use GPT-4o-mini to parse natural language commands",
      status: "IN_PROGRESS" as const,
      priority: "URGENT" as const,
      labels: ["ai", "backend"],
      estimatedHours: 3,
    },
    {
      title: "Add real-time updates with Socket.io",
      description: "WebSocket integration for live task updates",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      labels: ["backend", "realtime"],
      estimatedHours: 5,
    },
    {
      title: "Create activity timeline",
      description: "Build activity log timeline like Notion/Linear",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      labels: ["frontend"],
      estimatedHours: 3,
    },
    {
      title: "Fix payment gateway bug",
      description: "Users cannot complete checkout, investigate and fix",
      status: "TODO" as const,
      priority: "URGENT" as const,
      labels: ["bug", "backend"],
      estimatedHours: 2,
    },
    {
      title: "Write API documentation",
      description: "Document all REST API endpoints with examples",
      status: "TODO" as const,
      priority: "LOW" as const,
      labels: ["documentation"],
      estimatedHours: 4,
    },
    {
      title: "Design system setup",
      description: "Configure Tailwind CSS + Ant Design component library",
      status: "DONE" as const,
      priority: "MEDIUM" as const,
      labels: ["frontend", "design"],
      estimatedHours: 2,
    },
  ];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    await prisma.task.create({
      data: {
        ...task,
        userId: user.id,
        projectId: project.id,
        position: i,
        dueDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`✅ Created ${tasks.length} demo tasks`);

  // Create demo sprint
  const sprint = await prisma.sprint.create({
    data: {
      name: "Sprint 1 - MVP",
      goal: "Build core features of FlowPilot AI",
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      userId: user.id,
      projectId: project.id,
    },
  });

  console.log(`✅ Created sprint: ${sprint.name}`);

  // Create demo reminder
  await prisma.reminder.create({
    data: {
      title: "Deploy to production",
      description: "Deploy FlowPilot AI v1.0 to production server",
      remindAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      userId: user.id,
    },
  });

  console.log("✅ Created demo reminder");

  // Create demo activities
  const activityData = [
    { type: "USER_REGISTERED" as const, description: "Demo User joined FlowPilot AI" },
    { type: "PROJECT_CREATED" as const, description: 'Created project: "FlowPilot Demo"' },
    { type: "TASK_CREATED" as const, description: 'Created task: "Set up authentication system"' },
    { type: "TASK_MOVED" as const, description: 'Moved task "Set up authentication system" to DONE' },
    { type: "AI_COMMAND" as const, description: 'AI Command: "Create tasks for auth module"' },
    { type: "SPRINT_CREATED" as const, description: 'Created sprint: "Sprint 1 - MVP"' },
  ];

  for (const activity of activityData) {
    await prisma.activity.create({
      data: { ...activity, userId: user.id },
    });
  }

  console.log("✅ Created demo activities");
  console.log("\n🎉 Seeding completed!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📧 Demo credentials:");
  console.log("   Email: demo@flowpilot.ai");
  console.log("   Password: demo123456");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
