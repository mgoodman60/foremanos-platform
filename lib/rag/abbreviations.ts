/**
 * Construction Abbreviation Dictionary and Expansion
 *
 * Extracted from lib/rag-enhancements.ts — abbreviation constant,
 * project-specific dictionary builder, and expansion function.
 */

import { prisma } from '@/lib/db';
import type { AbbreviationDictionary } from './types';

/**
 * Comprehensive construction abbreviation dictionary
 */
export const CONSTRUCTION_ABBREVIATIONS: AbbreviationDictionary = {
  // General Construction
  'typ': { expansion: 'typical', category: 'general' },
  'sim': { expansion: 'similar', category: 'general' },
  'ea': { expansion: 'each', category: 'general' },
  'nts': { expansion: 'not to scale', category: 'general' },
  'sht': { expansion: 'sheet', category: 'general' },
  'dwg': { expansion: 'drawing', category: 'general' },
  'det': { expansion: 'detail', category: 'general' },
  'elev': { expansion: 'elevation', category: 'general' },
  'sect': { expansion: 'section', category: 'general' },
  'pln': { expansion: 'plan', category: 'general' },

  // Architectural
  'clg': { expansion: 'ceiling', category: 'architectural' },
  'flr': { expansion: 'floor', category: 'architectural' },
  'rm': { expansion: 'room', category: 'architectural' },
  'cor': { expansion: 'corridor', category: 'architectural' },
  'occ': { expansion: 'occupancy', category: 'architectural' },
  'aff': { expansion: 'above finished floor', category: 'architectural' },
  'ffl': { expansion: 'finished floor level', category: 'architectural' },
  'ffh': { expansion: 'finished floor height', category: 'architectural' },
  'thk': { expansion: 'thick', category: 'architectural' },
  'wd': { expansion: 'wood', category: 'architectural' },
  'gyp': { expansion: 'gypsum', category: 'architectural' },
  'gwd': { expansion: 'gypsum wallboard', category: 'architectural' },
  'cmul': { expansion: 'concrete masonry unit', category: 'architectural' },

  // HVAC
  'ahu': { expansion: 'air handling unit', category: 'hvac' },
  'rtu': { expansion: 'rooftop unit', category: 'hvac' },
  'vav': { expansion: 'variable air volume', category: 'hvac' },
  'fcu': { expansion: 'fan coil unit', category: 'hvac' },
  'mau': { expansion: 'makeup air unit', category: 'hvac' },
  'erv': { expansion: 'energy recovery ventilator', category: 'hvac' },
  'hrv': { expansion: 'heat recovery ventilator', category: 'hvac' },
  'doas': { expansion: 'dedicated outdoor air system', category: 'hvac' },
  'cuh': { expansion: 'cabinet unit heater', category: 'hvac' },
  'ef': { expansion: 'exhaust fan', category: 'hvac' },
  'sf': { expansion: 'supply fan', category: 'hvac' },
  'rf': { expansion: 'return fan', category: 'hvac' },
  'cfm': { expansion: 'cubic feet per minute', category: 'hvac' },
  'fpm': { expansion: 'feet per minute', category: 'hvac' },
  'mbh': { expansion: 'thousand BTU per hour', category: 'hvac' },

  // Plumbing
  'wh': { expansion: 'water heater', category: 'plumbing' },
  'hwh': { expansion: 'hot water heater', category: 'plumbing' },
  'dhw': { expansion: 'domestic hot water', category: 'plumbing' },
  'cw': { expansion: 'cold water', category: 'plumbing' },
  'hw': { expansion: 'hot water', category: 'plumbing' },
  'hwr': { expansion: 'hot water return', category: 'plumbing' },
  'co': { expansion: 'cleanout', category: 'plumbing' },
  'fco': { expansion: 'floor cleanout', category: 'plumbing' },
  'wco': { expansion: 'wall cleanout', category: 'plumbing' },
  'fd': { expansion: 'floor drain', category: 'plumbing' },
  'ro': { expansion: 'roof drain', category: 'plumbing' },
  'lav': { expansion: 'lavatory', category: 'plumbing' },
  'wc': { expansion: 'water closet', category: 'plumbing' },
  'ur': { expansion: 'urinal', category: 'plumbing' },
  'df': { expansion: 'drinking fountain', category: 'plumbing' },
  'gpm': { expansion: 'gallons per minute', category: 'plumbing' },
  'psi': { expansion: 'pounds per square inch', category: 'plumbing' },

  // Electrical
  'mcc': { expansion: 'motor control center', category: 'electrical' },
  'xfmr': { expansion: 'transformer', category: 'electrical' },
  'swbd': { expansion: 'switchboard', category: 'electrical' },
  'mlp': { expansion: 'main lighting panel', category: 'electrical' },
  'pdp': { expansion: 'power distribution panel', category: 'electrical' },
  'gfci': { expansion: 'ground fault circuit interrupter', category: 'electrical' },
  'afci': { expansion: 'arc fault circuit interrupter', category: 'electrical' },
  'oc': { expansion: 'on center', category: 'electrical' },
  'kva': { expansion: 'kilovolt-ampere', category: 'electrical' },
  'kw': { expansion: 'kilowatt', category: 'electrical' },
  'hp': { expansion: 'horsepower', category: 'electrical' },
  'emg': { expansion: 'emergency', category: 'electrical' },

  // Structural
  'conc': { expansion: 'concrete', category: 'structural' },
  'reinf': { expansion: 'reinforcing', category: 'structural' },
  'rebar': { expansion: 'reinforcing bar', category: 'structural' },
  'wwf': { expansion: 'welded wire fabric', category: 'structural' },
  'stl': { expansion: 'steel', category: 'structural' },
  'ftg': { expansion: 'footing', category: 'structural' },
  'fdn': { expansion: 'foundation', category: 'structural' },
  'col': { expansion: 'column', category: 'structural' },
  'bm': { expansion: 'beam', category: 'structural' },
  'jst': { expansion: 'joist', category: 'structural' },
  'plt': { expansion: 'plate', category: 'structural' },
};

