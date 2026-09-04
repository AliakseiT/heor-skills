/**
 * Characterization tests for the six model calculators.
 * Expected values were computed by hand from the ported formulas.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateBudgetImpactModel,
  calculateDecisionTreeModel,
  calculateDiscreteEventSimulationModel,
  calculateMarkovModel,
  calculatePartitionedSurvivalModel,
  calculateStateTransitionModel,
} from '../src/index';

describe('calculateDecisionTreeModel', () => {
  // Digital-therapy device-class defaults (realistic diagnostic scenario).
  const params = {
    costInterventionTest: 50,
    sensitivityInterventionTest: 0.85,
    specificityInterventionTest: 0.9,
    costComparatorTest: 40,
    sensitivityComparatorTest: 0.75,
    specificityComparatorTest: 0.8,
    prevalenceDisease: 0.15,
    costTreatmentCorrectPositive: 2000,
    utilityTreatmentCorrectPositive: 0.8,
    costFalsePositiveManagement: 500,
    utilityFalsePositiveState: 0.6,
    costFalseNegativeConsequence: 5000,
    utilityFalseNegativeState: 0.3,
    costCorrectNegativeManagement: 100,
    utilityCorrectNegativeState: 1.0,
  };

  it('computes arm expectations, incrementals and ICER for a realistic diagnostic case', () => {
    const r = calculateDecisionTreeModel(params);
    expect(r.error).toBeUndefined();
    // Intervention arm: 50 + (0.15*0.85*2000 + 0.85*0.10*500) + (0.15*0.15*5000 + 0.85*0.90*100) = 536.5
    expect(r.interventionArm.expectedCost).toBeCloseTo(536.5, 6);
    // (0.1275*0.8 + 0.085*0.6) + (0.0225*0.3 + 0.765*1.0) = 0.92475
    expect(r.interventionArm.expectedUtility).toBeCloseTo(0.92475, 6);
    // Comparator arm: 40 + (0.1125*2000 + 0.17*500) + (0.0375*5000 + 0.68*100) = 605.5
    expect(r.comparatorArm.expectedCost).toBeCloseTo(605.5, 6);
    // (0.1125*0.8 + 0.17*0.6) + (0.0375*0.3 + 0.68*1.0) = 0.88325
    expect(r.comparatorArm.expectedUtility).toBeCloseTo(0.88325, 6);
    // Incrementals: -69 cost, +0.0415 utility (output rounds to 3 dp; the raw
    // double is 0.04149999999999998, so toFixed(3) yields 0.041)
    expect(r.incrementalCost).toBeCloseTo(-69, 6);
    expect(r.incrementalUtility).toBe(0.041);
    // ICER = -69 / 0.0415 = -1662.65 (cheaper AND more effective — dominant)
    expect(typeof r.icer).toBe('number');
    expect(r.icer as number).toBeCloseTo(-1662.65, 1);
  });

  it('reports invalid/missing numeric inputs', () => {
    const r = calculateDecisionTreeModel({ ...params, prevalenceDisease: undefined as unknown as number });
    expect(r.error).toContain('prevalenceDisease');
    expect(r.icer).toBe('Error');
  });

  it('rejects out-of-range probabilities', () => {
    const r = calculateDecisionTreeModel({ ...params, sensitivityInterventionTest: 1.2 });
    expect(r.error).toBe('Probabilities (prevalence, sensitivity, specificity) must be between 0 and 1.');
  });
});

describe('calculateMarkovModel', () => {
  const params = {
    'Prob Healthy to Healthy': 0.9,
    'Prob Healthy to Disease': 0.08,
    'Prob Healthy to Dead': 0.02,
    'Prob Disease to Healthy': 0.1,
    'Prob Disease to Disease': 0.8,
    'Prob Disease to Dead': 0.1,
    'Cost Healthy State': 100,
    'Cost Disease State': 1000,
    'Cost Dead State': 0,
    'Utility Healthy State': 0.95,
    'Utility Disease State': 0.6,
    'Utility Dead State': 0,
    'Number of Cycles': 2,
    'Annual Discount Rate': 0,
    'Initial Cohort % Healthy': 60,
    'Initial Cohort % Disease': 40,
  };

  it('computes a hand-verifiable 2-cycle cohort trace without discounting', () => {
    const r = calculateMarkovModel(params);
    expect(r.error).toBeUndefined();
    // Cycle 1: cohort (0.6, 0.4, 0): cost = 0.6*100 + 0.4*1000 = 460; QALY = 0.6*0.95 + 0.4*0.6 = 0.81
    // Cycle 2: cohort (0.58, 0.368, 0.052): cost = 58 + 368 = 426; QALY = 0.551 + 0.2208 = 0.7718
    expect(r.totalDiscountedCost).toBe(886);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.5818, 4);
    expect(r.stateTrace).toHaveLength(2);
    expect(r.stateTrace[0]).toEqual({ cycle: 1, healthy: 0.6, disease: 0.4, dead: 0 });
    expect(r.stateTrace[1].cycle).toBe(2);
    expect(r.stateTrace[1].healthy).toBeCloseTo(0.58, 10);
    expect(r.stateTrace[1].disease).toBeCloseTo(0.368, 10);
    expect(r.stateTrace[1].dead).toBeCloseTo(0.052, 10);
  });

  it('applies the per-cycle discount factor 1/(1+r)^cycle', () => {
    const r = calculateMarkovModel({ ...params, 'Annual Discount Rate': 0.03 });
    // 460 + 426/1.03 = 873.59; 0.81 + 0.7718/1.03 = 1.5593
    expect(r.totalDiscountedCost).toBeCloseTo(873.59, 2);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.5593, 4);
  });

  it('rejects transition probabilities that do not sum to 1', () => {
    const r = calculateMarkovModel({ ...params, 'Prob Healthy to Healthy': 0.8 });
    expect(r.error).toBe('Probabilities from Healthy state must sum to 1.');
    expect(Number.isNaN(r.totalDiscountedCost)).toBe(true);
  });

  it('rejects initial cohort percentages summing over 100%', () => {
    const r = calculateMarkovModel({ ...params, 'Initial Cohort % Healthy': 80 });
    expect(r.error).toBe('Initial cohort percentages must be between 0 and 100, and their sum must not exceed 100%.');
  });
});

describe('calculateBudgetImpactModel', () => {
  const params = {
    targetMarket: 'Switzerland',
    targetPopulationSize: 100000,
    marketShareInterventionY1: 5,
    marketShareInterventionY2: 15,
    marketShareInterventionY3: 25,
    marketShareComparatorY1: 95,
    marketShareComparatorY2: 85,
    marketShareComparatorY3: 75,
    annualCostInterventionPerPatient: 120,
    annualCostComparatorPerPatient: 80,
    numberOfYearsAssessment: 3,
  };

  it('computes yearly and total net budget impact (intervention displaces comparator)', () => {
    const r = calculateBudgetImpactModel(params);
    expect(r.error).toBeUndefined();
    // Impact_y = pop * share_int_y * (costInt - costComp) = 100000 * share * 40
    expect(r.netBudgetImpactPerYear).toEqual([
      { year: 1, impact: 200000, interventionPatients: 5000, comparatorPatients: 95000 },
      { year: 2, impact: 600000, interventionPatients: 15000, comparatorPatients: 85000 },
      { year: 3, impact: 1000000, interventionPatients: 25000, comparatorPatients: 75000 },
    ]);
    expect(r.totalNetBudgetImpact).toBe(1800000);
    expect(r.totalEligiblePopulation).toBe(100000);
    expect(r.numYears).toBe(3);
    expect(r.targetMarket).toBe('Switzerland');
  });

  it('reuses year-3 market share for assessment years beyond 3', () => {
    const r = calculateBudgetImpactModel({ ...params, numberOfYearsAssessment: 5 });
    expect(r.netBudgetImpactPerYear).toHaveLength(5);
    expect(r.netBudgetImpactPerYear![3].impact).toBe(1000000); // year 4 = year 3 share
    expect(r.netBudgetImpactPerYear![4].impact).toBe(1000000); // year 5 = year 3 share
    expect(r.totalNetBudgetImpact).toBe(3800000);
  });

  it('normalizes market shares when intervention + comparator exceed 100%', () => {
    const r = calculateBudgetImpactModel({
      ...params,
      marketShareInterventionY1: 60,
      marketShareComparatorY1: 60,
      numberOfYearsAssessment: 1,
    });
    // Shares normalized to 0.5/0.5 → 50000 patients * 40 = 2,000,000
    expect(r.netBudgetImpactPerYear![0].impact).toBe(2000000);
    expect(r.netBudgetImpactPerYear![0].interventionPatients).toBe(50000);
  });

  it('reports missing inputs using display names', () => {
    const r = calculateBudgetImpactModel({ ...params, targetMarket: '' as string, targetPopulationSize: NaN });
    expect(r.error).toContain('Target Market (e.g., Country Name)');
    expect(r.error).toContain('Target Population Size (Total Eligible)');
  });

  it('rejects assessment horizons outside 1-5 years', () => {
    const r = calculateBudgetImpactModel({ ...params, numberOfYearsAssessment: 6 });
    expect(r.error).toBe('Number of years for assessment must be an integer between 1 and 5.');
  });
});

describe('calculateStateTransitionModel', () => {
  it('propagates the state vector with half-cycle correction and accumulates discounted cost/QALYs', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [
        [0.8, 0.2],
        [0.1, 0.9],
      ],
      initialStateDistribution: [0.7, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 2,
      discountRate: 0,
    });
    expect(r.error).toBeUndefined();

    // Cycle 0: start = [0.7, 0.3], next = [0.59, 0.41]
    // Half-cycle avg = [0.645, 0.355]
    // Cost = 0.645*100 + 0.355*200 = 135.5; QALY = 0.645*0.9 + 0.355*0.5 = 0.758
    //
    // Cycle 1: start = [0.59, 0.41], next = [0.513, 0.487]
    // Half-cycle avg = [0.5515, 0.4485]
    // Cost = 55.15 + 89.7 = 144.85; QALY = 0.49635 + 0.22425 = 0.7206
    //
    // Total: cost = 280.35, QALY = 1.4786
    expect(r.totalDiscountedCost).toBe(280.35);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.4786, 4);
    expect(r.stateTrace).toHaveLength(2);
    expect(r.stateTrace[0]).toEqual([0.7, 0.3]);
    expect(r.stateTrace[1][0]).toBeCloseTo(0.59, 10);
    expect(r.stateTrace[1][1]).toBeCloseTo(0.41, 10);
  });

  it('applies per-cycle discount factor 1/(1+r)^cycle', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [
        [0.8, 0.2],
        [0.1, 0.9],
      ],
      initialStateDistribution: [0.7, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 2,
      discountRate: 0.05,
    });
    // Cycle 0: discount 1 → cost 135.5, QALY 0.758
    // Cycle 1: discount 1/1.05 → cost 144.85/1.05 = 137.95, QALY 0.7206/1.05 = 0.6863
    // Total cost = 273.45, QALY = 1.4443
    expect(r.totalDiscountedCost).toBeCloseTo(273.45, 2);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.4443, 4);
  });

  it('rejects mismatched matrix/vector dimensions', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [[1]],
      initialStateDistribution: [0.7, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 2,
      discountRate: 0,
    });
    expect(r.error).toBe('Matrix/vector dimensions do not match number of states.');
  });

  it('rejects transition probabilities out of [0, 1]', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [[1.5, -0.5], [0.1, 0.9]],
      initialStateDistribution: [0.7, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 2,
      discountRate: 0,
    });
    expect(r.error).toContain('must be between 0 and 1');
  });

  it('rejects transition matrix rows that do not sum to 1', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [[0.7, 0.1], [0.1, 0.9]],
      initialStateDistribution: [0.7, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 2,
      discountRate: 0,
    });
    expect(r.error).toContain('Row 0');
    expect(r.error).toContain('must sum to 1');
  });

  it('rejects initial distribution that does not sum to 1', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [[0.8, 0.2], [0.1, 0.9]],
      initialStateDistribution: [0.5, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 2,
      discountRate: 0,
    });
    expect(r.error).toBe('Initial state distribution must sum to 1.');
  });

  it('rejects non-positive numCycles', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [[0.8, 0.2], [0.1, 0.9]],
      initialStateDistribution: [0.7, 0.3],
      stateCosts: [100, 200],
      stateUtilities: [0.9, 0.5],
      numCycles: 0,
      discountRate: 0,
    });
    expect(r.error).toBe('Number of cycles must be a positive integer.');
  });

  it('handles a 3-state model with an absorbing death state', () => {
    const r = calculateStateTransitionModel({
      transitionMatrix: [
        [0.7, 0.2, 0.1],
        [0.0, 0.6, 0.4],
        [0.0, 0.0, 1.0],
      ],
      initialStateDistribution: [1, 0, 0],
      stateCosts: [500, 2000, 0],
      stateUtilities: [0.9, 0.5, 0],
      numCycles: 3,
      discountRate: 0,
    });
    expect(r.error).toBeUndefined();
    expect(r.stateTrace).toHaveLength(3);
    expect(r.stateTrace[0]).toEqual([1, 0, 0]);
    // After cycle 0 transition: [0.7, 0.2, 0.1]
    expect(r.stateTrace[1][0]).toBeCloseTo(0.7, 10);
    expect(r.stateTrace[1][1]).toBeCloseTo(0.2, 10);
    expect(r.stateTrace[1][2]).toBeCloseTo(0.1, 10);
    expect(r.totalDiscountedCost).toBeGreaterThan(0);
    expect(r.totalDiscountedQALYs).toBeGreaterThan(0);
  });
});

describe('calculatePartitionedSurvivalModel', () => {
  it('partitions the cohort using a Weibull survival curve with half-cycle correction', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 10,  // scale
      survivalCurveParam2: 1,   // shape (exponential)
      costPerCyclePre: 5000,
      costPerCyclePost: 2000,
      utilityPre: 0.75,
      utilityPost: 0.5,
      numCycles: 2,
      discountRate: 0,
    });
    expect(r.error).toBeUndefined();

    // Weibull with shape=1 is exponential: S(t) = exp(-t/scale) = exp(-t/10)
    // Cycle 1 (t=1): S(1) = exp(-0.1) = 0.90484, S(2) = exp(-0.2) = 0.81873
    //   Half-cycle avg: pre = (0.90484 + 0.81873)/2 = 0.86178, post = 0.13822
    //   Cost = 0.86178*5000 + 0.13822*2000 = 4308.9 + 276.44 = 4585.34
    //   QALY = 0.86178*0.75 + 0.13822*0.5 = 0.64633 + 0.06911 = 0.71544
    //
    // Cycle 2 (t=2): S(2) = 0.81873, S(3) = exp(-0.3) = 0.74082
    //   Half-cycle avg: pre = (0.81873 + 0.74082)/2 = 0.77978, post = 0.22022
    //   Cost = 0.77978*5000 + 0.22022*2000 = 3898.9 + 440.44 = 4339.34
    //   QALY = 0.77978*0.75 + 0.22022*0.5 = 0.58484 + 0.11011 = 0.69495
    //
    // Total cost = 4585.34 + 4339.34 = 8924.68 → rounded 8924.68
    // Total QALY = 0.71544 + 0.69495 = 1.41039
    // Pre-progression cycles = 0.86178 + 0.77978 = 1.64156
    // Post-progression cycles = 0.13822 + 0.22022 = 0.35844

    expect(r.totalDiscountedCost).toBeCloseTo(8924.68, 2);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.4104, 4);
    expect(r.preProgressionCycles).toBeCloseTo(1.6416, 4);
    expect(r.postProgressionCycles).toBeCloseTo(0.3584, 4);
    expect(r.stateTrace).toHaveLength(2);
    expect(r.stateTrace![0].cycle).toBe(1);
    expect(r.stateTrace![0].preProgression).toBeCloseTo(0.8618, 4);
    expect(r.stateTrace![0].postProgression).toBeCloseTo(0.1382, 4);
    expect(r.stateTrace![1].cycle).toBe(2);
  });

  it('applies per-cycle discount factor 1/(1+r)^cycle', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 10,
      survivalCurveParam2: 1,
      costPerCyclePre: 1000,
      costPerCyclePost: 500,
      utilityPre: 0.8,
      utilityPost: 0.4,
      numCycles: 3,
      discountRate: 0.05,
    });
    expect(r.error).toBeUndefined();
    // Cycle 0 discount = 1, cycle 1 = 1/1.05, cycle 2 = 1/1.1025
    // Undiscounted cost:
    //   t=1: pre=(exp(-0.1)+exp(-0.2))/2=0.86178, cost=861.78+69.11=930.89
    //   t=2: pre=(exp(-0.2)+exp(-0.3))/2=0.77978, cost=779.78+110.11=889.89
    //   t=3: pre=(exp(-0.3)+exp(-0.4))/2=0.70801, cost=708.01+145.99=854.00
    // Discounted: 930.89 + 889.89/1.05 + 854.00/1.1025
    //           = 930.89 + 847.51 + 774.60 = 2553.00
    expect(r.totalDiscountedCost).toBeCloseTo(2551.9, 1);
    expect(r.totalDiscountedQALYs).toBeGreaterThan(0);
  });

  it('handles a Weibull shape > 1 (accelerated progression)', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 10,
      survivalCurveParam2: 2,  // shape > 1: progression accelerates over time
      costPerCyclePre: 5000,
      costPerCyclePost: 2000,
      utilityPre: 0.75,
      utilityPost: 0.5,
      numCycles: 10,
      discountRate: 0.03,
    });
    expect(r.error).toBeUndefined();
    // With shape=2, survival drops faster than exponential
    // S(10) = exp(-(10/10)^2) = exp(-1) = 0.368
    // Early cycles are mostly pre-progression, later cycles shift to post
    expect(r.stateTrace).toHaveLength(10);
    // First cycle should be mostly pre-progression
    expect(r.stateTrace![0].preProgression).toBeGreaterThan(r.stateTrace![0].postProgression);
    // By the last cycle, post-progression should dominate
    const last = r.stateTrace![9];
    expect(last.postProgression).toBeGreaterThan(last.preProgression);
  });

  it('reports invalid numeric inputs', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 1,
      survivalCurveParam2: 1,
      costPerCyclePre: NaN,
      costPerCyclePost: 2000,
      utilityPre: 0.75,
      utilityPost: 0.5,
      numCycles: 4,
      discountRate: 0,
    });
    expect(r.error).toContain('costPerCyclePre');
  });

  it('rejects non-positive scale parameter', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 0,
      survivalCurveParam2: 1,
      costPerCyclePre: 5000,
      costPerCyclePost: 2000,
      utilityPre: 0.75,
      utilityPost: 0.5,
      numCycles: 4,
      discountRate: 0,
    });
    expect(r.error).toContain('scale');
  });

  it('rejects non-positive shape parameter', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 10,
      survivalCurveParam2: -1,
      costPerCyclePre: 5000,
      costPerCyclePost: 2000,
      utilityPre: 0.75,
      utilityPost: 0.5,
      numCycles: 4,
      discountRate: 0,
    });
    expect(r.error).toContain('shape');
  });
});

describe('calculateDiscreteEventSimulationModel', () => {
  it('computes patient volume, cost, QALYs and average wait deterministically', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 5,
      resourceCostBeta: 250,
      patientArrivalRate: 2,
      queueCapacity: 10,
      simulationDuration: 30,
    });
    expect(r.error).toBeUndefined();
    expect(r.numSimulatedPatients).toBe(60); // floor(2 * 30)
    expect(r.totalCost).toBe(15000); // 60 * 250
    expect(r.totalQALYs).toBe(3); // 60 * (5 / 100)
    expect(r.averageWaitTime).toBe(6); // 60 / 10
  });

  it('reports invalid numeric inputs', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 5,
      resourceCostBeta: 250,
      patientArrivalRate: NaN,
      queueCapacity: 10,
      simulationDuration: 30,
    });
    expect(r.error).toContain('patientArrivalRate');
  });
});
