import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanup() {
  const project = await prisma.project.findUnique({
    where: { slug: 'one-senior-morehead' },
    select: { id: true }
  });
  
  if (!project) {
    console.log('Project not found');
    return;
  }
  
  // Get all schedules for the project, ordered by creation date
  const schedules = await prisma.schedule.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { ScheduleTask: true } }
    }
  });
  
  console.log(`Found ${schedules.length} schedules for project`);
  
  // Keep only the most recent schedule, delete the rest
  const [keepSchedule, ...deleteSchedules] = schedules;
  
  console.log(`Keeping: ${keepSchedule.name} (${keepSchedule._count.ScheduleTask} tasks, created: ${keepSchedule.createdAt.toISOString()})`);
  
  // Make sure the kept schedule is active
  await prisma.schedule.update({
    where: { id: keepSchedule.id },
    data: { isActive: true }
  });
  
  // Delete duplicate schedules
  for (const schedule of deleteSchedules) {
    console.log(`Deleting: ${schedule.name} (${schedule._count.ScheduleTask} tasks, created: ${schedule.createdAt.toISOString()})`);
    
    // Delete tasks first
    await prisma.scheduleTask.deleteMany({
      where: { scheduleId: schedule.id }
    });
    
    // Delete schedule
    await prisma.schedule.delete({
      where: { id: schedule.id }
    });
  }
  
  console.log(`\nCleanup complete. Deleted ${deleteSchedules.length} duplicate schedules.`);
  
  await prisma.$disconnect();
}

cleanup().catch(e => { console.error(e); process.exit(1); });
