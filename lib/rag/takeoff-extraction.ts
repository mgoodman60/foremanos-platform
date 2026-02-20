/**
 * Material Takeoff Extraction Functions
 *
 * Extracted from lib/rag-enhancements.ts — functions that extract quantifiable
 * items from construction documents following strict rules: count/measure only
 * what's explicitly shown.
 */

import type {
  TakeoffItem,
  TakeoffRollup,
  TakeoffResult,
  EnhancedChunk,
} from './types';

/**
 * Extract takeoff items from document chunks
 * Only counts/measures items explicitly shown in schedules, tags, or drawings
 */
export function extractTakeoffItems(
  chunks: EnhancedChunk[],
  scope: string,
  _query: string
): TakeoffItem[] {
  const items: TakeoffItem[] = [];

  // Extract from schedules first (highest confidence)
  const scheduleChunks = chunks.filter(c =>
    /\b(schedule|legend|symbol)\b/i.test(c.content)
  );

  for (const chunk of scheduleChunks) {
    const scheduleItems = extractFromSchedule(chunk, scope);
    items.push(...scheduleItems);
  }

  // Extract from plan views (tags and labels)
  const planChunks = chunks.filter(c =>
    /\b(plan|layout|floor)\b/i.test(c.content) &&
    !scheduleChunks.includes(c)
  );

  for (const chunk of planChunks) {
    const planItems = extractFromPlan(chunk, scope, items);
    items.push(...planItems);
  }

  return items;
}

/**
 * Extract items from schedule chunks
 */
function extractFromSchedule(chunk: EnhancedChunk, scope: string): TakeoffItem[] {
  const items: TakeoffItem[] = [];
  const content = chunk.content;
  const docName = chunk.metadata?.documentName || 'Unknown';
  const pageNum = chunk.pageNumber || 'N/A';

  // Determine trade based on scope and chunk content
  let trade = scope.toUpperCase();
  if (trade === 'GENERAL') {
    if (/\b(hvac|mechanical|air)\b/i.test(content)) trade = 'HVAC';
    else if (/\b(plumb|fixture|water)\b/i.test(content)) trade = 'PLUMBING';
    else if (/\b(electrical|power|panel)\b/i.test(content)) trade = 'ELECTRICAL';
    else if (/\b(fire alarm|fa)\b/i.test(content)) trade = 'FIRE ALARM';
    else if (/\b(door|window)\b/i.test(content)) trade = 'ARCHITECTURAL';
  }

  // Extract equipment from HVAC schedules
  if (scope === 'hvac' || /\b(hvac|mechanical|equipment schedule)\b/i.test(content)) {
    // Pattern: AHU-1, RTU-2, VAV-103, etc.
    const equipMatches = content.matchAll(/\b(AHU|RTU|VAV|FCU|MAU|ERV|HRV)-?\d+[A-Z]?\b/gi);
    for (const match of equipMatches) {
      const tag = match[0];

      // Try to extract specs from same line
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));
      const description = tagLine ? tagLine.trim() : `${match[1]} Unit`;

      items.push({
        trade: 'HVAC',
        system: match[1],
        itemType: 'Equipment',
        itemTagOrId: tag,
        description,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from equipment schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in equipment schedule',
      });
    }

    // Extract air devices
    const deviceMatches = content.matchAll(/\b(EF|IF|RF|SF|TD|RD|SD)-?\d+\b/gi);
    for (const match of deviceMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));

      items.push({
        trade: 'HVAC',
        system: 'Air Distribution',
        itemType: 'Device',
        itemTagOrId: tag,
        description: `${match[1]} - ${getDeviceDescription(match[1])}`,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from schedule/legend',
        confidence: 'high',
        confidenceBasis: 'Explicitly tagged in documents',
      });
    }
  }

  // Extract plumbing fixtures
  if (scope === 'plumbing' || /\b(plumb|fixture schedule)\b/i.test(content)) {
    const fixtureMatches = content.matchAll(/\b(WC|LAV|UR|DF|FD|SH|BT)-?\d+[A-Z]?\b/gi);
    for (const match of fixtureMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));

      items.push({
        trade: 'PLUMBING',
        system: 'Fixtures',
        itemType: getFixtureType(match[1]),
        itemTagOrId: tag,
        description: `${getFixtureDescription(match[1])}`,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from fixture schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in fixture schedule',
      });
    }
  }

  // Extract electrical panels and devices
  if (scope === 'electrical' || /\b(electrical|panel schedule)\b/i.test(content)) {
    // Panels
    const panelMatches = content.matchAll(/\b(MDP|MSB|SB|RP|LP|DP|PP|EM|LT|PNL)-?\d+[A-Z]?\b/gi);
    for (const match of panelMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));

      items.push({
        trade: 'ELECTRICAL',
        system: 'Power Distribution',
        itemType: 'Panel',
        itemTagOrId: tag,
        description: `${getPanelDescription(match[1])}`,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from panel schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in panel schedule',
      });
    }

    // Receptacles and switches (count occurrences)
    const recCount = (content.match(/\bREC-?\d+\b/gi) || []).length;
    if (recCount > 0) {
      items.push({
        trade: 'ELECTRICAL',
        system: 'Branch Circuits',
        itemType: 'Receptacle',
        itemTagOrId: 'REC-*',
        description: 'Receptacles (all types)',
        quantity: recCount,
        unit: 'EA',
        sizeOrRating: '120V typical',
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from plan views and schedules',
        confidence: 'high',
        confidenceBasis: `${recCount} receptacle tags found in documents`,
      });
    }
  }

  // Extract fire alarm devices
  if (scope === 'fire_alarm' || /\b(fire alarm|device schedule)\b/i.test(content)) {
    const deviceMatches = content.matchAll(/\b(SD|HS|PS|PD|DUCT|WF)-?\d+[A-Z]?\b/gi);
    for (const match of deviceMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));

      items.push({
        trade: 'FIRE ALARM',
        system: 'Detection & Notification',
        itemType: getFADeviceType(match[1]),
        itemTagOrId: tag,
        description: getFADeviceDescription(match[1]),
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from device schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in fire alarm schedule',
      });
    }
  }

  return items;
}

