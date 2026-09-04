/**
 * Standalone model types and input-name constants for the HEOR engine.
 *
 * Extracted verbatim from the HEOR Copilot app's `src/types/copilot.ts`,
 * limited to what the economic modeling engine needs. The app's `Dossier`
 * god-type is intentionally NOT ported.
 */

export const COST_EFFECTIVENESS_MODELS = [
  "Decision Tree",
  "Markov Chain",
  "Partitioned Survival Model",
  "Discrete Event Simulation",
  "State Transition Model"
] as const;

export type CostEffectivenessModelType = typeof COST_EFFECTIVENESS_MODELS[number];

export const DECISION_TREE_INPUT_NAMES = {
  COST_INTERVENTION_TEST: "Cost of Intervention Test",
  SENSITIVITY_INTERVENTION_TEST: "Sensitivity of Intervention Test",
  SPECIFICITY_INTERVENTION_TEST: "Specificity of Intervention Test",
  COST_COMPARATOR_TEST: "Cost of Comparator Test",
  SENSITIVITY_COMPARATOR_TEST: "Sensitivity of Comparator Test",
  SPECIFICITY_COMPARATOR_TEST: "Specificity of Comparator Test",
  PREVALENCE_DISEASE: "Prevalence of Disease/Condition",
  COST_TREATMENT_CORRECT_POSITIVE: "Cost of Treatment (Correct Positive)",
  UTILITY_TREATMENT_CORRECT_POSITIVE: "Utility of Treatment (Correct Positive)",
  COST_FALSE_POSITIVE_MANAGEMENT: "Cost of False Positive Management",
  UTILITY_FALSE_POSITIVE_STATE: "Utility of False Positive State",
  COST_FALSE_NEGATIVE_CONSEQUENCE: "Cost of False Negative Consequence",
  UTILITY_FALSE_NEGATIVE_STATE: "Utility of False Negative State",
  COST_CORRECT_NEGATIVE_MANAGEMENT: "Cost of Correct Negative Management",
  UTILITY_CORRECT_NEGATIVE_STATE: "Utility of Correct Negative State",
};

export const MARKOV_CHAIN_INPUT_NAMES = {
  PROB_H_TO_H: "Prob Healthy to Healthy",
  PROB_H_TO_D: "Prob Healthy to Disease",
  PROB_D_TO_H: "Prob Disease to Healthy",
  PROB_D_TO_D: "Prob Disease to Disease",
  PROB_H_TO_X: "Prob Healthy to Dead",
  PROB_D_TO_X: "Prob Disease to Dead",
  COST_H: "Cost Healthy State",
  COST_D: "Cost Disease State",
  COST_X: "Cost Dead State",
  UTILITY_H: "Utility Healthy State",
  UTILITY_D: "Utility Disease State",
  UTILITY_X: "Utility Dead State",
  NUM_CYCLES: "Number of Cycles",
  DISCOUNT_RATE: "Annual Discount Rate",
  INITIAL_COHORT_H_PERCENT: "Initial Cohort % Healthy",
  INITIAL_COHORT_D_PERCENT: "Initial Cohort % Disease",
};

export const BIA_STRING_INPUT_NAMES = {
  TARGET_MARKET: "Target Market (e.g., Country Name)",
};

export const BIA_NUMERIC_INPUT_NAMES = {
  TARGET_POPULATION_SIZE: "Target Population Size (Total Eligible)",
  MARKET_SHARE_INTERVENTION_Y1: "Intervention Market Share Year 1 (%)",
  MARKET_SHARE_INTERVENTION_Y2: "Intervention Market Share Year 2 (%)",
  MARKET_SHARE_INTERVENTION_Y3: "Intervention Market Share Year 3 (%)",
  MARKET_SHARE_COMPARATOR_Y1: "Comparator Market Share Year 1 (%)",
  MARKET_SHARE_COMPARATOR_Y2: "Comparator Market Share Year 2 (%)",
  MARKET_SHARE_COMPARATOR_Y3: "Comparator Market Share Year 3 (%)",
  ANNUAL_COST_INTERVENTION_PER_PATIENT: "Annual Cost of Intervention per Patient",
  ANNUAL_COST_COMPARATOR_PER_PATIENT: "Annual Cost of Comparator per Patient",
  NUMBER_OF_YEARS_ASSESSMENT: "Number of Years for BIA Assessment (1-5)",
};

