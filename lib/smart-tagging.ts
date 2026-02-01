// Smart document tagging system

export interface DocumentTag {
  id: string;
  name: string;
  category: 'document-type' | 'trade' | 'phase' | 'priority' | 'status' | 'custom';
  color: string;
  confidence?: number; // For AI-suggested tags
}

export interface TaggingResult {
  suggestedTags: DocumentTag[];
  extractedInfo: {
    documentType?: string;
    trade?: string;
    phase?: string;
    date?: string;
    referenceNumber?: string;
  };
}

// Document type patterns
const DOCUMENT_PATTERNS: Record<string, { keywords: string[]; tag: string; color: string }> = {
  'rfi': {
    keywords: ['rfi', 'request for information', 'information request'],
    tag: 'RFI',
    color: 'bg-blue-500'
  },
  'submittal': {
    keywords: ['submittal', 'submission', 'shop drawing'],
    tag: 'Submittal',
    color: 'bg-purple-500'
  },
  'change-order': {
    keywords: ['change order', 'co #', 'modification', 'amendment'],
    tag: 'Change Order',
    color: 'bg-orange-500'
  },
  'daily-report': {
    keywords: ['daily report', 'daily log', 'field report'],
    tag: 'Daily Report',
    color: 'bg-green-500'
  },
  'schedule': {
    keywords: ['schedule', 'gantt', 'timeline', 'lookahead', 'critical path'],
    tag: 'Schedule',
    color: 'bg-cyan-500'
  },
  'specification': {
    keywords: ['specification', 'spec', 'technical requirements'],
    tag: 'Specification',
    color: 'bg-indigo-500'
  },
  'drawing': {
    keywords: ['drawing', 'plan', 'blueprint', 'floor plan', 'elevation'],
    tag: 'Drawing',
    color: 'bg-teal-500'
  },
  'contract': {
    keywords: ['contract', 'agreement', 'subcontract', 'lump sum'],
    tag: 'Contract',
    color: 'bg-red-500'
  },
  'invoice': {
    keywords: ['invoice', 'pay application', 'payment', 'billing'],
    tag: 'Invoice',
    color: 'bg-emerald-500'
  },
  'safety': {
    keywords: ['safety', 'osha', 'hazard', 'incident', 'jha', 'toolbox'],
    tag: 'Safety',
    color: 'bg-yellow-500'
  },
  'permit': {
    keywords: ['permit', 'license', 'approval', 'certificate'],
    tag: 'Permit',
    color: 'bg-pink-500'
  },
  'meeting-minutes': {
    keywords: ['meeting minutes', 'meeting notes', 'oci meeting', 'progress meeting'],
    tag: 'Meeting Minutes',
    color: 'bg-violet-500'
  },
  'punch-list': {
    keywords: ['punch list', 'punchlist', 'deficiency', 'snag list'],
    tag: 'Punch List',
    color: 'bg-amber-500'
  },
  'insurance': {
    keywords: ['insurance', 'coi', 'certificate of insurance', 'liability'],
    tag: 'Insurance',
    color: 'bg-lime-500'
  },
  'geotechnical': {
    keywords: ['geotech', 'soil', 'boring', 'foundation'],
    tag: 'Geotechnical',
    color: 'bg-stone-500'
  }
};

// Trade patterns
const TRADE_PATTERNS: Record<string, { keywords: string[]; tag: string; color: string }> = {
  'electrical': {
    keywords: ['electrical', 'electric', 'wiring', 'conduit', 'panel', 'transformer'],
    tag: 'Electrical',
    color: 'bg-yellow-600'
  },
  'plumbing': {
    keywords: ['plumbing', 'piping', 'sanitary', 'water supply', 'drain'],
    tag: 'Plumbing',
    color: 'bg-blue-600'
  },
  'hvac': {
    keywords: ['hvac', 'mechanical', 'ductwork', 'air handling', 'ventilation', 'heating', 'cooling'],
    tag: 'HVAC',
    color: 'bg-cyan-600'
  },
  'structural': {
    keywords: ['structural', 'steel', 'concrete', 'rebar', 'foundation', 'framing'],
    tag: 'Structural',
    color: 'bg-gray-600'
  },
  'fire-protection': {
    keywords: ['fire protection', 'sprinkler', 'fire alarm', 'suppression'],
    tag: 'Fire Protection',
    color: 'bg-red-600'
  },
  'drywall': {
    keywords: ['drywall', 'gypsum', 'partition', 'framing'],
    tag: 'Drywall',
    color: 'bg-neutral-500'
  },
  'roofing': {
    keywords: ['roof', 'roofing', 'membrane', 'flashing'],
    tag: 'Roofing',
    color: 'bg-amber-700'
  },
  'flooring': {
    keywords: ['flooring', 'tile', 'carpet', 'vct', 'epoxy'],
    tag: 'Flooring',
    color: 'bg-orange-700'
  },
  'sitework': {
    keywords: ['sitework', 'grading', 'excavation', 'paving', 'asphalt'],
    tag: 'Sitework',
    color: 'bg-lime-700'
  },
  'glazing': {
    keywords: ['glazing', 'glass', 'window', 'curtain wall', 'storefront'],
    tag: 'Glazing',
    color: 'bg-sky-600'
  }
};

