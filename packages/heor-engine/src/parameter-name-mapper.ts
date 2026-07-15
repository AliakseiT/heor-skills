// Ported from HEOR Copilot src/lib/parameter-name-mapper.ts (characterization port — unchanged).
/**
 * Parameter Name Mapper
 * Maps between different parameter naming conventions used in:
 * - Device class defaults library (camelCase and formatted strings)
 * - Economic templates (human-readable format)
 * - Model input text blocks (AI-generated format)
 */

/**
 * Normalize parameter names for matching
 * Converts to lowercase and removes special characters for comparison
 */
function normalizeParameterName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim();
}

/**
 * Map from defaults library parameter names to template parameter names
 * Template names are the canonical names used in MODEL_INPUTS_MAP (from copilot.ts)
 */
const DEFAULTS_TO_TEMPLATE_MAP: Record<string, string> = {
  // Digital Therapy / Decision Tree parameters (camelCase in defaults)
  'costInterventionTest': 'Cost of Intervention Test',
  'sensitivityInterventionTest': 'Sensitivity of Intervention Test',
  'specificityInterventionTest': 'Specificity of Intervention Test',
  'costComparatorTest': 'Cost of Comparator Test',
  'sensitivityComparatorTest': 'Sensitivity of Comparator Test',
  'specificityComparatorTest': 'Specificity of Comparator Test',
  'prevalenceDisease': 'Prevalence of Disease/Condition',
  'costTreatmentCorrectPositive': 'Cost of Treatment (Correct Positive)',
  'utilityTreatmentCorrectPositive': 'Utility of Treatment (Correct Positive)',
  'costFalsePositiveManagement': 'Cost of False Positive Management',
  'utilityFalsePositiveState': 'Utility of False Positive State',
  'costFalseNegativeConsequence': 'Cost of False Negative Consequence',
  'utilityFalseNegativeState': 'Utility of False Negative State',
  'costCorrectNegativeManagement': 'Cost of Correct Negative Management',
  'utilityCorrectNegativeState': 'Utility of Correct Negative State',

  // Markov Chain parameters (formatted strings in defaults)
  'Probability: Healthy to Healthy': 'Prob Healthy to Healthy',
  'Probability: Healthy to Disease': 'Prob Healthy to Disease',
  'Probability: Healthy to Death': 'Prob Healthy to Dead',
  'Probability: Disease to Healthy': 'Prob Disease to Healthy',
  'Probability: Disease to Disease': 'Prob Disease to Disease',
  'Probability: Disease to Death': 'Prob Disease to Dead',
  'Cost: Healthy State': 'Cost Healthy State',
  'Cost: Disease State': 'Cost Disease State',
  'Cost: Death State': 'Cost Dead State',
  'Utility: Healthy State': 'Utility Healthy State',
  'Utility: Disease State': 'Utility Disease State',
  'Utility: Death State': 'Utility Dead State',
  'Number of Cycles': 'Number of Cycles',
  'Discount Rate': 'Annual Discount Rate',
  'Initial Cohort Healthy %': 'Initial Cohort % Healthy',
  'Initial Cohort Disease %': 'Initial Cohort % Disease',

  // Therapeutic Device / Partitioned Survival Model parameters
  'Cost Per Cycle Pre-Progression': 'Cost Per Cycle Pre-Progression',
  'Cost Per Cycle Post-Progression': 'Cost Per Cycle Post-Progression',
  'Utility Pre-Progression': 'Utility Pre-Progression',
  'Utility Post-Progression': 'Utility Post-Progression',

  // SaMD / Budget Impact Analysis parameters
  'Target Market': 'Target Market (e.g., Country Name)',
  'Target Population Size': 'Target Population Size (Total Eligible)',
  'Market Share Intervention Y1': 'Intervention Market Share Year 1 (%)',
  'Market Share Intervention Y2': 'Intervention Market Share Year 2 (%)',
  'Market Share Intervention Y3': 'Intervention Market Share Year 3 (%)',
  'Market Share Comparator Y1': 'Comparator Market Share Year 1 (%)',
  'Market Share Comparator Y2': 'Comparator Market Share Year 2 (%)',
  'Market Share Comparator Y3': 'Comparator Market Share Year 3 (%)',
  'Annual Cost Intervention Per Patient': 'Annual Cost of Intervention per Patient',
  'Annual Cost Comparator Per Patient': 'Annual Cost of Comparator per Patient',
  'Number of Years Assessment': 'Number of Years for BIA Assessment (1-5)',

  // Direct mappings for Markov Chain parameters that should not be converted
  // These are the exact parameter names expected by the Markov model
  'Annual Discount Rate': 'Annual Discount Rate',
};

/**
 * Reverse map from template parameter names to defaults library names
 */
const TEMPLATE_TO_DEFAULTS_MAP: Record<string, string> = Object.entries(
  DEFAULTS_TO_TEMPLATE_MAP
).reduce((acc, [defaultsName, templateName]) => {
  acc[normalizeParameterName(templateName)] = defaultsName;
  return acc;
}, {} as Record<string, string>);

/**
 * Find the best matching defaults parameter name for a template parameter name
 * Uses fuzzy matching if exact match not found
 */
export function findDefaultsParameterName(templateParamName: string): string | null {
  const normalized = normalizeParameterName(templateParamName);
  
  // Try exact match first
  if (TEMPLATE_TO_DEFAULTS_MAP[normalized]) {
    return TEMPLATE_TO_DEFAULTS_MAP[normalized];
  }

  // Try fuzzy matching - find the closest match
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [key, value] of Object.entries(TEMPLATE_TO_DEFAULTS_MAP)) {
    const score = calculateSimilarity(normalized, key);
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = value;
    }
  }

  return bestMatch;
}

/**
 * Find the best matching template parameter name for a defaults parameter name
 * Returns the same name if it's already a valid template parameter name
 */
export function findTemplateParameterName(defaultsParamName: string): string | null {
  // First check if the parameter name is already in the correct template format
  if (isTemplateParameter(defaultsParamName)) {
    return defaultsParamName;
  }

  // Then try direct mapping
  return DEFAULTS_TO_TEMPLATE_MAP[defaultsParamName] || null;
}

/**
 * Calculate similarity between two normalized strings (0-1)
 * Uses Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = getLevenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function getLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Get all parameter names from defaults library
 */
export function getAllDefaultsParameterNames(): string[] {
  return Object.keys(DEFAULTS_TO_TEMPLATE_MAP);
}

/**
 * Get all parameter names from templates
 */
export function getAllTemplateParameterNames(): string[] {
  return Object.values(DEFAULTS_TO_TEMPLATE_MAP);
}

/**
 * Check if a parameter name exists in the defaults library
 */
export function isDefaultsParameter(paramName: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULTS_TO_TEMPLATE_MAP, paramName);
}

/**
 * Check if a parameter name exists in the templates
 */
export function isTemplateParameter(paramName: string): boolean {
  return Object.values(DEFAULTS_TO_TEMPLATE_MAP).includes(paramName);
}

/**
 * Get mapping statistics for debugging
 */
export function getMappingStats(): {
  totalMappings: number;
  defaultsParameters: number;
  templateParameters: number;
} {
  return {
    totalMappings: Object.keys(DEFAULTS_TO_TEMPLATE_MAP).length,
    defaultsParameters: Object.keys(DEFAULTS_TO_TEMPLATE_MAP).length,
    templateParameters: Object.values(DEFAULTS_TO_TEMPLATE_MAP).length,
  };
}
