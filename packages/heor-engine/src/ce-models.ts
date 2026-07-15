// Ported from HEOR Copilot src/services/ce-models.ts (characterization port —
// logic unchanged; imports rewired, mid-file imports hoisted, input parameter
// interfaces exported for the CLI/public API).
import type {
  BudgetImpactResults,
  DecisionTreeResults,
  DiscreteEventSimulationInputParameters,
  DiscreteEventSimulationResults,
  MarkovChainResults,
  MarkovStateDistribution,
  PartitionedSurvivalModelInputParameters,
  PartitionedSurvivalModelResults,
  StateTransitionModelInputParameters,
  StateTransitionModelResults,
} from './types';
import { BIA_NUMERIC_INPUT_NAMES, BIA_STRING_INPUT_NAMES, MARKOV_CHAIN_INPUT_NAMES } from './types';


export interface DecisionTreeInputParameters {
  costInterventionTest: number;
  sensitivityInterventionTest: number;
  specificityInterventionTest: number;
  costComparatorTest: number;
  sensitivityComparatorTest: number;
  specificityComparatorTest: number;
  prevalenceDisease: number;
  costTreatmentCorrectPositive: number;
  utilityTreatmentCorrectPositive: number;
  costFalsePositiveManagement: number;
  utilityFalsePositiveState: number;
  costFalseNegativeConsequence: number;
  utilityFalseNegativeState: number;
  costCorrectNegativeManagement: number;
  utilityCorrectNegativeState: number;
}

