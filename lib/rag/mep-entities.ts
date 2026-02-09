/**
 * MEP Entity Registries for trade-specific recognition
 *
 * Extracted from lib/rag-enhancements.ts — pure data constant
 * containing HVAC, plumbing, electrical, and fire alarm equipment registries.
 */

export const MEP_ENTITIES = {
  // HVAC equipment and devices
  hvac: {
    equipment: ['AHU', 'RTU', 'VAV', 'FCU', 'MAU', 'ERV', 'HRV', 'DOAS', 'MAU', 'CUH', 'UH', 'HX'],
    devices: ['EF', 'IF', 'RF', 'SF', 'RA', 'SA', 'EA', 'OA', 'TD', 'RD', 'SD', 'ED', 'GD'],
    patterns: [
      /\b(AHU|RTU|VAV|FCU|MAU|ERV|HRV|DOAS|CUH|UH|HX)-?\d+[A-Z]?\b/gi,
      /\b(EF|IF|RF|SF)-\d+\b/gi,
      /\b(TD|RD|SD|ED|GD)-\d+\b/gi,
    ]
  },

  // Plumbing systems and fixtures
  plumbing: {
    systems: ['CWS', 'HWS', 'HWR', 'SAN', 'VTR', 'ST', 'RWL', 'CW', 'HW', 'DS', 'V', 'G'],
    fixtures: ['WC', 'LAV', 'UR', 'DF', 'FD', 'SH', 'BT', 'HB', 'MOP', 'EWC', 'CO'],
    patterns: [
      /\b(CWS|HWS|HWR|SAN|VTR|ST|RWL)-?\d*\b/gi,
      /\b(WC|LAV|UR|DF|FD|SH|BT|HB|MOP|EWC|CO)-?\d+[A-Z]?\b/gi,
      /\b\d+"?\s*(CWS|HWS|SAN|VTR|ST|G)\b/gi, // pipe sizes
    ]
  },

  // Electrical identifiers
  electrical: {
    panels: ['MDP', 'MSB', 'SB', 'RP', 'LP', 'DP', 'PP', 'EM', 'LT', 'PNL'],
    devices: ['SW', 'REC', 'GFI', 'GFCI', 'WP', 'J-BOX', 'JB', 'TS', 'DS'],
    lighting: ['A', 'B', 'C', 'D', 'E', 'F', 'EXIT', 'EM'], // lighting type tags
    patterns: [
      /\b(MDP|MSB|SB|RP|LP|DP|PP|EM|LT|PNL)-?\d+[A-Z]?\b/gi,
      /\bPanel\s+[A-Z0-9-]+\b/gi,
      /\bCkt\s*#?\d+[A-Z]?\b/gi, // circuit numbers
      /\b\d+\/\d+\b/g, // circuit numbers like 1/3, 2/4
      /\b\d+"?\s*(EMT|RGC|PVC|MC|AC)\b/gi, // conduit sizes
    ]
  },

  // Fire alarm and low voltage
  fireAlarm: {
    devices: ['FACU', 'FACP', 'NAC', 'SLC', 'ANN', 'HS', 'PS', 'SD', 'PD', 'DUCT', 'WF'],
    patterns: [
      /\b(FACU|FACP|NAC|SLC|ANN|HS|PS|SD|PD|DUCT|WF)-?\d+[A-Z]?\b/gi,
      /\b[A-Z]{2,4}-\d{3,4}\b/gi, // device addresses like SD-0101
    ]
  }
};
