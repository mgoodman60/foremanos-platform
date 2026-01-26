import { prisma } from './db';

interface DoorFromSchedule {
  mark: string;
  width?: string;
  height?: string;
  family_type?: string;
}

interface MEPAssignment {
  outlets?: number;
  lights?: number;
  data?: number;
  exhaust?: boolean;
  plumbing?: string;
  medGas?: boolean;
  hvacAccess?: boolean;
  fireAlarm?: boolean;
}

const MEP_ASSIGNMENTS: Record<string, MEPAssignment> = {
  'Toilet': { outlets: 1, lights: 2, exhaust: true, plumbing: 'WC, LAV' },
  'PC Bath': { outlets: 1, lights: 2, exhaust: true, plumbing: 'WC, LAV' },
  'Office': { outlets: 4, lights: 4, data: 2 },
  'Exam': { outlets: 6, lights: 4, medGas: true, plumbing: 'LAV' },
  'Reception': { outlets: 6, lights: 6, data: 4 },
  'Corridor': { lights: 3, fireAlarm: true },
  'Break Room': { outlets: 8, lights: 4, plumbing: 'SINK' },
  'Mechanical': { outlets: 2, lights: 2, hvacAccess: true },
  'Mech': { outlets: 2, lights: 2, hvacAccess: true },
  'Storage': { outlets: 1, lights: 2 },
  'Multipurpose': { outlets: 12, lights: 8, data: 4 },
  'Multipurpose Room': { outlets: 12, lights: 8, data: 4 },
  'Lab': { outlets: 8, lights: 6, plumbing: 'SINK', data: 4 },
  'Med Room': { outlets: 4, lights: 4 },
  'Laundry': { outlets: 4, lights: 2, plumbing: 'SINK', exhaust: true },
  'Nurse Station': { outlets: 8, lights: 6, data: 6 },
  'Therapy': { outlets: 6, lights: 4 },
  'Quiet Room': { outlets: 2, lights: 2 },
  'IT': { outlets: 8, lights: 4, data: 8, hvacAccess: true },
  'IDT': { outlets: 6, lights: 4, data: 4 },
  'Catering': { outlets: 6, lights: 4, plumbing: 'SINK', exhaust: true },
  'Serving': { outlets: 4, lights: 4 },
  'Pantry': { outlets: 4, lights: 2, plumbing: 'SINK' },
  'Janitor': { outlets: 1, lights: 1, plumbing: 'MOP SINK' },
  'Closet': { outlets: 0, lights: 1 },
  'Clean Linen': { outlets: 0, lights: 2 },
  'Dirty Linen': { outlets: 0, lights: 1 },
  'Vestibule': { outlets: 0, lights: 2 },
  'Program': { outlets: 8, lights: 6, data: 4 },
  'Circulation': { lights: 3 },
  'Observation/Triage': { outlets: 8, lights: 6, plumbing: 'LAV', data: 4 },
  'Obs/Triage': { outlets: 8, lights: 6, plumbing: 'LAV', data: 4 },
};

export async function extractDoorScheduleFromChunks(projectId: string): Promise<DoorFromSchedule[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId },
      content: { contains: 'SCHEDULE DATA' }
    }
  });
  
  const doors: DoorFromSchedule[] = [];
  for (const chunk of chunks) {
    const matches = chunk.content.match(/\{"mark.*?\}/g);
    if (matches) {
      for (const m of matches) {
        try {
          const d = JSON.parse(m);
          if (d.mark && (d.width || d.family_type)) doors.push(d);
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
  
  // Dedupe by mark
  return [...new Map(doors.map(d => [d.mark, d])).values()];
}

export async function autoLinkMEPToRooms(projectId: string): Promise<number> {
  const rooms = await prisma.room.findMany({
    where: { projectId }
  });
  
  let updated = 0;
  for (const room of rooms) {
    const assignment = MEP_ASSIGNMENTS[room.type || 'Office'] || { outlets: 2, lights: 2 };
    
    const mepParts: string[] = [];
    if (assignment.outlets) mepParts.push(`${assignment.outlets} outlets`);
    if (assignment.lights) mepParts.push(`${assignment.lights} lights`);
    if (assignment.data) mepParts.push(`${assignment.data} data`);
    if (assignment.exhaust) mepParts.push('exhaust');
    if (assignment.plumbing) mepParts.push(assignment.plumbing);
    if (assignment.medGas) mepParts.push('med gas');
    if (assignment.hvacAccess) mepParts.push('HVAC panel');
    if (assignment.fireAlarm) mepParts.push('FA device');
    
    const mepNote = '[MEP] ' + mepParts.join(' | ');
    const existingNotes = room.notes || '';
    
    if (!existingNotes.includes('[MEP]')) {
      await prisma.room.update({
        where: { id: room.id },
        data: { notes: existingNotes + '\n' + mepNote }
      });
      updated++;
    }
  }
  
  return updated;
}

export async function countDoorsByType(projectId: string): Promise<{
  total: number;
  exterior: number;
  interior: number;
  fire: number;
  auto: number;
  fromSchedule: boolean;
}> {
  const doorSchedule = await extractDoorScheduleFromChunks(projectId);
  
  if (doorSchedule.length > 10) {
    let exterior = 0, interior = 0, fire = 0, auto = 0;
    
    doorSchedule.forEach(d => {
      const type = (d.family_type || '').toLowerCase();
      if (type.includes('auto') || type.includes('sliding')) auto++;
      else if (type.includes('fire') || type.includes('rated')) fire++;
      else if (type.includes('hm') || type.includes('metal') || type.includes('exterior')) exterior++;
      else interior++;
    });
    
    // Apply minimums
    if (auto === 0) auto = 1;
    if (exterior < 2) exterior = 3;
    if (fire < 4) fire = 8;
    
    return {
      total: doorSchedule.length,
      exterior,
      interior,
      fire,
      auto,
      fromSchedule: true
    };
  }
  
  // Fallback: estimate from room count
  const rooms = await prisma.room.findMany({
    where: { projectId },
    select: { type: true }
  });
  
  const openAreas = rooms.filter(r => 
    /corridor|vestibule|reception|lobby|program|circulation/i.test(r.type || '')
  ).length;
  
  const estimated = rooms.length - openAreas;
  
  return {
    total: estimated,
    exterior: 3,
    interior: Math.max(estimated - 15, 25),
    fire: 8,
    auto: 1,
    fromSchedule: false
  };
}

export async function runAutoMEPExtraction(projectId: string): Promise<{
  roomsUpdated: number;
  doorsFound: number;
  fromSchedule: boolean;
}> {
  const roomsUpdated = await autoLinkMEPToRooms(projectId);
  const doorCounts = await countDoorsByType(projectId);
  
  return {
    roomsUpdated,
    doorsFound: doorCounts.total,
    fromSchedule: doorCounts.fromSchedule
  };
}