// Phase patterns
const PHASE_PATTERNS: Record<string, { keywords: string[]; tag: string; color: string }> = {
  'preconstruction': {
    keywords: ['preconstruction', 'pre-construction', 'design', 'estimating'],
    tag: 'Preconstruction',
    color: 'bg-purple-600'
  },
  'mobilization': {
    keywords: ['mobilization', 'site setup', 'trailer'],
    tag: 'Mobilization',
    color: 'bg-indigo-600'
  },
  'foundation': {
    keywords: ['foundation', 'footing', 'slab', 'excavation'],
    tag: 'Foundation',
    color: 'bg-stone-600'
  },
  'structure': {
    keywords: ['structure', 'framing', 'steel erection', 'concrete pour'],
    tag: 'Structure',
    color: 'bg-slate-600'
  },
  'rough-in': {
    keywords: ['rough-in', 'rough in', 'underground', 'overhead'],
    tag: 'Rough-In',
    color: 'bg-orange-600'
  },
  'finishes': {
    keywords: ['finish', 'paint', 'trim', 'final'],
    tag: 'Finishes',
    color: 'bg-pink-600'
  },
  'closeout': {
    keywords: ['closeout', 'close-out', 'turnover', 'commissioning', 'punch'],
    tag: 'Closeout',
    color: 'bg-green-600'
  }
};

export function analyzeDocument(filename: string, content?: string): TaggingResult {
  // Normalize by converting to lowercase and replacing hyphens/underscores with spaces
  const normalizedFilename = filename.toLowerCase().replace(/[-_]/g, ' ');
  const normalizedContent = (content || '').toLowerCase().replace(/[-_]/g, ' ');
  const combinedText = `${normalizedFilename} ${normalizedContent}`;
  
  const suggestedTags: DocumentTag[] = [];
  const extractedInfo: TaggingResult['extractedInfo'] = {};
  
  // Helper function to normalize keywords for matching
  const normalizeKeyword = (kw: string) => kw.toLowerCase().replace(/[-_]/g, ' ');

  // Detect document type
  for (const [id, pattern] of Object.entries(DOCUMENT_PATTERNS)) {
    const matchCount = pattern.keywords.filter(kw => combinedText.includes(normalizeKeyword(kw))).length;
    if (matchCount > 0) {
      const confidence = Math.min(matchCount / pattern.keywords.length * 1.5, 1);
      if (confidence >= 0.3) {
        suggestedTags.push({
          id: `doctype-${id}`,
          name: pattern.tag,
          category: 'document-type',
          color: pattern.color,
          confidence
        });
        if (!extractedInfo.documentType || confidence > 0.7) {
          extractedInfo.documentType = pattern.tag;
        }
      }
    }
  }

  // Detect trade
  for (const [id, pattern] of Object.entries(TRADE_PATTERNS)) {
    const matchCount = pattern.keywords.filter(kw => combinedText.includes(normalizeKeyword(kw))).length;
    if (matchCount > 0) {
      const confidence = Math.min(matchCount / pattern.keywords.length * 1.5, 1);
      if (confidence >= 0.3) {
        suggestedTags.push({
          id: `trade-${id}`,
          name: pattern.tag,
          category: 'trade',
          color: pattern.color,
          confidence
        });
        if (!extractedInfo.trade || confidence > 0.7) {
          extractedInfo.trade = pattern.tag;
        }
      }
    }
  }

  // Detect phase
  for (const [id, pattern] of Object.entries(PHASE_PATTERNS)) {
    const matchCount = pattern.keywords.filter(kw => combinedText.includes(normalizeKeyword(kw))).length;
    if (matchCount > 0) {
      const confidence = Math.min(matchCount / pattern.keywords.length * 1.5, 1);
      if (confidence >= 0.3) {
        suggestedTags.push({
          id: `phase-${id}`,
          name: pattern.tag,
          category: 'phase',
          color: pattern.color,
          confidence
        });
        if (!extractedInfo.phase || confidence > 0.7) {
          extractedInfo.phase = pattern.tag;
        }
      }
    }
  }
  
  // Extract date from filename
  const dateMatch = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})|(\d{2}[-_]\d{2}[-_]\d{4})|(\d{8})/);
  if (dateMatch) {
    extractedInfo.date = dateMatch[0].replace(/_/g, '-');
  }
  
  // Extract reference numbers
  const refMatch = filename.match(/(RFI|CO|ASI|PR|SI)[-_#]?(\d+)/i);
  if (refMatch) {
    extractedInfo.referenceNumber = refMatch[0].toUpperCase();
  }
  
  // Sort by confidence
  suggestedTags.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  
  // Return top 5 most confident tags
  return {
    suggestedTags: suggestedTags.slice(0, 5),
    extractedInfo
  };
}

export function getTagStyles(category: DocumentTag['category']): string {
  switch (category) {
    case 'document-type': return 'border-l-4 border-l-blue-500';
    case 'trade': return 'border-l-4 border-l-orange-500';
    case 'phase': return 'border-l-4 border-l-purple-500';
    case 'priority': return 'border-l-4 border-l-red-500';
    case 'status': return 'border-l-4 border-l-green-500';
    default: return 'border-l-4 border-l-gray-500';
  }
}

export const PRIORITY_TAGS: DocumentTag[] = [
  { id: 'priority-urgent', name: 'Urgent', category: 'priority', color: 'bg-red-500' },
  { id: 'priority-high', name: 'High Priority', category: 'priority', color: 'bg-orange-500' },
  { id: 'priority-normal', name: 'Normal', category: 'priority', color: 'bg-blue-500' },
  { id: 'priority-low', name: 'Low Priority', category: 'priority', color: 'bg-gray-500' }
];

export const STATUS_TAGS: DocumentTag[] = [
  { id: 'status-draft', name: 'Draft', category: 'status', color: 'bg-gray-500' },
  { id: 'status-pending', name: 'Pending Review', category: 'status', color: 'bg-yellow-500' },
  { id: 'status-approved', name: 'Approved', category: 'status', color: 'bg-green-500' },
  { id: 'status-rejected', name: 'Rejected', category: 'status', color: 'bg-red-500' },
  { id: 'status-revised', name: 'Revised', category: 'status', color: 'bg-purple-500' }
];
