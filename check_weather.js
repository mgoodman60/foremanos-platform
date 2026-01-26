const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWeather() {
  try {
    const snapshots = await prisma.weatherSnapshot.findMany({
      where: {
        snapshotTime: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { snapshotTime: 'desc' },
      take: 5,
      include: {
        project: {
          select: { name: true }
        }
      }
    });
    
    console.log('\n=== Recent Weather Snapshots ===');
    snapshots.forEach(s => {
      console.log(`${s.snapshotTime.toISOString()} | ${s.project.name} | ${s.temperature}°F | ${s.conditions} | Type: ${s.snapshotType}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkWeather();