/**
 * Extract items from plan views (only if tagged)
 */
function extractFromPlan(chunk: EnhancedChunk, scope: string, existingItems: TakeoffItem[]): TakeoffItem[] {
  const items: TakeoffItem[] = [];
  const _content = chunk.content;
  const _docName = chunk.metadata?.documentName || 'Unknown';
  const _pageNum = chunk.pageNumber || 'N/A';

  // Only count items that are explicitly tagged but not already in schedules
  const _existingTags = new Set(existingItems.map(i => i.itemTagOrId));

  // This function intentionally does NOT measure ductwork, piping, or conduit
  // unless routing is clearly dimensioned and scaled - which requires explicit user request

  return items;
}

/**
 * Calculate confidence score for a takeoff item
 */
function _calculateItemConfidence(
  item: TakeoffItem,
  _chunks: EnhancedChunk[]
): { confidence: 'high' | 'medium' | 'low'; basis: string } {
  // High confidence: Schedule-based or explicitly dimensioned
  if (item.method === 'counted' && item.sourceRefs.some(r => /schedule/i.test(r))) {
    return {
      confidence: 'high',
      basis: 'Counted from schedule or equipment list',
    };
  }

  if (item.method === 'dimensioned' && item.sourceRefs.length >= 2) {
    return {
      confidence: 'high',
      basis: 'Explicitly dimensioned with multiple source confirmations',
    };
  }

  // Medium confidence: Scaled with visible scale
  if (item.method === 'scaled' && item.sourceRefs.some(r => /scale/i.test(r))) {
    return {
      confidence: 'medium',
      basis: 'Scaled measurement with documented scale',
    };
  }

  // Low confidence: Incomplete data
  if (item.method === 'not_quantified') {
    return {
      confidence: 'low',
      basis: 'Insufficient information to quantify',
    };
  }

  return {
    confidence: 'medium',
    basis: 'Single source or partial documentation',
  };
}

/**
 * Generate rollups by grouping criteria
 */
export function generateRollups(
  items: TakeoffItem[],
  groupBy: 'trade' | 'system' | 'size' | 'item_type'
): TakeoffRollup[] {
  const rollups: TakeoffRollup[] = [];
  const groups = new Map<string, TakeoffItem[]>();

  // Group items
  for (const item of items) {
    let key: string;
    switch (groupBy) {
      case 'trade':
        key = item.trade;
        break;
      case 'system':
        key = `${item.trade}:${item.system}`;
        break;
      case 'size':
        key = `${item.itemType}:${item.sizeOrRating}`;
        break;
      case 'item_type':
        key = item.itemType;
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  // Create rollups
  for (const [key, groupItems] of groups) {
    const totalQty = groupItems.reduce((sum, item) => {
      return sum + (typeof item.quantity === 'number' ? item.quantity : 0);
    }, 0);

    // Inherit lowest confidence
    const lowestConfidence = groupItems.reduce((lowest, item) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[item.confidence] < confidenceOrder[lowest] ? item.confidence : lowest;
    }, 'high' as 'high' | 'medium' | 'low');

    const [groupValue, system] = key.includes(':') ? key.split(':') : [key, undefined];

    rollups.push({
      trade: groupItems[0].trade,
      system,
      groupBy,
      groupValue,
      totalQuantity: totalQty,
      unit: groupItems[0].unit,
      itemCount: groupItems.length,
      confidence: lowestConfidence,
      confidenceBasis: `Rolled up from ${groupItems.length} line items`,
      items: groupItems,
    });
  }

  return rollups;
}

/**
 * Generate estimator-ready export format
 */
export function generateTakeoffExport(
  items: TakeoffItem[],
  projectName: string,
  userName: string,
  scope: string,
  includeRollups: boolean = false
): TakeoffResult {
  const warnings: string[] = [];
  const disclaimers: string[] = [];

  // Count items by method
  const countedItems = items.filter(i => i.method === 'counted').length;
  const measuredItems = items.filter(i => i.method === 'dimensioned' || i.method === 'scaled').length;
  const notQuantifiedItems = items.filter(i => i.method === 'not_quantified').length;

  // Add standard disclaimers
  disclaimers.push(
    'ESTIMATOR NOTE: Quantities are based solely on provided documents and exclude unshown or inferred scope.'
  );
  disclaimers.push(
    'No waste factor has been applied. Add appropriate waste/overage per your company standards.'
  );
  disclaimers.push(
    'Counts include only explicitly tagged or scheduled items. Verify against full document set.'
  );

  // Detect potential issues
  if (notQuantifiedItems > 0) {
    warnings.push(
      `${notQuantifiedItems} item(s) could not be quantified due to insufficient information.`
    );
  }

  // Check for "By Others" references
  const byOthersItems = items.filter(i =>
    /\b(by others|n\.?i\.?c|owner[ -]furnished)\b/i.test(i.exclusionsOrNotes)
  );
  if (byOthersItems.length > 0) {
    warnings.push(
      `${byOthersItems.length} item(s) flagged as "By Others" or NIC. Verify scope boundaries.`
    );
  }

  const result: TakeoffResult = {
    projectName,
    generatedDate: new Date().toISOString(),
    requestedBy: userName,
    scope: scope.toUpperCase(),
    items,
    warnings,
    disclaimers,
    totalItems: items.length,
    countedItems,
    measuredItems,
    notQuantifiedItems,
  };

  if (includeRollups) {
    result.rollups = [
      ...generateRollups(items, 'trade'),
      ...generateRollups(items, 'system'),
    ];
  }

  return result;
}

/**
 * Helper functions for descriptions
 */
function getDeviceDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'EF': 'Exhaust Fan',
    'IF': 'Inline Fan',
    'RF': 'Return Fan',
    'SF': 'Supply Fan',
    'TD': 'Transfer Duct',
    'RD': 'Return Diffuser',
    'SD': 'Supply Diffuser',
    'ED': 'Exhaust Damper',
    'GD': 'Grille Diffuser',
  };
  return descriptions[tag.toUpperCase()] || tag;
}