export function calculateDecisionTreeModel(params: DecisionTreeInputParameters): DecisionTreeResults {
  const {
    costInterventionTest, sensitivityInterventionTest, specificityInterventionTest,
    costComparatorTest, sensitivityComparatorTest, specificityComparatorTest,
    prevalenceDisease,
    costTreatmentCorrectPositive, utilityTreatmentCorrectPositive,
    costFalsePositiveManagement, utilityFalsePositiveState,
    costFalseNegativeConsequence, utilityFalseNegativeState,
    costCorrectNegativeManagement, utilityCorrectNegativeState,
  } = params;

  const allExpectedParams: Record<string, number | undefined> = {
    costInterventionTest, sensitivityInterventionTest, specificityInterventionTest,
    costComparatorTest, sensitivityComparatorTest, specificityComparatorTest,
    prevalenceDisease, costTreatmentCorrectPositive, utilityTreatmentCorrectPositive,
    costFalsePositiveManagement, utilityFalsePositiveState, costFalseNegativeConsequence,
    utilityFalseNegativeState, costCorrectNegativeManagement, utilityCorrectNegativeState,
  };

  const invalidParams = Object.entries(allExpectedParams)
    .filter(([, value]) => typeof value !== 'number' || Number.isNaN(value))
    .map(([key]) => key);

  if (invalidParams.length > 0) {
    return {
      error: `Invalid or missing numeric inputs for: ${invalidParams.join(', ')}. All parameters must be valid numbers.`,
      interventionArm: { expectedCost: NaN, expectedUtility: NaN },
      comparatorArm: { expectedCost: NaN, expectedUtility: NaN },
      incrementalCost: NaN, incrementalUtility: NaN, icer: "Error"
    };
  }


  if (prevalenceDisease < 0 || prevalenceDisease > 1 ||
    sensitivityInterventionTest < 0 || sensitivityInterventionTest > 1 ||
    specificityInterventionTest < 0 || specificityInterventionTest > 1 ||
    sensitivityComparatorTest < 0 || sensitivityComparatorTest > 1 ||
    specificityComparatorTest < 0 || specificityComparatorTest > 1) {
    return { error: "Probabilities (prevalence, sensitivity, specificity) must be between 0 and 1.", interventionArm: { expectedCost: NaN, expectedUtility: NaN }, comparatorArm: { expectedCost: NaN, expectedUtility: NaN }, incrementalCost: NaN, incrementalUtility: NaN, icer: "Error" };
  }


  const calculateArmOutcomes = (costTest: number, sensitivity: number, specificity: number) => {
    const probTestPositive_DiseasePresent = sensitivity;
    const probTestNegative_DiseasePresent = 1 - sensitivity;
    const probTestPositive_DiseaseAbsent = 1 - specificity;
    const probTestNegative_DiseaseAbsent = specificity;
    const probTestPositive = (prevalenceDisease * probTestPositive_DiseasePresent) + ((1 - prevalenceDisease) * probTestPositive_DiseaseAbsent);
    const probTestNegative = (prevalenceDisease * probTestNegative_DiseasePresent) + ((1 - prevalenceDisease) * probTestNegative_DiseaseAbsent);
    const probDiseasePresent_GivenTestPositive = probTestPositive > 0 ? (probTestPositive_DiseasePresent * prevalenceDisease) / probTestPositive : 0;
    const probDiseaseAbsent_GivenTestPositive = probTestPositive > 0 ? (probTestPositive_DiseaseAbsent * (1 - prevalenceDisease)) / probTestPositive : 0;
    const probDiseasePresent_GivenTestNegative = probTestNegative > 0 ? (probTestNegative_DiseasePresent * prevalenceDisease) / probTestNegative : 0;
    const probDiseaseAbsent_GivenTestNegative = probTestNegative > 0 ? (probTestNegative_DiseaseAbsent * (1 - prevalenceDisease)) / probTestNegative : 0;
    let expectedCost = costTest;
    expectedCost += probTestPositive * ((probDiseasePresent_GivenTestPositive * costTreatmentCorrectPositive) + (probDiseaseAbsent_GivenTestPositive * costFalsePositiveManagement));
    expectedCost += probTestNegative * ((probDiseasePresent_GivenTestNegative * costFalseNegativeConsequence) + (probDiseaseAbsent_GivenTestNegative * costCorrectNegativeManagement));
    let expectedUtility = 0;
    expectedUtility += probTestPositive * ((probDiseasePresent_GivenTestPositive * utilityTreatmentCorrectPositive) + (probDiseaseAbsent_GivenTestPositive * utilityFalsePositiveState));
    expectedUtility += probTestNegative * ((probDiseasePresent_GivenTestNegative * utilityFalseNegativeState) + (probDiseaseAbsent_GivenTestNegative * utilityCorrectNegativeState));
    return { expectedCost, expectedUtility };
  };

  const interventionArm = calculateArmOutcomes(costInterventionTest, sensitivityInterventionTest, specificityInterventionTest);
  const comparatorArm = calculateArmOutcomes(costComparatorTest, sensitivityComparatorTest, specificityComparatorTest);
  const incrementalCost = interventionArm.expectedCost - comparatorArm.expectedCost;
  const incrementalUtility = interventionArm.expectedUtility - comparatorArm.expectedUtility;
  let icer: number | string;
  if (incrementalUtility === 0) icer = (incrementalCost === 0) ? "No difference" : "Not calculable (zero utility gain)";
  else if (incrementalUtility > 0) icer = incrementalCost / incrementalUtility;
  else icer = (incrementalCost >= 0) ? "Dominated" : incrementalCost / incrementalUtility;
  const formattedIcer = typeof icer === 'number' ? parseFloat(icer.toFixed(2)) : icer;
  return { interventionArm, comparatorArm, incrementalCost: parseFloat(incrementalCost.toFixed(2)), incrementalUtility: parseFloat(incrementalUtility.toFixed(3)), icer: formattedIcer, details: "Calculation based on a standard 2-arm diagnostic test decision tree structure." };
}


export type MarkovChainInputParameters = {
  [K in keyof typeof MARKOV_CHAIN_INPUT_NAMES as typeof MARKOV_CHAIN_INPUT_NAMES[K]]: number;
};


