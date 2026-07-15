/**
 * @heor/engine — pure-TypeScript health-economic modeling engine.
 *
 * Zero runtime dependencies. Ported from the HEOR Copilot app as a
 * characterization port (behavior identical to the source modules).
 */

// Model types, input-name constants, and result interfaces
export * from './types';

// The six model calculators
export {
  calculateDecisionTreeModel,
  calculateMarkovModel,
  calculateBudgetImpactModel,
  calculateStateTransitionModel,
  calculatePartitionedSurvivalModel,
  calculateDiscreteEventSimulationModel,
  type DecisionTreeInputParameters,
  type MarkovChainInputParameters,
  type BudgetImpactInputParameters,
} from './ce-models';

// Probabilistic sensitivity analysis
export {
  runProbabilisticSensitivityAnalysis,
  generatePSASummary,
  type PSAConfiguration,
  type PSAResult,
  type PSAIteration,
  type PSAStatistics,
  type CEACPoint,
  type TornadoParameter,
  type ParameterRangeInfo,
} from './probabilistic-sensitivity-analysis';

// Batch scenario execution / comparison
export {
  executeScenario,
  executeBatch,
  generateSensitivityScenarios,
  clearCache,
  getCacheStats,
  type ScenarioExecutionConfig,
  type ScenarioExecutionResult,
  type BatchExecutionConfig,
  type BatchExecutionResult,
} from './batch-scenario-executor';

// Device-class default parameter sets
export {
  DEVICE_CLASS_DEFAULTS,
  getDefaultsForDeviceClass,
  getDefaultById,
  listAvailableDeviceClasses,
  listAllDefaults,
  type DeviceClass,
  type DistributionType,
  type ParameterDistribution,
  type DefaultModelInputSet,
  type DeviceClassDefaults,
} from './economic-model-defaults';

// Parameter name mapping between defaults-library and template conventions
export {
  findDefaultsParameterName,
  findTemplateParameterName,
  getAllDefaultsParameterNames,
  getAllTemplateParameterNames,
  isDefaultsParameter,
  isTemplateParameter,
  getMappingStats,
} from './parameter-name-mapper';

// Input merging (AI suggestions > expert inputs > device-class defaults)
export {
  mergeEconomicInputs,
  validateMergedInputs,
  generateMergeReport,
  createMergeStrategyFromDeviceClass,
  compareInputs,
  type InputMergeStrategy,
  type MergedInputResult,
  type ValidationResult,
  type InputComparison,
} from './economic-input-merger';
