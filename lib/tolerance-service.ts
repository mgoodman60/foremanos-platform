import { prisma } from '@/lib/db';

export interface ToleranceSettings {
  shortagePercent: number;
  shortageAbsolute: number;
  excessPercent: number;
  excessAbsolute: number;
  autoReverifyEnabled: boolean;
  reverifyOnRequirementChange: boolean;
  reverifyOnSubmittalChange: boolean;
  tradeTolerances: Record<string, { shortagePercent?: number; shortageAbsolute?: number; excessPercent?: number; excessAbsolute?: number }>;
}

const DEFAULT_TOLERANCE: ToleranceSettings = {
  shortagePercent: 0,
  shortageAbsolute: 0,
  excessPercent: 100,
  excessAbsolute: 100,
  autoReverifyEnabled: true,
  reverifyOnRequirementChange: true,
  reverifyOnSubmittalChange: true,
  tradeTolerances: {}
};

/**
 * Get tolerance settings for a project
 */
export async function getToleranceSettings(projectId: string): Promise<ToleranceSettings> {
  const settings = await prisma.verificationToleranceSettings.findUnique({
    where: { projectId }
  });

  if (!settings) {
    return DEFAULT_TOLERANCE;
  }

  return {
    shortagePercent: settings.shortagePercent,
    shortageAbsolute: settings.shortageAbsolute,
    excessPercent: settings.excessPercent,
    excessAbsolute: settings.excessAbsolute,
    autoReverifyEnabled: settings.autoReverifyEnabled,
    reverifyOnRequirementChange: settings.reverifyOnRequirementChange,
    reverifyOnSubmittalChange: settings.reverifyOnSubmittalChange,
    tradeTolerances: (settings.tradeTolerances as Record<string, any>) || {}
  };
}

/**
 * Save/update tolerance settings for a project
 */
export async function saveToleranceSettings(
  projectId: string,
  settings: Partial<ToleranceSettings>,
  updatedBy?: string
): Promise<void> {
  await prisma.verificationToleranceSettings.upsert({
    where: { projectId },
    create: {
      projectId,
      shortagePercent: settings.shortagePercent ?? DEFAULT_TOLERANCE.shortagePercent,
      shortageAbsolute: settings.shortageAbsolute ?? DEFAULT_TOLERANCE.shortageAbsolute,
      excessPercent: settings.excessPercent ?? DEFAULT_TOLERANCE.excessPercent,
      excessAbsolute: settings.excessAbsolute ?? DEFAULT_TOLERANCE.excessAbsolute,
      autoReverifyEnabled: settings.autoReverifyEnabled ?? DEFAULT_TOLERANCE.autoReverifyEnabled,
      reverifyOnRequirementChange: settings.reverifyOnRequirementChange ?? DEFAULT_TOLERANCE.reverifyOnRequirementChange,
      reverifyOnSubmittalChange: settings.reverifyOnSubmittalChange ?? DEFAULT_TOLERANCE.reverifyOnSubmittalChange,
      tradeTolerances: settings.tradeTolerances ?? {},
      updatedBy
    },
    update: {
      ...(settings.shortagePercent !== undefined && { shortagePercent: settings.shortagePercent }),
      ...(settings.shortageAbsolute !== undefined && { shortageAbsolute: settings.shortageAbsolute }),
      ...(settings.excessPercent !== undefined && { excessPercent: settings.excessPercent }),
      ...(settings.excessAbsolute !== undefined && { excessAbsolute: settings.excessAbsolute }),
      ...(settings.autoReverifyEnabled !== undefined && { autoReverifyEnabled: settings.autoReverifyEnabled }),
      ...(settings.reverifyOnRequirementChange !== undefined && { reverifyOnRequirementChange: settings.reverifyOnRequirementChange }),
      ...(settings.reverifyOnSubmittalChange !== undefined && { reverifyOnSubmittalChange: settings.reverifyOnSubmittalChange }),
      ...(settings.tradeTolerances !== undefined && { tradeTolerances: settings.tradeTolerances }),
      updatedBy
    }
  });
}

/**
 * Apply tolerance to determine compliance status
 */
export function applyTolerance(
  submitted: number,
  required: number,
  tolerance: ToleranceSettings,
  tradeCategory?: string
): 'SUFFICIENT' | 'INSUFFICIENT' | 'EXCESS' | 'NO_REQUIREMENT' {
  if (required <= 0) {
    return 'NO_REQUIREMENT';
  }

  // Get trade-specific tolerance if available
  const tradeTolerance = tradeCategory ? tolerance.tradeTolerances[tradeCategory] : undefined;
  const shortagePercent = tradeTolerance?.shortagePercent ?? tolerance.shortagePercent;
  const shortageAbsolute = tradeTolerance?.shortageAbsolute ?? tolerance.shortageAbsolute;
  const excessPercent = tradeTolerance?.excessPercent ?? tolerance.excessPercent;
  const excessAbsolute = tradeTolerance?.excessAbsolute ?? tolerance.excessAbsolute;

  const variance = submitted - required;
  const _variancePercent = (variance / required) * 100;

  // Check for shortage
  if (submitted < required) {
    // Within tolerance?
    const percentUnder = ((required - submitted) / required) * 100;
    const unitsUnder = required - submitted;

    if (percentUnder <= shortagePercent || unitsUnder <= shortageAbsolute) {
      return 'SUFFICIENT'; // Within acceptable shortage tolerance
    }
    return 'INSUFFICIENT';
  }

  // Check for excess
  if (submitted > required) {
    const percentOver = ((submitted - required) / required) * 100;
    const unitsOver = submitted - required;

    if (percentOver > excessPercent && unitsOver > excessAbsolute) {
      return 'EXCESS'; // Beyond acceptable excess threshold
    }
  }

  return 'SUFFICIENT';
}

/**
 * Trigger auto-reverification if enabled
 */
export async function triggerAutoReverify(
  projectId: string,
  submittalId: string | null,
  reason: 'requirement_change' | 'submittal_change'
): Promise<{ triggered: boolean; reason?: string }> {
  const settings = await getToleranceSettings(projectId);

  if (!settings.autoReverifyEnabled) {
    return { triggered: false, reason: 'Auto-reverify disabled' };
  }

  if (reason === 'requirement_change' && !settings.reverifyOnRequirementChange) {
    return { triggered: false, reason: 'Reverify on requirement change disabled' };
  }

  if (reason === 'submittal_change' && !settings.reverifyOnSubmittalChange) {
    return { triggered: false, reason: 'Reverify on submittal change disabled' };
  }

  // Import dynamically to avoid circular dependencies
  const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

  if (submittalId) {
    // Single submittal reverification
    await verifySubmittalQuantities(submittalId);
  } else {
    // Bulk reverification for all submittals with line items
    const submittals = await prisma.mEPSubmittal.findMany({
      where: {
        projectId,
        lineItems: { some: {} }
      },
      select: { id: true }
    });

    for (const s of submittals) {
      await verifySubmittalQuantities(s.id);
    }
  }

  return { triggered: true };
}