export function calculateMarkovModel(params: MarkovChainInputParameters): MarkovChainResults {
  // Direct check for invalid or missing numeric inputs
  const invalidParams = Object.entries(params)
    .filter(([, value]) => typeof value !== 'number' || Number.isNaN(value))
    .map(([key]) => key);

  if (invalidParams.length > 0) {
    return { error: `Invalid or missing numeric inputs for Markov Model: ${invalidParams.join(', ')}. All parameters must be valid numbers.`, totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };
  }

  // Destructure all params, renaming the ones we will modify
  const {
    [MARKOV_CHAIN_INPUT_NAMES.PROB_H_TO_H]: p_HH, [MARKOV_CHAIN_INPUT_NAMES.PROB_H_TO_D]: p_HD, [MARKOV_CHAIN_INPUT_NAMES.PROB_D_TO_H]: p_DH, [MARKOV_CHAIN_INPUT_NAMES.PROB_D_TO_D]: p_DD, [MARKOV_CHAIN_INPUT_NAMES.PROB_H_TO_X]: p_HX, [MARKOV_CHAIN_INPUT_NAMES.PROB_D_TO_X]: p_DX,
    [MARKOV_CHAIN_INPUT_NAMES.COST_H]: costH, [MARKOV_CHAIN_INPUT_NAMES.COST_D]: costD, [MARKOV_CHAIN_INPUT_NAMES.COST_X]: costX,
    [MARKOV_CHAIN_INPUT_NAMES.UTILITY_H]: utilH, [MARKOV_CHAIN_INPUT_NAMES.UTILITY_D]: utilD, [MARKOV_CHAIN_INPUT_NAMES.UTILITY_X]: utilX,
    [MARKOV_CHAIN_INPUT_NAMES.NUM_CYCLES]: numCycles, [MARKOV_CHAIN_INPUT_NAMES.DISCOUNT_RATE]: discountRate,
    [MARKOV_CHAIN_INPUT_NAMES.INITIAL_COHORT_H_PERCENT]: initialHealthyPercentInput,
    [MARKOV_CHAIN_INPUT_NAMES.INITIAL_COHORT_D_PERCENT]: initialDiseasePercentInput,
  } = params;

  // Convert cohort percentages from 0-100 scale to 0-1 scale for calculation
  const initialHealthyPercent = initialHealthyPercentInput / 100;
  const initialDiseasePercent = initialDiseasePercentInput / 100;

  // Perform validations on the converted values and other params
  const probabilities = [p_HH, p_HD, p_HX, p_DH, p_DD, p_DX];
  if (probabilities.some(p => p < 0 || p > 1)) return { error: "Transition probabilities must be between 0 and 1.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };
  if (Math.abs(p_HH + p_HD + p_HX - 1.0) > 1e-6) return { error: "Probabilities from Healthy state must sum to 1.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };
  if (Math.abs(p_DH + p_DD + p_DX - 1.0) > 1e-6) return { error: "Probabilities from Disease state must sum to 1.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };
  if (numCycles <= 0 || !Number.isInteger(numCycles)) return { error: "Number of cycles must be a positive integer.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };
  if (discountRate < 0) return { error: "Discount rate cannot be negative.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };

  // The validation that was failing before, now on the correct scale but with a user-friendly error message
  if (initialHealthyPercent < 0 || initialHealthyPercent > 1 || initialDiseasePercent < 0 || initialDiseasePercent > 1 || (initialHealthyPercent + initialDiseasePercent) > 1.000001) {
    return { error: "Initial cohort percentages must be between 0 and 100, and their sum must not exceed 100%.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [] };
  }

  let cohort = { healthy: initialHealthyPercent, disease: initialDiseasePercent, dead: 1.0 - initialHealthyPercent - initialDiseasePercent };
  let totalDiscountedCost = 0; let totalDiscountedQALYs = 0; const stateTrace: MarkovStateDistribution[] = [];
  for (let cycle = 0; cycle < numCycles; cycle++) {
    stateTrace.push({ cycle: cycle + 1, ...cohort });
    const cycleCost = (cohort.healthy * costH) + (cohort.disease * costD) + (cohort.dead * costX);
    const cycleQALYs = (cohort.healthy * utilH) + (cohort.disease * utilD) + (cohort.dead * utilX);
    const discountFactor = 1 / Math.pow(1 + discountRate, cycle);
    totalDiscountedCost += cycleCost * discountFactor; totalDiscountedQALYs += cycleQALYs * discountFactor;
    const next_healthy = (cohort.healthy * p_HH) + (cohort.disease * p_DH);
    const next_disease = (cohort.healthy * p_HD) + (cohort.disease * p_DD);
    const next_dead = cohort.dead + (cohort.healthy * p_HX) + (cohort.disease * p_DX);
    cohort = { healthy: next_healthy, disease: next_disease, dead: next_dead };
  }
  return { totalDiscountedCost: parseFloat(totalDiscountedCost.toFixed(2)), totalDiscountedQALYs: parseFloat(totalDiscountedQALYs.toFixed(4)), stateTrace, details: `Markov model run for ${numCycles} cycles with a ${discountRate * 100}% discount rate. Results are for a single arm.` };
}


export interface BudgetImpactInputParameters {
  targetMarket: string;
  targetPopulationSize: number;
  marketShareInterventionY1: number;
  marketShareInterventionY2: number;
  marketShareInterventionY3: number;
  marketShareComparatorY1: number;
  marketShareComparatorY2: number;
  marketShareComparatorY3: number;
  annualCostInterventionPerPatient: number;
  annualCostComparatorPerPatient: number;
  numberOfYearsAssessment: number;
}

export function calculateBudgetImpactModel(params: BudgetImpactInputParameters): BudgetImpactResults {
  const {
    targetMarket, // New string parameter
    targetPopulationSize,
    marketShareInterventionY1, marketShareInterventionY2, marketShareInterventionY3,
    marketShareComparatorY1, marketShareComparatorY2, marketShareComparatorY3,
    annualCostInterventionPerPatient, annualCostComparatorPerPatient,
    numberOfYearsAssessment
  } = params;

  const missingParams: string[] = [];

  // Validate string parameter
  if (typeof targetMarket !== 'string' || targetMarket.trim() === '') {
    missingParams.push(BIA_STRING_INPUT_NAMES.TARGET_MARKET);
  }

  // Validate numeric parameters
  const numericParamsToCheck = {
    targetPopulationSize, marketShareInterventionY1, marketShareInterventionY2, marketShareInterventionY3,
    marketShareComparatorY1, marketShareComparatorY2, marketShareComparatorY3,
    annualCostInterventionPerPatient, annualCostComparatorPerPatient, numberOfYearsAssessment
  };

  Object.entries(numericParamsToCheck).forEach(([key, value]) => {
    if (typeof value !== 'number' || isNaN(value)) {
      const originalNameKey = (Object.keys(BIA_NUMERIC_INPUT_NAMES) as Array<keyof typeof BIA_NUMERIC_INPUT_NAMES>)
        .find(k => k.toLowerCase().replace(/_/g, '') === key.toLowerCase().replace(/_/g, ''));
      missingParams.push(originalNameKey ? BIA_NUMERIC_INPUT_NAMES[originalNameKey] : key);
    }
  });

  if (missingParams.length > 0) {
    return { error: `Missing required inputs for BIA Model: ${missingParams.join(', ')}. Please ensure all parameters are provided.` };
  }

  if (targetPopulationSize <= 0) return { error: "Target population size must be positive." };
  if (numberOfYearsAssessment < 1 || numberOfYearsAssessment > 5 || !Number.isInteger(numberOfYearsAssessment)) {
    return { error: "Number of years for assessment must be an integer between 1 and 5." };
  }
  const marketShares = [marketShareInterventionY1, marketShareInterventionY2, marketShareInterventionY3, marketShareComparatorY1, marketShareComparatorY2, marketShareComparatorY3];
  if (marketShares.some(share => share < 0 || share > 100)) {
    return { error: "Market shares must be percentages between 0 and 100." };
  }
  const marketSharesIntervention = [marketShareInterventionY1, marketShareInterventionY2, marketShareInterventionY3];
  const marketSharesComparator = [marketShareComparatorY1, marketShareComparatorY2, marketShareComparatorY3];


  const netBudgetImpactPerYear: Array<{ year: number; impact: number; interventionPatients: number; comparatorPatients: number }> = [];
  let totalNetBudgetImpact = 0;

  for (let i = 0; i < numberOfYearsAssessment; i++) {
    const year = i + 1;
    let currentMsIntervention = (marketSharesIntervention[i] !== undefined ? marketSharesIntervention[i] : marketSharesIntervention[marketSharesIntervention.length - 1]) / 100;
    let currentMsComparator = (marketSharesComparator[i] !== undefined ? marketSharesComparator[i] : marketSharesComparator[marketSharesComparator.length - 1]) / 100;


    // Normalize if sum exceeds 100% (common in PSA sampling)
    const totalShare = currentMsIntervention + currentMsComparator;
    if (totalShare > 1.0001) {
      currentMsIntervention = currentMsIntervention / totalShare;
      currentMsComparator = currentMsComparator / totalShare;
    }

    const patientsOnIntervention = targetPopulationSize * currentMsIntervention;
    const patientsOnComparator = targetPopulationSize * currentMsComparator;

    // Budget Impact = Cost in New Scenario - Cost in Reference Scenario (100% Comparator)
    // = [ (Patients_Int * Cost_Int) + (Patients_Comp * Cost_Comp) ] - [ (TargetPop * Cost_Comp) ]
    // = Patients_Int * Cost_Int + (TargetPop - Patients_Int) * Cost_Comp - TargetPop * Cost_Comp
    // = Patients_Int * Cost_Int + TargetPop * Cost_Comp - Patients_Int * Cost_Comp - TargetPop * Cost_Comp
    // = Patients_Int * (Cost_Int - Cost_Comp)

    const yearlyImpact = patientsOnIntervention * (annualCostInterventionPerPatient - annualCostComparatorPerPatient);


    netBudgetImpactPerYear.push({ year, impact: parseFloat(yearlyImpact.toFixed(2)), interventionPatients: Math.round(patientsOnIntervention), comparatorPatients: Math.round(patientsOnComparator) });
    totalNetBudgetImpact += yearlyImpact;
  }

  return {
    netBudgetImpactPerYear,
    totalNetBudgetImpact: parseFloat(totalNetBudgetImpact.toFixed(2)),
    totalEligiblePopulation: targetPopulationSize,
    numYears: numberOfYearsAssessment,
    targetMarket: targetMarket, // Include the target market in the results for context
    details: `BIA calculated for ${targetMarket} over ${numberOfYearsAssessment} years for a target population of ${targetPopulationSize}. Assumes intervention displaces comparator. Market shares are percentages.`,
  };
}

/**
 * State Transition Model calculation stub.
 * This is a placeholder. Real implementation would use the transition matrix and state costs/utilities.
 */
export function calculateStateTransitionModel(params: StateTransitionModelInputParameters): StateTransitionModelResults {
  const {
    transitionMatrix, initialStateDistribution, stateCosts, stateUtilities, numCycles, discountRate
  } = params;

  // Basic validation
  if (!Array.isArray(transitionMatrix) || !Array.isArray(initialStateDistribution) || !Array.isArray(stateCosts) || !Array.isArray(stateUtilities)) {
    return { error: "All matrix/vector inputs must be arrays.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [], };
  }
  if (typeof numCycles !== 'number' || typeof discountRate !== 'number') {
    return { error: "numCycles and discountRate must be numbers.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [], };
  }
  const nStates = initialStateDistribution.length;
  if (
    transitionMatrix.length !== nStates ||
    transitionMatrix.some(row => row.length !== nStates) ||
    stateCosts.length !== nStates ||
    stateUtilities.length !== nStates
  ) {
    return { error: "Matrix/vector dimensions do not match number of states.", totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, stateTrace: [], };
  }

  // Placeholder logic: propagate state vector, sum costs/utilities
  let stateVec = [...initialStateDistribution];
  let totalDiscountedCost = 0;
  let totalDiscountedQALYs = 0;
  const stateTrace: number[][] = [];
  for (let cycle = 0; cycle < numCycles; cycle++) {
    stateTrace.push([...stateVec]);
    const cycleCost = stateVec.reduce((sum, pop, i) => sum + pop * stateCosts[i], 0);
    const cycleQALYs = stateVec.reduce((sum, pop, i) => sum + pop * stateUtilities[i], 0);
    const discount = 1 / Math.pow(1 + discountRate, cycle);
    totalDiscountedCost += cycleCost * discount;
    totalDiscountedQALYs += cycleQALYs * discount;
    // Matrix multiply: stateVec = stateVec * transitionMatrix
    const nextStateVec = Array(nStates).fill(0);
    for (let i = 0; i < nStates; i++) {
      for (let j = 0; j < nStates; j++) {
        nextStateVec[j] += stateVec[i] * transitionMatrix[i][j];
      }
    }
    stateVec = nextStateVec;
  }
  return {
    totalDiscountedCost: parseFloat(totalDiscountedCost.toFixed(2)),
    totalDiscountedQALYs: parseFloat(totalDiscountedQALYs.toFixed(4)),
    stateTrace,
    details: "Stub: Simple state vector propagation. Replace with real state transition logic."
  };
}

/**
 * Partitioned Survival Model calculation stub.
 * This is a placeholder. Real implementation would use survival curves and partition logic.
 */
export function calculatePartitionedSurvivalModel(params: PartitionedSurvivalModelInputParameters): PartitionedSurvivalModelResults {
  const {
    costPerCyclePre, costPerCyclePost,
    utilityPre, utilityPost,
    numCycles, discountRate
  } = params;

  // Basic validation
  const invalidParams = Object.entries(params)
    .filter(([, value]) => typeof value !== 'number' || Number.isNaN(value))
    .map(([key]) => key);
  if (invalidParams.length > 0) {
    return { error: `Invalid or missing numeric inputs for Partitioned Survival Model: ${invalidParams.join(', ')}.`, totalDiscountedCost: NaN, totalDiscountedQALYs: NaN, preProgressionCycles: 0, postProgressionCycles: 0 };
  }

  // Placeholder logic: split cycles 50/50 pre/post, simple cost/utility sum
  const preCycles = Math.floor(numCycles / 2);
  const postCycles = numCycles - preCycles;
  let totalDiscountedCost = 0;
  let totalDiscountedQALYs = 0;
  for (let i = 0; i < numCycles; i++) {
    const isPre = i < preCycles;
    const cost = isPre ? costPerCyclePre : costPerCyclePost;
    const util = isPre ? utilityPre : utilityPost;
    const discount = 1 / Math.pow(1 + discountRate, i);
    totalDiscountedCost += cost * discount;
    totalDiscountedQALYs += util * discount;
  }
  return {
    totalDiscountedCost: parseFloat(totalDiscountedCost.toFixed(2)),
    totalDiscountedQALYs: parseFloat(totalDiscountedQALYs.toFixed(4)),
    preProgressionCycles: preCycles,
    postProgressionCycles: postCycles,
    details: "Stub: Cycles split 50/50 pre/post-progression. Replace with real survival curve logic."
  };
}

/**
 * Discrete Event Simulation calculation stub.
 * This is a placeholder. Real implementation would simulate patient flow/events.
 */
export function calculateDiscreteEventSimulationModel(params: DiscreteEventSimulationInputParameters): DiscreteEventSimulationResults {
  const {
    eventRateAlpha, resourceCostBeta, patientArrivalRate, queueCapacity, simulationDuration
  } = params;

  // Basic validation
  const invalidParams = Object.entries(params)
    .filter(([, value]) => typeof value !== 'number' || Number.isNaN(value))
    .map(([key]) => key);
  if (invalidParams.length > 0) {
    return { error: `Invalid or missing numeric inputs for Discrete Event Simulation: ${invalidParams.join(', ')}.`, totalCost: NaN, totalQALYs: NaN, averageWaitTime: NaN, numSimulatedPatients: 0 };
  }

  // Placeholder logic: simulate a fixed number of patients, simple cost/wait calculation
  const numPatients = Math.floor(patientArrivalRate * simulationDuration);
  const totalCost = numPatients * resourceCostBeta;
  const totalQALYs = numPatients * (eventRateAlpha / 100); // Arbitrary QALY assignment
  const averageWaitTime = queueCapacity > 0 ? (numPatients / queueCapacity) : NaN;

  return {
    totalCost: parseFloat(totalCost.toFixed(2)),
    totalQALYs: parseFloat(totalQALYs.toFixed(4)),
    averageWaitTime: parseFloat(averageWaitTime.toFixed(2)),
    numSimulatedPatients: numPatients,
    details: "Stub: Simple DES logic. Replace with real event simulation."
  };
}