function getFixtureType(tag: string): string {
  const types: Record<string, string> = {
    'WC': 'Water Closet',
    'LAV': 'Lavatory',
    'UR': 'Urinal',
    'DF': 'Drinking Fountain',
    'FD': 'Floor Drain',
    'SH': 'Shower',
    'BT': 'Bathtub',
  };
  return types[tag.toUpperCase()] || 'Fixture';
}

function getFixtureDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'WC': 'Water Closet (Toilet)',
    'LAV': 'Lavatory (Sink)',
    'UR': 'Urinal',
    'DF': 'Drinking Fountain',
    'FD': 'Floor Drain',
    'SH': 'Shower',
    'BT': 'Bathtub',
    'HB': 'Hose Bibb',
    'MOP': 'Mop Sink',
  };
  return descriptions[tag.toUpperCase()] || tag;
}

function getPanelDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'MDP': 'Main Distribution Panel',
    'MSB': 'Main Switchboard',
    'SB': 'Switchboard',
    'RP': 'Receptacle Panel',
    'LP': 'Lighting Panel',
    'DP': 'Distribution Panel',
    'PP': 'Power Panel',
    'EM': 'Emergency Panel',
    'LT': 'Lighting Panel',
    'PNL': 'Panel',
  };
  return descriptions[tag.toUpperCase()] || `${tag} Panel`;
}

function getFADeviceType(tag: string): string {
  const types: Record<string, string> = {
    'SD': 'Smoke Detector',
    'HS': 'Horn/Strobe',
    'PS': 'Pull Station',
    'PD': 'Photoelectric Detector',
    'DUCT': 'Duct Detector',
    'WF': 'Water Flow',
  };
  return types[tag.toUpperCase()] || 'Device';
}

function getFADeviceDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'SD': 'Smoke Detector',
    'HS': 'Horn/Strobe (Notification)',
    'PS': 'Manual Pull Station',
    'PD': 'Photoelectric Smoke Detector',
    'DUCT': 'Duct Smoke Detector',
    'WF': 'Water Flow Switch',
  };
  return descriptions[tag.toUpperCase()] || tag;
}

function extractSizeFromLine(line: string): string {
  // Try to extract size/rating from line
  // CFM for HVAC
  const cfmMatch = line.match(/\b(\d+,?\d*)\s*CFM\b/i);
  if (cfmMatch) return `${cfmMatch[1]} CFM`;

  // GPM for plumbing
  const gpmMatch = line.match(/\b(\d+\.?\d*)\s*GPM\b/i);
  if (gpmMatch) return `${gpmMatch[1]} GPM`;

  // Amperage for electrical
  const ampMatch = line.match(/\b(\d+)\s*A(MP)?\b/i);
  if (ampMatch) return `${ampMatch[1]}A`;

  // Voltage
  const voltMatch = line.match(/\b(\d+)\s*V(OLT)?\b/i);
  if (voltMatch) return `${voltMatch[1]}V`;

  // HP
  const hpMatch = line.match(/\b(\d+\.?\d*)\s*HP\b/i);
  if (hpMatch) return `${hpMatch[1]} HP`;

  return 'See Schedule';
}
