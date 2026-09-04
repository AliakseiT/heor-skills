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
  it('propagates the state vector and accumulates discounted cost/QALYs', () => {
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
    // Cycle 1: cost = 0.7*100 + 0.3*200 = 130; QALY = 0.63 + 0.15 = 0.78
    // Next state: [0.59, 0.41]; cycle 2: cost = 59 + 82 = 141; QALY = 0.531 + 0.205 = 0.736
    expect(r.totalDiscountedCost).toBe(271);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.516, 4);
    expect(r.stateTrace).toHaveLength(2);
    expect(r.stateTrace[0]).toEqual([0.7, 0.3]);
    expect(r.stateTrace[1][0]).toBeCloseTo(0.59, 10);
    expect(r.stateTrace[1][1]).toBeCloseTo(0.41, 10);
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
});

describe('calculatePartitionedSurvivalModel', () => {
  it('splits cycles 50/50 pre/post-progression and sums discounted cost/utility', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 1,
      survivalCurveParam2: 1,
      costPerCyclePre: 5000,
      costPerCyclePost: 2000,
      utilityPre: 0.75,
      utilityPost: 0.5,
      numCycles: 4,
      discountRate: 0,
    });
    expect(r.error).toBeUndefined();
    expect(r.preProgressionCycles).toBe(2);
    expect(r.postProgressionCycles).toBe(2);
    // 2*5000 + 2*2000 = 14000; 2*0.75 + 2*0.5 = 2.5
    expect(r.totalDiscountedCost).toBe(14000);
    expect(r.totalDiscountedQALYs).toBeCloseTo(2.5, 4);
  });

  it('discounts each cycle at 1/(1+r)^cycle', () => {
    const r = calculatePartitionedSurvivalModel({
      survivalCurveParam1: 1,
      survivalCurveParam2: 1,
      costPerCyclePre: 1000,
      costPerCyclePost: 500,
      utilityPre: 0.8,
      utilityPost: 0.4,
      numCycles: 3, // 1 pre-cycle, 2 post-cycles
      discountRate: 0.05,
    });
    // 1000 + 500/1.05 + 500/1.1025 = 1929.71; 0.8 + 0.4/1.05 + 0.4/1.1025 = 1.5438
    expect(r.preProgressionCycles).toBe(1);
    expect(r.postProgressionCycles).toBe(2);
    expect(r.totalDiscountedCost).toBeCloseTo(1929.71, 2);
    expect(r.totalDiscountedQALYs).toBeCloseTo(1.5438, 4);
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
});

describe('calculateDiscreteEventSimulationModel', () => {
  it('simulates an M/M/c queue with no waiting when capacity exceeds demand', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 5,     // service time = 1/5 = 0.2 time units
      resourceCostBeta: 250,
      patientArrivalRate: 2,  // inter-arrival = 0.5 time units
      queueCapacity: 10,     // 10 slots — far more than needed
      simulationDuration: 30,
    });
    expect(r.error).toBeUndefined();
    expect(r.numSimulatedPatients).toBe(60);  // floor(2 * 30)
    expect(r.totalCost).toBe(15000);           // 60 * 250
    // With 10 slots and 0.2 service time, no patient ever waits
    expect(r.averageWaitTime).toBe(0);
    // QALYs = 60 * 0.2 * (1 - 0/30) = 12
    expect(r.totalQALYs).toBeCloseTo(12, 4);
  });

  it('produces non-zero wait times when capacity is constrained', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 1,     // service time = 1.0
      resourceCostBeta: 100,
      patientArrivalRate: 2, // inter-arrival = 0.5
      queueCapacity: 1,      // only 1 slot — patients must queue
      simulationDuration: 10,
    });
    expect(r.error).toBeUndefined();
    expect(r.numSimulatedPatients).toBe(20);  // floor(2 * 10)
    // With 1 slot and service time 1.0, inter-arrival 0.5:
    // Patient 0: arrives 0, served 0-1, wait=0
    // Patient 1: arrives 0.5, waits until 1.0, served 1.0-2.0, wait=0.5
    // Patient 2: arrives 1.0, waits until 2.0, served 2.0-3.0, wait=1.0
    // Pattern: patient i arrives at i*0.5, waits max(0, (i)*1.0 - i*0.5) = max(0, i*0.5)
    // Wait times: 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5
    // Total wait = sum(0, 0.5, 1.0, ..., 9.5) = 0.5 * (0+1+2+...+19) = 0.5 * 190 = 95
    // Average wait = 95 / 20 = 4.75
    expect(r.averageWaitTime).toBe(4.75);
    expect(r.totalCost).toBe(2000);  // 20 * 100
    // QALYs: each patient gets 1.0 * (1 - waitTime/10)
    // Patient i: QALY = 1 - (i*0.5)/10 = 1 - i/20
    // Total QALY = sum(1 - i/20 for i in 0..19) = 20 - (0+1+...+19)/20 = 20 - 190/20 = 20 - 9.5 = 10.5
    expect(r.totalQALYs).toBeCloseTo(10.5, 4);
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

  it('rejects non-positive patient arrival rate', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 5,
      resourceCostBeta: 250,
      patientArrivalRate: 0,
      queueCapacity: 10,
      simulationDuration: 30,
    });
    expect(r.error).toContain('arrival rate');
  });

  it('rejects non-integer queue capacity', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 5,
      resourceCostBeta: 250,
      patientArrivalRate: 2,
      queueCapacity: 2.5,
      simulationDuration: 30,
    });
    expect(r.error).toContain('Queue capacity');
  });

  it('rejects negative resource cost', () => {
    const r = calculateDiscreteEventSimulationModel({
      eventRateAlpha: 5,
      resourceCostBeta: -100,
      patientArrivalRate: 2,
      queueCapacity: 10,
      simulationDuration: 30,
    });
    expect(r.error).toContain('Resource cost');
  });
});
