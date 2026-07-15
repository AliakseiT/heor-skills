// Ported from HEOR Copilot src/lib/economic-model-defaults.ts (characterization port — unchanged).
/**
 * Device Class Defaults for Economic Modeling
 * Provides baseline parameter sets for different device/intervention classes
 * to enable quick demos and fallback when IFU data is incomplete
 */

export type DeviceClass = 
  | 'diagnostic-device'
  | 'monitoring-device'
  | 'therapeutic-device'
  | 'digital-therapy'
  | 'software-as-medical-device'
  | 'custom';

export type DistributionType = 'uniform' | 'normal' | 'triangular' | 'lognormal';

export interface ParameterDistribution {
  min: number;
  max: number;
  distribution: DistributionType;
  mean?: number;
  stdDev?: number;
  mode?: number; // for triangular distribution
}

export interface DefaultModelInputSet {
  id: string;
  deviceClass: DeviceClass;
  modelType: 'Decision Tree' | 'Markov Chain' | 'Partitioned Survival Model' | 'Discrete Event Simulation';
  name: string;
  description: string;
  baselineInputs: Record<string, number | string>;
  parameterRanges: Record<string, ParameterDistribution>;
  assumptions: string[];
  sources: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface DeviceClassDefaults {
  [key: string]: DefaultModelInputSet[];
}

/**
 * Digital Therapy - Decision Tree Model
 * Typical for diagnostic or screening digital health applications
 */
const DIGITAL_THERAPY_DT: DefaultModelInputSet = {
  id: 'dt-digital-therapy-dt-001',
  deviceClass: 'digital-therapy',
  modelType: 'Decision Tree',
  name: 'Digital Therapy - Diagnostic Decision Tree',
  description: 'Baseline parameters for digital health diagnostic/screening applications using decision tree analysis',
  baselineInputs: {
    costInterventionTest: 50,
    sensitivityInterventionTest: 0.85,
    specificityInterventionTest: 0.90,
    costComparatorTest: 40,
    sensitivityComparatorTest: 0.75,
    specificityComparatorTest: 0.80,
    prevalenceDisease: 0.15,
    costTreatmentCorrectPositive: 2000,
    utilityTreatmentCorrectPositive: 0.8,
    costFalsePositiveManagement: 500,
    utilityFalsePositiveState: 0.6,
    costFalseNegativeConsequence: 5000,
    utilityFalseNegativeState: 0.3,
    costCorrectNegativeManagement: 100,
    utilityCorrectNegativeState: 1.0,
  },
  parameterRanges: {
    costInterventionTest: { min: 25, max: 100, distribution: 'triangular', mode: 50 },
    sensitivityInterventionTest: { min: 0.75, max: 0.95, distribution: 'normal', mean: 0.85, stdDev: 0.06 },
    specificityInterventionTest: { min: 0.85, max: 0.98, distribution: 'normal', mean: 0.90, stdDev: 0.05 },
    costComparatorTest: { min: 25, max: 80, distribution: 'triangular', mode: 40 },
    sensitivityComparatorTest: { min: 0.65, max: 0.85, distribution: 'normal', mean: 0.75, stdDev: 0.06 },
    specificityComparatorTest: { min: 0.75, max: 0.90, distribution: 'normal', mean: 0.80, stdDev: 0.06 },
    prevalenceDisease: { min: 0.08, max: 0.30, distribution: 'triangular', mode: 0.15 },
    costTreatmentCorrectPositive: { min: 1200, max: 3500, distribution: 'lognormal', mean: 2000, stdDev: 800 },
    utilityTreatmentCorrectPositive: { min: 0.65, max: 0.90, distribution: 'triangular', mode: 0.8 },
    costFalsePositiveManagement: { min: 300, max: 800, distribution: 'triangular', mode: 500 },
    utilityFalsePositiveState: { min: 0.45, max: 0.75, distribution: 'triangular', mode: 0.6 },
    costFalseNegativeConsequence: { min: 3000, max: 7000, distribution: 'lognormal', mean: 5000, stdDev: 1500 },
    utilityFalseNegativeState: { min: 0.15, max: 0.45, distribution: 'triangular', mode: 0.3 },
    costCorrectNegativeManagement: { min: 75, max: 200, distribution: 'triangular', mode: 100 },
    utilityCorrectNegativeState: { min: 0.92, max: 1.0, distribution: 'uniform' },
  },
  assumptions: [
    'Based on typical digital health intervention costs (2024 market data)',
    'Sensitivity/specificity derived from meta-analysis of digital diagnostics',
    'Assumes 15% disease prevalence in target population (typical for screening)',
    'Treatment costs reflect standard clinical management pathways',
    'Utility values based on EQ-5D and SF-6D literature',
    'Time horizon: single diagnostic episode (no discounting)',
  ],
  sources: {
    costInterventionTest: 'Digital Health Cost Database 2024, WHO mHealth Guidelines',
    sensitivityInterventionTest: 'Meta-analysis: Digital Diagnostics Accuracy (Lancet 2023)',
    specificityInterventionTest: 'Meta-analysis: Digital Diagnostics Accuracy (Lancet 2023)',
    costComparatorTest: 'Standard clinical diagnostic costs (NICE reference costs)',
    prevalenceDisease: 'WHO Global Health Observatory, epidemiological surveys',
    utilityTreatmentCorrectPositive: 'EQ-5D-5L population norms',
    costFalseNegativeConsequence: 'Disease progression costs, clinical literature',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Monitoring Device - Markov Chain Model
 * Typical for chronic disease management or continuous monitoring
 */
const MONITORING_DEVICE_MARKOV: DefaultModelInputSet = {
  id: 'dt-monitoring-device-markov-001',
  deviceClass: 'monitoring-device',
  modelType: 'Markov Chain',
  name: 'Monitoring Device - Chronic Disease Markov Model',
  description: 'Baseline parameters for continuous monitoring devices using Markov chain analysis over 5 years',
  baselineInputs: {
    'Prob Healthy to Healthy': 0.85,
    'Prob Healthy to Disease': 0.10,
    'Prob Healthy to Dead': 0.05,
    'Prob Disease to Healthy': 0.20,
    'Prob Disease to Disease': 0.70,
    'Prob Disease to Dead': 0.10,
    'Cost Healthy State': 500,
    'Cost Disease State': 3000,
    'Cost Dead State': 0,
    'Utility Healthy State': 1.0,
    'Utility Disease State': 0.7,
    'Utility Dead State': 0.0,
    'Number of Cycles': 20,
    'Annual Discount Rate': 0.03,
    'Initial Cohort % Healthy': 70,
    'Initial Cohort % Disease': 30,
  },
  parameterRanges: {
    'Prob Healthy to Healthy': { min: 0.80, max: 0.90, distribution: 'triangular', mode: 0.85 },
    'Prob Healthy to Disease': { min: 0.06, max: 0.15, distribution: 'triangular', mode: 0.10 },
    'Prob Healthy to Dead': { min: 0.02, max: 0.08, distribution: 'triangular', mode: 0.05 },
    'Prob Disease to Healthy': { min: 0.12, max: 0.30, distribution: 'triangular', mode: 0.20 },
    'Prob Disease to Disease': { min: 0.60, max: 0.75, distribution: 'triangular', mode: 0.70 },
    'Prob Disease to Dead': { min: 0.08, max: 0.15, distribution: 'triangular', mode: 0.10 },
    'Cost Healthy State': { min: 400, max: 800, distribution: 'lognormal', mean: 500, stdDev: 200 },
    'Cost Disease State': { min: 2000, max: 4500, distribution: 'lognormal', mean: 3000, stdDev: 1000 },
    'Utility Healthy State': { min: 0.96, max: 1.0, distribution: 'uniform' },
    'Utility Disease State': { min: 0.6, max: 0.8, distribution: 'triangular', mode: 0.7 },
  },
  assumptions: [
    'Markov model with 3 health states: Healthy, Disease, Death',
    'Cycle length: 3 months (quarterly monitoring)',
    'Time horizon: 5 years (20 cycles)',
    'Annual discount rate: 3% (standard for health economics)',
    'Transition probabilities based on clinical literature',
    'Costs reflect direct medical costs only',
    'Utility values from published EQ-5D studies',
  ],
  sources: {
    'Prob Healthy to Disease': 'Clinical epidemiology literature, disease incidence rates',
    'Cost Disease State': 'Healthcare utilization studies, national health accounts',
    'Utility Disease State': 'EQ-5D-5L disease-specific studies',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Therapeutic Device - Partitioned Survival Model
 * Typical for cancer treatments or other serious conditions
 */
const THERAPEUTIC_DEVICE_PSM: DefaultModelInputSet = {
  id: 'dt-therapeutic-device-psm-001',
  deviceClass: 'therapeutic-device',
  modelType: 'Partitioned Survival Model',
  name: 'Therapeutic Device - Partitioned Survival Model',
  description: 'Baseline parameters for therapeutic devices using partitioned survival analysis',
  baselineInputs: {
    'Cost Per Cycle Pre-Progression': 5000,
    'Cost Per Cycle Post-Progression': 2000,
    'Utility Pre-Progression': 0.75,
    'Utility Post-Progression': 0.50,
    'Number of Cycles': 24,
    'Annual Discount Rate': 0.035,
  },
  parameterRanges: {
    'Cost Per Cycle Pre-Progression': { min: 2000, max: 10000, distribution: 'lognormal', mean: 5000, stdDev: 3000 },
    'Cost Per Cycle Post-Progression': { min: 1000, max: 5000, distribution: 'lognormal', mean: 2000, stdDev: 1500 },
    'Utility Pre-Progression': { min: 0.60, max: 0.90, distribution: 'triangular', mode: 0.75 },
    'Utility Post-Progression': { min: 0.30, max: 0.70, distribution: 'triangular', mode: 0.50 },
    'Annual Discount Rate': { min: 0.015, max: 0.05, distribution: 'uniform' },
  },
  assumptions: [
    'Partitioned survival model with pre/post-progression states',
    'Cycle length: 1 month',
    'Time horizon: 2 years (24 cycles)',
    'Costs include drug, administration, and monitoring',
    'Utility values reflect quality of life in each state',
    'Progression rates derived from clinical trial data',
  ],
  sources: {
    'Cost Per Cycle Pre-Progression': 'Clinical trial cost data, pharmacy pricing',
    'Utility Pre-Progression': 'EORTC QLQ-C30 and EQ-5D studies',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Software as Medical Device (SaMD) - Budget Impact Model
 * Typical for software-based interventions
 */
const SAMD_BIA: DefaultModelInputSet = {
  id: 'dt-samd-bia-001',
  deviceClass: 'software-as-medical-device',
  modelType: 'Decision Tree',
  name: 'SaMD - Budget Impact Assessment',
  description: 'Baseline parameters for software-based medical devices using budget impact analysis',
  baselineInputs: {
    'Target Market': 'Primary Care - Hypertension Management',
    'Target Population Size': 100000,
    'Market Share Intervention Y1': 5,
    'Market Share Intervention Y2': 15,
    'Market Share Intervention Y3': 25,
    'Market Share Comparator Y1': 95,
    'Market Share Comparator Y2': 85,
    'Market Share Comparator Y3': 75,
    'Annual Cost Intervention Per Patient': 120,
    'Annual Cost Comparator Per Patient': 80,
    'Number of Years Assessment': 3,
  },
  parameterRanges: {
    'Target Population Size': { min: 10000, max: 100000, distribution: 'lognormal', mean: 25000, stdDev: 15000 },
    'Market Share Intervention Y1': { min: 1, max: 12, distribution: 'triangular', mode: 5 },
    'Market Share Intervention Y2': { min: 5, max: 25, distribution: 'triangular', mode: 15 },
    'Market Share Intervention Y3': { min: 10, max: 35, distribution: 'triangular', mode: 25 },
    'Annual Cost Intervention Per Patient': { min: 50, max: 200, distribution: 'lognormal', mean: 100, stdDev: 30 },
    'Annual Cost Comparator Per Patient': { min: 40, max: 120, distribution: 'lognormal', mean: 70, stdDev: 20 },
  },
  assumptions: [
    'Budget impact analysis over 3 years',
    'Market share growth reflects typical SaMD adoption curves',
    'Costs include licensing, implementation, and support',
    'Assumes intervention displaces comparator (not additive)',
    'Population size based on target indication prevalence',
    'Annual cost per patient includes all direct costs',
  ],
  sources: {
    'Target Population Size': 'Epidemiological data, disease registries',
    'Market Share Intervention Y1': 'Digital health adoption studies, market research',
    'Annual Cost Intervention Per Patient': 'SaMD pricing benchmarks, implementation studies',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

/**
 * Complete device class defaults registry
 */
export const DEVICE_CLASS_DEFAULTS: DeviceClassDefaults = {
  'digital-therapy': [DIGITAL_THERAPY_DT],
  'monitoring-device': [MONITORING_DEVICE_MARKOV],
  'therapeutic-device': [THERAPEUTIC_DEVICE_PSM],
  'software-as-medical-device': [SAMD_BIA],
  'diagnostic-device': [DIGITAL_THERAPY_DT], // Reuse digital therapy defaults
  'custom': [],
};

/**
 * Get defaults for a specific device class
 */
export function getDefaultsForDeviceClass(deviceClass: DeviceClass): DefaultModelInputSet[] {
  return DEVICE_CLASS_DEFAULTS[deviceClass] || [];
}

/**
 * Get a specific default by ID
 */
export function getDefaultById(id: string): DefaultModelInputSet | null {
  for (const defaults of Object.values(DEVICE_CLASS_DEFAULTS)) {
    const found = defaults.find(d => d.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * List all available device classes
 */
export function listAvailableDeviceClasses(): DeviceClass[] {
  return Object.keys(DEVICE_CLASS_DEFAULTS) as DeviceClass[];
}

/**
 * List all available defaults across all classes
 */
export function listAllDefaults(): DefaultModelInputSet[] {
  return Object.values(DEVICE_CLASS_DEFAULTS).flat();
}
