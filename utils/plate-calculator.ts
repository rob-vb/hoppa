/**
 * Plate Calculator Utility
 *
 * Calculates which plates to load on each side of the barbell
 * for a given target weight. Supports both standard gym plates
 * and personal microplates.
 */

// Standard gym plates available (kg, per side)
export const STANDARD_PLATES = [20, 10, 5, 2.5, 1.25] as const;

// Personal microplates (kg, per side)
export const MICROPLATES = [1, 0.75, 0.5, 0.25] as const;

export interface PlateBreakdown {
  /** Weight of each plate (kg) */
  weight: number;
  /** Number of this plate per side */
  count: number;
  /** Whether this is a personal microplate */
  isMicroplate: boolean;
}

export interface PlateResult {
  /** Plates to load per side, from heaviest to lightest */
  platesPerSide: PlateBreakdown[];
  /** Total weight from plates (both sides combined) */
  totalPlateWeight: number;
  /** Whether the target weight is achievable with available plates */
  achievable: boolean;
  /** If not achievable, how much weight is unaccounted for */
  remainder: number;
  /** The actual total weight that can be achieved (base + plates) */
  achievedWeight: number;
}

/**
 * Calculate plates needed per side to reach target weight
 *
 * @param targetWeight - The total weight to achieve (including bar/base weight)
 * @param baseWeight - The weight of the bar or machine base (kg)
 * @param availablePlates - Standard plates available (default: gym standard)
 * @param availableMicroplates - Personal microplates available (default: common microplates)
 * @returns PlateResult with breakdown of plates per side
 *
 * @example
 * // For 59.8kg on a 11.3kg bar:
 * const result = calculatePlates(59.8, 11.3);
 * // Returns:
 * // {
 * //   platesPerSide: [
 * //     { weight: 20, count: 1, isMicroplate: false },
 * //     { weight: 2.5, count: 1, isMicroplate: false },
 * //     { weight: 1.25, count: 1, isMicroplate: false },
 * //     { weight: 0.5, count: 1, isMicroplate: true }
 * //   ],
 * //   totalPlateWeight: 48.5,
 * //   achievable: true,
 * //   remainder: 0,
 * //   achievedWeight: 59.8
 * // }
 */
export function calculatePlates(
  targetWeight: number,
  baseWeight: number,
  availablePlates: readonly number[] = STANDARD_PLATES,
  availableMicroplates: readonly number[] = MICROPLATES
): PlateResult {
  // Weight to distribute across both sides
  const weightToLoad = targetWeight - baseWeight;

  // Handle edge cases
  if (weightToLoad <= 0) {
    return {
      platesPerSide: [],
      totalPlateWeight: 0,
      achievable: true,
      remainder: 0,
      achievedWeight: baseWeight,
    };
  }

  // Weight needed per side
  const weightPerSide = weightToLoad / 2;

  // Combine all available plates and sort by weight (descending)
  const allPlates = [
    ...availablePlates.map((w) => ({ weight: w, isMicroplate: false })),
    ...availableMicroplates.map((w) => ({ weight: w, isMicroplate: true })),
  ].sort((a, b) => b.weight - a.weight);

  const platesPerSide: PlateBreakdown[] = [];
  let remaining = weightPerSide;

  // Greedy algorithm: use largest plates first
  for (const plate of allPlates) {
    if (remaining < plate.weight - 0.001) continue; // Float tolerance

    const count = Math.floor((remaining + 0.001) / plate.weight);
    if (count > 0) {
      platesPerSide.push({
        weight: plate.weight,
        count,
        isMicroplate: plate.isMicroplate,
      });
      remaining -= count * plate.weight;
    }
  }

  // Round remaining to handle floating point errors
  remaining = Math.round(remaining * 1000) / 1000;

  const totalPlateWeight = (weightPerSide - remaining) * 2;
  const achievedWeight = baseWeight + totalPlateWeight;

  return {
    platesPerSide,
    totalPlateWeight: Math.round(totalPlateWeight * 100) / 100,
    achievable: remaining < 0.01,
    remainder: Math.round(remaining * 100) / 100,
    achievedWeight: Math.round(achievedWeight * 100) / 100,
  };
}

/**
 * Calculate plates without microplates (standard gym plates only)
 */
export function calculatePlatesStandard(
  targetWeight: number,
  baseWeight: number,
  availablePlates: readonly number[] = STANDARD_PLATES
): PlateResult {
  return calculatePlates(targetWeight, baseWeight, availablePlates, []);
}

/**
 * Format plate breakdown as a human-readable string
 *
 * @param platesPerSide - Array of plate breakdowns
 * @returns Formatted string like "20 + 2.5 + 1.25"
 */
export function formatPlateList(platesPerSide: PlateBreakdown[]): string {
  if (platesPerSide.length === 0) return 'No plates';

  const parts: string[] = [];
  for (const plate of platesPerSide) {
    for (let i = 0; i < plate.count; i++) {
      parts.push(formatWeight(plate.weight));
    }
  }
  return parts.join(' + ');
}

/**
 * Format weight value, removing unnecessary decimals
 */
export function formatWeight(weight: number): string {
  if (Number.isInteger(weight)) {
    return weight.toString();
  }
  return weight.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Get total microplate weight per side
 */
export function getMicroplateWeight(platesPerSide: PlateBreakdown[]): number {
  return platesPerSide
    .filter((p) => p.isMicroplate)
    .reduce((sum, p) => sum + p.weight * p.count, 0);
}

/**
 * Get total standard plate weight per side
 */
export function getStandardPlateWeight(platesPerSide: PlateBreakdown[]): number {
  return platesPerSide
    .filter((p) => !p.isMicroplate)
    .reduce((sum, p) => sum + p.weight * p.count, 0);
}

/**
 * Check if microplates are needed for the given weight
 */
export function needsMicroplates(
  targetWeight: number,
  baseWeight: number,
  availablePlates: readonly number[] = STANDARD_PLATES
): boolean {
  const standardOnly = calculatePlatesStandard(targetWeight, baseWeight, availablePlates);
  return !standardOnly.achievable;
}

/**
 * Get the closest achievable weight with standard plates only
 */
export function getClosestStandardWeight(
  targetWeight: number,
  baseWeight: number,
  availablePlates: readonly number[] = STANDARD_PLATES
): { lower: number; upper: number } {
  const smallestPlate = Math.min(...availablePlates);
  const increment = smallestPlate * 2; // Both sides

  const weightToLoad = targetWeight - baseWeight;
  const lowerPlateWeight = Math.floor(weightToLoad / increment) * increment;
  const upperPlateWeight = Math.ceil(weightToLoad / increment) * increment;

  return {
    lower: baseWeight + lowerPlateWeight,
    upper: baseWeight + upperPlateWeight,
  };
}
