import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const project = await prisma.project.findUnique({
    where: { slug: 'one-senior-morehead' },
    select: { id: true, name: true }
  });
  
  if (!project) {
    console.log('Project not found');
    return;
  }
  
  console.log(`Project: ${project.name}`);
  
  const schedule = await prisma.schedule.findFirst({
    where: { projectId: project.id, isActive: true },
    include: { 
      ScheduleTask: {
        select: { 
          name: true, 
          startDate: true, 
          endDate: true,
          percentComplete: true,
          isCritical: true
        },
        take: 10
      }
    }
  });
  
  if (!schedule) {
    console.log('No active schedule found');
    return;
  }
  
  console.log(`\nSchedule: ${schedule.name}`);
  console.log(`Tasks: ${schedule.ScheduleTask.length}`);
  console.log(`Date Range: ${schedule.startDate?.toISOString().split('T')[0]} to ${schedule.endDate?.toISOString().split('T')[0]}`);
  
  console.log('\nSample Tasks:');
  schedule.ScheduleTask.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i+1}. ${t.name} | ${t.startDate?.toISOString().split('T')[0]} - ${t.endDate?.toISOString().split('T')[0]} | ${t.percentComplete || 0}% | Critical: ${t.isCritical}`);
  });
  
  await prisma.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
