import {
  calculatePlates,
  calculatePlatesStandard,
  formatPlateList,
  formatWeight,
  getMicroplateWeight,
  getStandardPlateWeight,
  needsMicroplates,
  getClosestStandardWeight,
  STANDARD_PLATES,
  MICROPLATES,
  PlateBreakdown,
} from '@/utils/plate-calculator';

describe('plate-calculator', () => {
  describe('calculatePlates', () => {
    describe('basic functionality', () => {
      it('should return empty plates when target equals base weight', () => {
        const result = calculatePlates(20, 20);
        expect(result.platesPerSide).toEqual([]);
        expect(result.totalPlateWeight).toBe(0);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(20);
      });

      it('should return empty plates when target is less than base weight', () => {
        const result = calculatePlates(15, 20);
        expect(result.platesPerSide).toEqual([]);
        expect(result.totalPlateWeight).toBe(0);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(20);
      });

      it('should calculate plates for a simple weight', () => {
        // 60kg target with 20kg bar = 40kg to load = 20kg per side
        const result = calculatePlates(60, 20);
        expect(result.platesPerSide).toEqual([
          { weight: 20, count: 1, isMicroplate: false },
        ]);
        expect(result.totalPlateWeight).toBe(40);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(60);
      });

      it('should use multiple plate sizes', () => {
        // 100kg target with 20kg bar = 80kg to load = 40kg per side
        const result = calculatePlates(100, 20);
        expect(result.platesPerSide).toEqual([
          { weight: 20, count: 2, isMicroplate: false },
        ]);
        expect(result.totalPlateWeight).toBe(80);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(100);
      });

      it('should calculate a complex plate combination', () => {
        // 72.5kg target with 20kg bar = 52.5kg to load = 26.25kg per side
        const result = calculatePlates(72.5, 20);
        expect(result.platesPerSide).toEqual([
          { weight: 20, count: 1, isMicroplate: false },
          { weight: 5, count: 1, isMicroplate: false },
          { weight: 1.25, count: 1, isMicroplate: false },
        ]);
        expect(result.totalPlateWeight).toBe(52.5);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(72.5);
      });
    });

    describe('microplates', () => {
      it('should use microplates when needed', () => {
        // 59.8kg target with 11.3kg bar = 48.5kg to load = 24.25kg per side
        // 20 + 2.5 + 1.25 + 0.5 = 24.25
        const result = calculatePlates(59.8, 11.3);
        expect(result.platesPerSide).toContainEqual(
          expect.objectContaining({ weight: 0.5, isMicroplate: true })
        );
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(59.8);
      });

      it('should correctly identify microplates vs standard plates', () => {
        const result = calculatePlates(59.8, 11.3);
        const microplates = result.platesPerSide.filter((p) => p.isMicroplate);
        const standardPlates = result.platesPerSide.filter((p) => !p.isMicroplate);

        microplates.forEach((p) => {
          expect(MICROPLATES).toContain(p.weight);
        });
        standardPlates.forEach((p) => {
          expect(STANDARD_PLATES).toContain(p.weight);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle negative target weight', () => {
        const result = calculatePlates(-10, 20);
        expect(result.platesPerSide).toEqual([]);
        expect(result.achievable).toBe(false);
        expect(result.achievedWeight).toBe(20);
      });

      it('should handle negative base weight', () => {
        const result = calculatePlates(60, -10);
        expect(result.achievable).toBe(false);
        expect(result.achievedWeight).toBe(0);
      });

      it('should handle zero target weight', () => {
        const result = calculatePlates(0, 20);
        expect(result.platesPerSide).toEqual([]);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(20);
      });

      it('should handle zero base weight', () => {
        const result = calculatePlates(40, 0);
        expect(result.platesPerSide).toEqual([
          { weight: 20, count: 1, isMicroplate: false },
        ]);
        expect(result.totalPlateWeight).toBe(40);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(40);
      });

      it('should handle impossible weights with remainder', () => {
        // Weight that can't be achieved with available plates
        const result = calculatePlates(60.13, 20, STANDARD_PLATES, MICROPLATES);
        expect(result.achievable).toBe(false);
        expect(result.remainder).toBeGreaterThan(0);
      });

      it('should handle floating point precision', () => {
        // Test a weight that might have floating point issues
        const result = calculatePlates(60.5, 20);
        expect(result.achievable).toBe(true);
        expect(Math.abs(result.achievedWeight - 60.5)).toBeLessThan(0.01);
      });

      it('should handle very large weights', () => {
        const result = calculatePlates(500, 20);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(500);
        // 480kg to load = 240kg per side = 12 x 20kg
        expect(result.platesPerSide).toContainEqual(
          expect.objectContaining({ weight: 20, count: 12 })
        );
      });
    });

    describe('custom plate sets', () => {
      it('should work with custom standard plates', () => {
        const customPlates = [25, 15, 10, 5] as const;
        const result = calculatePlates(90, 20, customPlates, []);
        expect(result.achievable).toBe(true);
        expect(result.achievedWeight).toBe(90);
      });

      it('should work with custom microplates', () => {
        const customMicroplates = [0.5, 0.25, 0.125] as const;
        const result = calculatePlates(60.25, 20, STANDARD_PLATES, customMicroplates);
        expect(result.achievable).toBe(true);
      });

      it('should work with empty plate sets', () => {
        const result = calculatePlates(60, 20, [], []);
        expect(result.platesPerSide).toEqual([]);
        expect(result.achievable).toBe(false);
        expect(result.remainder).toBe(20); // 40kg to load / 2 = 20kg per side
      });
    });
  });

  describe('calculatePlatesStandard', () => {
    it('should calculate plates without microplates', () => {
      const result = calculatePlatesStandard(60, 20);
      expect(result.platesPerSide.every((p) => !p.isMicroplate)).toBe(true);
    });

    it('should not achieve weight that requires microplates', () => {
      const result = calculatePlatesStandard(59.8, 11.3);
      expect(result.achievable).toBe(false);
    });

    it('should achieve weight that only needs standard plates', () => {
      const result = calculatePlatesStandard(72.5, 20);
      expect(result.achievable).toBe(true);
      expect(result.achievedWeight).toBe(72.5);
    });
  });

  describe('formatPlateList', () => {
    it('should return "No plates" for empty array', () => {
      expect(formatPlateList([])).toBe('No plates');
    });

    it('should format a single plate', () => {
      const plates: PlateBreakdown[] = [
        { weight: 20, count: 1, isMicroplate: false },
      ];
      expect(formatPlateList(plates)).toBe('20');
    });

    it('should format multiple different plates', () => {
      const plates: PlateBreakdown[] = [
        { weight: 20, count: 1, isMicroplate: false },
        { weight: 10, count: 1, isMicroplate: false },
        { weight: 5, count: 1, isMicroplate: false },
      ];
      expect(formatPlateList(plates)).toBe('20 + 10 + 5');
    });

    it('should expand plates with count > 1', () => {
      const plates: PlateBreakdown[] = [
        { weight: 20, count: 2, isMicroplate: false },
        { weight: 5, count: 1, isMicroplate: false },
      ];
      expect(formatPlateList(plates)).toBe('20 + 20 + 5');
    });

    it('should format decimal weights correctly', () => {
      const plates: PlateBreakdown[] = [
        { weight: 2.5, count: 1, isMicroplate: false },
        { weight: 1.25, count: 1, isMicroplate: false },
        { weight: 0.5, count: 1, isMicroplate: true },
      ];
      expect(formatPlateList(plates)).toBe('2.5 + 1.25 + 0.5');
    });
  });

  describe('formatWeight', () => {
    it('should format integer weights without decimals', () => {
      expect(formatWeight(20)).toBe('20');
      expect(formatWeight(5)).toBe('5');
      expect(formatWeight(0)).toBe('0');
    });

    it('should format decimal weights appropriately', () => {
      expect(formatWeight(2.5)).toBe('2.5');
      expect(formatWeight(1.25)).toBe('1.25');
      expect(formatWeight(0.75)).toBe('0.75');
    });

    it('should remove trailing zeros', () => {
      expect(formatWeight(2.50)).toBe('2.5');
      expect(formatWeight(5.00)).toBe('5');
    });
  });

  describe('getMicroplateWeight', () => {
    it('should return 0 for empty array', () => {
      expect(getMicroplateWeight([])).toBe(0);
    });

    it('should return 0 when no microplates', () => {
      const plates: PlateBreakdown[] = [
        { weight: 20, count: 1, isMicroplate: false },
        { weight: 10, count: 2, isMicroplate: false },
      ];
      expect(getMicroplateWeight(plates)).toBe(0);
    });

    it('should sum microplate weights', () => {
      const plates: PlateBreakdown[] = [
        { weight: 20, count: 1, isMicroplate: false },
        { weight: 0.5, count: 2, isMicroplate: true },
        { weight: 0.25, count: 1, isMicroplate: true },
      ];
      expect(getMicroplateWeight(plates)).toBe(1.25); // 0.5*2 + 0.25
    });
  });

  describe('getStandardPlateWeight', () => {
    it('should return 0 for empty array', () => {
      expect(getStandardPlateWeight([])).toBe(0);
    });

    it('should return 0 when only microplates', () => {
      const plates: PlateBreakdown[] = [
        { weight: 0.5, count: 2, isMicroplate: true },
        { weight: 0.25, count: 1, isMicroplate: true },
      ];
      expect(getStandardPlateWeight(plates)).toBe(0);
    });

    it('should sum standard plate weights', () => {
      const plates: PlateBreakdown[] = [
        { weight: 20, count: 1, isMicroplate: false },
        { weight: 10, count: 2, isMicroplate: false },
        { weight: 0.5, count: 1, isMicroplate: true },
      ];
      expect(getStandardPlateWeight(plates)).toBe(40); // 20 + 10*2
    });
  });

  describe('needsMicroplates', () => {
    it('should return false when standard plates are sufficient', () => {
      expect(needsMicroplates(60, 20)).toBe(false);
      expect(needsMicroplates(72.5, 20)).toBe(false); // 52.5kg / 2 = 26.25kg = 20+5+1.25
    });

    it('should return true when microplates are needed', () => {
      // 59.8kg with 11.3kg bar needs 0.5kg microplates
      expect(needsMicroplates(59.8, 11.3)).toBe(true);
    });

    it('should work with custom plate sets', () => {
      const limitedPlates = [20, 10, 5] as const;
      expect(needsMicroplates(72.5, 20, limitedPlates)).toBe(true); // Can't make 26.25 with just 20,10,5
    });
  });

  describe('getClosestStandardWeight', () => {
    it('should return exact weight when achievable', () => {
      const result = getClosestStandardWeight(60, 20);
      expect(result.lower).toBe(60);
      expect(result.upper).toBe(60);
    });

    it('should return bounds for non-achievable weight', () => {
      // 61kg with 20kg bar = 41kg to load
      // Smallest plate is 1.25, so increment is 2.5kg
      // Lower: floor(41/2.5)*2.5 = 40, upper: ceil(41/2.5)*2.5 = 42.5
      const result = getClosestStandardWeight(61, 20);
      expect(result.lower).toBe(60); // 20 + 40
      expect(result.upper).toBe(62.5); // 20 + 42.5
    });

    it('should work with custom plates', () => {
      const plates = [20, 10, 5] as const; // Smallest is 5, increment is 10
      const result = getClosestStandardWeight(65, 20, plates);
      expect(result.lower).toBe(60); // 20 + 40
      expect(result.upper).toBe(70); // 20 + 50
    });

    it('should handle weight less than base (returns negative plate weights)', () => {
      // When target < base, weightToLoad is negative
      // 15 - 20 = -5, floor(-5/2.5) = -2, ceil(-5/2.5) = -2
      // lower = 20 + (-5) = 15, upper = 20 + (-5) = 15
      const result = getClosestStandardWeight(15, 20);
      expect(result.lower).toBe(15);
      expect(result.upper).toBe(15);
    });
  });
});