export const BUDGET_IMPACT_INPUT_NAMES = {
  ...BIA_STRING_INPUT_NAMES,
  ...BIA_NUMERIC_INPUT_NAMES,
};

export const MODEL_INPUTS_MAP: Record<CostEffectivenessModelType | "BudgetImpactAssessment", string[]> = {
  "Decision Tree": Object.values(DECISION_TREE_INPUT_NAMES),
  "Markov Chain": Object.values(MARKOV_CHAIN_INPUT_NAMES),
  "Partitioned Survival Model": ["Survival Curve Parameter 1 (e.g., Weibull Scale)", "Survival Curve Parameter 2 (e.g., Weibull Shape)", "Cost per Cycle (Pre-progression)", "Cost per Cycle (Post-progression)", "Utility (Pre-progression)", "Utility (Post-progression)", "Number of Cycles", "Annual Discount Rate"],
  "Discrete Event Simulation": ["Event Rate Alpha", "Resource Cost Beta", "Patient Arrival Rate", "Queue Capacity", "Simulation Duration"],
  "BudgetImpactAssessment": Object.values(BUDGET_IMPACT_INPUT_NAMES),
  "State Transition Model": [
    "Transition Matrix (2D array, e.g. [[0.8,0.2],[0.1,0.9]])",
    "Initial State Distribution (e.g. [0.7,0.3])",
    "State Costs (e.g. [100,200])",
    "State Utilities (e.g. [0.8,0.6])",
    "Number of Cycles",
    "Annual Discount Rate"
  ]
};

export interface DecisionTreeResults {
  interventionArm: {
    expectedCost: number;
    expectedUtility: number;
  };
  comparatorArm: {
    expectedCost: number;
    expectedUtility: number;
  };
  incrementalCost: number;
  incrementalUtility: number;
  icer: number | string;
  details?: string;
  error?: string;
}

export interface MarkovStateDistribution {
  cycle: number;
  healthy: number;
  disease: number;
  dead: number;
}

export interface MarkovChainResults {
  totalDiscountedCost: number;
  totalDiscountedQALYs: number;
  stateTrace: MarkovStateDistribution[];
  details?: string;
  error?: string;
}

export interface BudgetImpactResults {
  netBudgetImpactPerYear?: Array<{ year: number; impact: number; interventionPatients: number; comparatorPatients: number }>;
  totalNetBudgetImpact?: number;
  totalEligiblePopulation?: number;
  numYears?: number;
  targetMarket?: string;
  error?: string;
  details?: string;
}

export interface StateTransitionModelInputParameters {
  transitionMatrix: number[][];
  initialStateDistribution: number[];
  stateCosts: number[];
  stateUtilities: number[];
  numCycles: number;
  discountRate: number;
}

export interface StateTransitionModelResults {
  totalDiscountedCost: number;
  totalDiscountedQALYs: number;
  stateTrace: number[][];
  details?: string;
  error?: string;
}

/** Partitioned Survival Model */
export interface PartitionedSurvivalModelInputParameters {
  survivalCurveParam1: number;
  survivalCurveParam2: number;
  costPerCyclePre: number;
  costPerCyclePost: number;
  utilityPre: number;
  utilityPost: number;
  numCycles: number;
  discountRate: number;
}

export interface PartitionedSurvivalModelResults {
  totalDiscountedCost: number;
  totalDiscountedQALYs: number;
  preProgressionCycles: number;
  postProgressionCycles: number;
  stateTrace?: Array<{ cycle: number; preProgression: number; postProgression: number }>;
  details?: string;
  error?: string;
}

/** Discrete Event Simulation */
export interface DiscreteEventSimulationInputParameters {
  eventRateAlpha: number;
  resourceCostBeta: number;
  patientArrivalRate: number;
  queueCapacity: number;
  simulationDuration: number;
}

export interface DiscreteEventSimulationResults {
  totalCost: number;
  totalQALYs: number;
  averageWaitTime: number;
  numSimulatedPatients: number;
  details?: string;
  error?: string;
}
