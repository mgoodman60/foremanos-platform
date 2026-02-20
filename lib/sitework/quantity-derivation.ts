/**
 * Quantity calculation/derivation engine for sitework takeoffs
 */

export interface DerivedQuantity {
  itemKey: string;
  quantity: number;
  unit: string;
  calculationMethod: string;
  sourceData: Record<string, number>;
}

export function calculateCutFill(
  existingGrade: number, proposedGrade: number, area: number, areaUnit: string = 'SF'
): DerivedQuantity {
  let areaSF = area;
  if (areaUnit === 'SY') areaSF = area * 9;
  if (areaUnit === 'AC') areaSF = area * 43560;
  const gradeDiff = proposedGrade - existingGrade;
  const volumeCF = areaSF * Math.abs(gradeDiff);
  const volumeCY = volumeCF / 27;
  return {
    itemKey: gradeDiff > 0 ? 'import-fill' : 'excavation-bulk',
    quantity: Math.round(volumeCY * 10) / 10, unit: 'CY',
    calculationMethod: 'area_x_depth',
    sourceData: { existingGrade, proposedGrade, areaSF, gradeDiff: Math.abs(gradeDiff) }
  };
}

export function calculateTrenchVolume(lengthLF: number, widthFT: number, depthFT: number): DerivedQuantity {
  const volumeCF = lengthLF * widthFT * depthFT;
  const volumeCY = volumeCF / 27;
  return {
    itemKey: 'excavation-trench', quantity: Math.round(volumeCY * 10) / 10, unit: 'CY',
    calculationMethod: 'length_x_width_x_depth',
    sourceData: { lengthLF, widthFT, depthFT }
  };
}

export function calculateAsphaltTonnage(areaSF: number, thicknessInches: number): DerivedQuantity {
  const volumeCF = (areaSF * thicknessInches) / 12;
  const tonnage = (volumeCF * 145) / 2000;
  return {
    itemKey: `asphalt-paving-${thicknessInches}in`, quantity: Math.round(tonnage * 10) / 10, unit: 'TON',
    calculationMethod: 'area_x_thickness_x_density',
    sourceData: { areaSF, thicknessInches, densityLbsPerCF: 145 }
  };
}

export function calculateAggregateVolume(areaSF: number, thicknessInches: number): DerivedQuantity {
  const volumeCF = (areaSF * thicknessInches) / 12;
  const volumeCY = volumeCF / 27;
  return {
    itemKey: `aggregate-base-${thicknessInches}in`, quantity: Math.round(volumeCY * 10) / 10, unit: 'CY',
    calculationMethod: 'area_x_thickness',
    sourceData: { areaSF, thicknessInches }
  };
}

export function calculatePipeBedding(
  pipeLengthLF: number, pipeDiameterInches: number, trenchWidthFT: number = 2, _trenchDepthFT: number = 4
): DerivedQuantity {
  const beddingDepthFT = (pipeDiameterInches / 2 + 6) / 12;
  const beddingVolumeCF = pipeLengthLF * trenchWidthFT * beddingDepthFT;
  const beddingCY = beddingVolumeCF / 27;
  return {
    itemKey: 'backfill-pipe-zone', quantity: Math.round(beddingCY * 10) / 10, unit: 'CY',
    calculationMethod: 'pipe_bedding_zone',
    sourceData: { pipeLengthLF, pipeDiameterInches, trenchWidthFT, beddingDepthFT }
  };
}