/**
 * Build project-specific abbreviation dictionary from document context
 */
export async function buildProjectAbbreviationDictionary(
  projectSlug: string
): Promise<AbbreviationDictionary> {
  const customDict: AbbreviationDictionary = { ...CONSTRUCTION_ABBREVIATIONS };

  // Fetch all document chunks for the project
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: {
            take: 100, // Sample first 100 chunks
          },
        },
      },
    },
  });

  if (!project) return customDict;

  // Extract abbreviations from legend sheets and notes
  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const content = chunk.content.toLowerCase();

      // Look for abbreviation definitions (e.g., "AHU - Air Handling Unit")
      const abbrevPatterns = [
        /([A-Z]{2,6})\s*[-\u2013\u2014:]\s*([A-Za-z\s]{5,50})/g,
        /\(([A-Z]{2,6})\)\s*=\s*([A-Za-z\s]{5,50})/g,
        /([A-Z]{2,6})\s*means\s*([A-Za-z\s]{5,50})/gi,
      ];

      for (const pattern of abbrevPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const abbrev = match[1].toLowerCase();
          const expansion = match[2].trim();

          // Only add if not already in dictionary
          if (!customDict[abbrev] && expansion.length > 3) {
            customDict[abbrev] = {
              expansion,
              category: 'general',
              context: `Found in ${doc.fileName}`,
            };
          }
        }
      }
    }
  }

  return customDict;
}

/**
 * Expand abbreviations in text
 */
export function expandAbbreviations(
  text: string,
  dictionary: AbbreviationDictionary = CONSTRUCTION_ABBREVIATIONS,
  includeOriginal: boolean = true
): string {
  const words = text.split(/\b/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (dictionary[word]) {
      const entry = dictionary[word];
      words[i] = includeOriginal
        ? `${words[i]} (${entry.expansion})`
        : entry.expansion;
    }
  }

  return words.join('');
}
