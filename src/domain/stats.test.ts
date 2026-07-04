import { describe, expect, it } from 'vitest';
import { linReg } from './stats';

describe('linReg', () => {
  it('recovers slope/intercept for a perfectly linear series', () => {
    // y = 3 + 2*x for x = 0..4
    const { slope, intercept, resStd } = linReg([3, 5, 7, 9, 11]);
    expect(slope).toBeCloseTo(2, 6);
    expect(intercept).toBeCloseTo(3, 6);
    expect(resStd).toBeCloseTo(0, 6);
  });

  it('reports zero slope for a flat series', () => {
    const { slope, intercept } = linReg([10, 10, 10, 10]);
    expect(slope).toBeCloseTo(0, 6);
    expect(intercept).toBeCloseTo(10, 6);
  });
});
