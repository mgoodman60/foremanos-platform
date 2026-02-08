/**
 * SMS Daily Report Service
 * Parses SMS messages into daily report fields and manages phone number mappings
 */

import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('SMS_DAILY_REPORT');

export interface DailyReportFields {
  workPerformed: string;
  crewSize: number;
  equipment: string[];
  materials: string[];
  delays: string;
  delayHours: number;
  safety: string;
}

/**
 * Keyword-based parser for SMS messages
 * Lightweight extraction without AI calls
 */
export function parseSMSToReportFields(message: string): Partial<DailyReportFields> {
  const fields: Partial<DailyReportFields> = {};
  const text = message.trim();
  if (!text) return fields;

  // Crew size: "6 guys", "4 workers", "8 crew", "3 people"
  const crewMatch = text.match(/(\d+)\s*(?:guys?|workers?|crew|people|men|subs?)/i);
  if (crewMatch) {
    fields.crewSize = parseInt(crewMatch[1]);
  }

  // Equipment keywords
  const equipmentKeywords = ['crane', 'excavator', 'loader', 'backhoe', 'bulldozer', 'forklift',
    'scaffold', 'pump', 'generator', 'compressor', 'boom lift', 'scissor lift', 'concrete truck',
    'dump truck', 'skid steer'];
  const foundEquipment: string[] = [];
  for (const kw of equipmentKeywords) {
    if (text.toLowerCase().includes(kw)) foundEquipment.push(kw);
  }
  if (foundEquipment.length > 0) fields.equipment = foundEquipment;

  // Materials keywords
  const materialKeywords = ['lumber', 'concrete', 'rebar', 'steel', 'drywall', 'insulation',
    'pipe', 'conduit', 'wire', 'brick', 'block', 'gravel', 'sand', 'roofing', 'siding',
    'plywood', 'sheetrock', 'tile', 'glass'];
  const foundMaterials: string[] = [];
  for (const kw of materialKeywords) {
    if (text.toLowerCase().includes(kw)) foundMaterials.push(kw);
  }
  if (foundMaterials.length > 0) fields.materials = foundMaterials;

  // Delay detection
  const delayPatterns = /(?:delay|stopped|rain|snow|storm|waited|hold|shutdown|halted)/i;
  if (delayPatterns.test(text)) {
    fields.delays = text;
    // Try to extract hours: "lost 2 hours", "delayed 3 hrs"
    const hoursMatch = text.match(/(?:lost|delayed?|stopped)\s*(?:about\s*)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
    if (hoursMatch) {
      fields.delayHours = parseFloat(hoursMatch[1]);
    }
  }

  // Safety detection
  const safetyPatterns = /(?:injur|incident|accident|first\s*aid|near\s*miss|unsafe|hazard)/i;
  if (safetyPatterns.test(text)) {
    fields.safety = text;
  }

  // Everything is work performed (the raw text is the work description)
  fields.workPerformed = text;

  return fields;
}

/**
 * Aggregates multiple SMS messages into a single daily report
 */
export function aggregateSMSMessages(messages: Array<{ text: string; timestamp: Date }>): DailyReportFields {
  const result: DailyReportFields = {
    workPerformed: '',
    crewSize: 0,
    equipment: [],
    materials: [],
    delays: '',
    delayHours: 0,
    safety: '',
  };

  // Sort by timestamp
  const sorted = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const workParts: string[] = [];
  const delayParts: string[] = [];
  const safetyParts: string[] = [];
  const allEquipment = new Set<string>();
  const allMaterials = new Set<string>();

  for (const msg of sorted) {
    const parsed = parseSMSToReportFields(msg.text);

    if (parsed.workPerformed) workParts.push(parsed.workPerformed);
    if (parsed.crewSize && parsed.crewSize > result.crewSize) result.crewSize = parsed.crewSize;
    if (parsed.equipment) parsed.equipment.forEach(e => allEquipment.add(e));
    if (parsed.materials) parsed.materials.forEach(m => allMaterials.add(m));
    if (parsed.delays) delayParts.push(parsed.delays);
    if (parsed.delayHours) result.delayHours = Math.max(result.delayHours, parsed.delayHours);
    if (parsed.safety) safetyParts.push(parsed.safety);
  }

  result.workPerformed = workParts.join(' | ');
  result.equipment = Array.from(allEquipment);
  result.materials = Array.from(allMaterials);
  result.delays = delayParts.join(' | ');
  result.safety = safetyParts.join(' | ');

  return result;
}

/**
 * Format daily report fields into SMS summary
 */
export function formatDailySummary(fields: DailyReportFields): string {
  const parts: string[] = [];

  if (fields.workPerformed) {
    // Truncate to 100 chars for SMS summary
    const work = fields.workPerformed.length > 100
      ? fields.workPerformed.substring(0, 100) + '...'
      : fields.workPerformed;
    parts.push(work);
  }

  if (fields.crewSize > 0) parts.push(`${fields.crewSize} crew`);
  if (fields.equipment.length > 0) parts.push(fields.equipment.join(', '));
  if (fields.materials.length > 0) parts.push(`materials: ${fields.materials.join(', ')}`);
  if (fields.delays) parts.push(`delay: ${fields.delayHours || '?'}hr`);
  if (fields.safety) parts.push('SAFETY NOTE');

  return `Today's summary: ${parts.join('. ')}. Reply OK to confirm or add corrections.`;
}

/**
 * Look up user by phone number
 * Returns user ID, name, and project ID if mapping exists
 */
export async function lookupUserByPhone(
  phoneNumber: string,
  projectId?: string
): Promise<{ userId: string; userName: string; projectId: string } | null> {
  const where: any = {
    phoneNumber,
    isActive: true,
  };
  if (projectId) where.projectId = projectId;
  // Also require the project to have SMS enabled
  where.project = { smsEnabled: true };

  const mapping = await prisma.sMSMapping.findFirst({
    where,
    include: { user: { select: { id: true, username: true } }, project: { select: { id: true } } },
  });

  if (!mapping) return null;

  return {
    userId: mapping.user.id,
    userName: mapping.user.username,
    projectId: mapping.project.id,
  };
}
