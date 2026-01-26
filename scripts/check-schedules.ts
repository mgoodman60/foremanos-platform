import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const project = await prisma.project.findUnique({
    where: { slug: 'one-senior-morehead' },
    select: { id: true }
  });
  
  if (!project) {
    console.log('Project not found');
    return;
  }
  
  const schedules = await prisma.schedule.findMany({
    where: { projectId: project.id },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { ScheduleTask: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('Recent Schedules:');
  schedules.forEach(s => {
    console.log(`- ${s.name} | Active: ${s.isActive} | Tasks: ${s._count.ScheduleTask} | Created: ${s.createdAt.toISOString()}`);
  });
  
  const activeSchedule = await prisma.schedule.findFirst({
    where: { projectId: project.id, isActive: true },
    include: { _count: { select: { ScheduleTask: true } } }
  });
  
  console.log('\nActive Schedule:', activeSchedule ? `${activeSchedule.name} (${activeSchedule._count.ScheduleTask} tasks)` : 'NONE');
  
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
