import type { QueryClassification } from '@/types/chat';

/**
 * Classifies a query to determine its type and appropriate retrieval limit.
 *
 * @param message - User's message text (can be null for image-only queries).
 * @returns Classification result with query type and retrieval limit.
 *
 * @example
 * const classification = classifyQuery("How many windows are in the building?");
 * // Returns: { type: 'counting', retrievalLimit: 18, isCounting: true, ... }
 */
export function classifyQuery(message: string | null): QueryClassification {
  if (!message) {
    return {
      type: 'general',
      retrievalLimit: 12,
      isCounting: false,
      isMeasurement: false,
      isCalculation: false,
    };
  }

  const isCountingQuery = /\b(how many|count|total|number of|quantity of)\b/i.test(message);
  const isMeasurementQuery = /\b(what is|how|depth|height|width|size|dimension|measurement|thick|clearance)\b/i.test(message);
  const isCalculationQuery = /\b(calculate|cubic|yards|volume|area|square feet|linear feet|how much|excavation|removed|concrete|material)\b/i.test(message);

  // Determine retrieval limit based on query type.
  let retrievalLimit: number;
  let type: QueryClassification['type'];

  if (isCalculationQuery) {
    retrievalLimit = 20;
    type = 'calculation';
  } else if (isCountingQuery) {
    retrievalLimit = 18;
    type = 'counting';
  } else if (isMeasurementQuery) {
    retrievalLimit = 15;
    type = 'measurement';
  } else {
    retrievalLimit = 12;
    type = 'general';
  }

  return {
    type,
    retrievalLimit,
    isCounting: isCountingQuery,
    isMeasurement: isMeasurementQuery,
    isCalculation: isCalculationQuery,
  };
}
