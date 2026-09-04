/**
 * export-excel — export model run results to an Excel workbook.
 *
 * Usage: npx tsx src/cli/export-excel.ts <run1.json> [run2.json ...] [--output <path>]
 *
 * Reads one or more run-record JSON files (the output of run-model.ts,
 * run-psa.ts, or run-scenarios.ts) and produces a multi-sheet .xlsx workbook.
 *
 * Each model run produces:
 *   - An "Inputs" sheet with parameter names and values.
 *   - A "Results" sheet with computed outcomes.
 *   - For Markov: a "Simulation" sheet with per-cycle state traces and
 *     live formulas referencing the Inputs sheet.
 *   - For Decision Tree: a "Calculation" sheet with intermediate steps
 *     (PPV, NPV, expected cost/utility per arm) using live formulas.
 *   - For Budget Impact: a "Calculation" sheet with per-year breakdown
 *     using live formulas.
 *   - For PSA runs: a "PSA Statistics" sheet and a "CEAC Curve" sheet.
 *   - For scenario batches: a "Scenario Comparison" sheet.
 *
 * The library API (src/index.ts) remains zero-dependency; xlsx is a
 * devDependency used only by this CLI entry point.
 */
import { writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

import { fail, readJsonInput } from './shared';

const usage = `Usage: npx tsx src/cli/export-excel.ts <run1.json> [run2.json ...] [--output <path>]
Each input file is a JSON run record from run-model.ts, run-psa.ts, or run-scenarios.ts.
--output <path>  Output file path (default: heor-export.xlsx).`;

interface RunRecord {
  engine?: string;
  kind?: string;
  model?: string;
  modelType?: string;
  generatedAt?: string;
  inputs?: Record<string, unknown>;
  results?: Record<string, unknown>;
  psaConfig?: Record<string, unknown>;
  result?: Record<string, unknown>;
  deviceClass?: string;
}

function col(n: number): string {
  let s = '';
  let i = n;
  while (i >= 0) {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

function aoa(headers: string[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  return ws;
}

function setCell(ws: XLSX.WorkSheet, addr: string, v: unknown, formula?: string): void {
  const cell: XLSX.CellObject = { t: typeof v === 'number' ? 'n' : 's', v: v as XLSX.CellObject['v'] };
  if (formula) cell.f = formula;
  ws[addr] = cell;
  if (!ws['!ref']) ws['!ref'] = 'A1:A1';
  const range = XLSX.utils.decode_range(ws['!ref']);
  const addr_decoded = XLSX.utils.decode_cell(addr);
  if (range.s.c > addr_decoded.c) range.s.c = addr_decoded.c;
  if (range.s.r > addr_decoded.r) range.s.r = addr_decoded.r;
  if (range.e.c < addr_decoded.c) range.e.c = addr_decoded.c;
  if (range.e.r < addr_decoded.r) range.e.r = addr_decoded.r;
  ws['!ref'] = XLSX.utils.encode_range(range);
}

function buildInputsSheet(inputs: Record<string, unknown>, sheetName: string, prefix: string): { ws: XLSX.WorkSheet; paramMap: Record<string, string> } {
  const ws = aoa(['Parameter', 'Value']);
  ws['!cols'] = [{ wch: 45 }, { wch: 20 }];
  const paramMap: Record<string, string> = {};
  let row = 2;
  for (const [key, value] of Object.entries(inputs)) {
    const addr = `B${row}`;
    setCell(ws, `A${row}`, key);
    setCell(ws, addr, typeof value === 'number' ? value : String(value ?? ''), typeof value === 'number' ? undefined : undefined);
    paramMap[key] = `${prefix}!${addr}`;
    row++;
  }
  return { ws, paramMap };
}

function buildDecisionTreeSheets(wb: XLSX.WorkBook, run: RunRecord): void {
  const inputs = run.inputs ?? {};
  const results = run.results ?? {};

  const { ws: wsInputs, paramMap } = buildInputsSheet(inputs, 'DT_Inputs', "'DT_Inputs'");

  // Calculation sheet with intermediate steps and live formulas
  const wsCalc = aoa(['Step', 'Value']);
  wsCalc['!cols'] = [{ wch: 45 }, { wch: 20 }];
  const p = paramMap;
  let row = 2;

  // Intervention arm
  setCell(wsCalc, `A${row}`, 'Intervention Arm');
  setCell(wsCalc, `B${row}`, '');
  row++;
  const dtIntStart = row;

  setCell(wsCalc, `A${row}`, '  P(test+|disease)');
  setCell(wsCalc, `B${row}`, 0, `=${p['sensitivityInterventionTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test-|disease)');
  setCell(wsCalc, `B${row}`, 0, `=1-${p['sensitivityInterventionTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test+|no disease)');
  setCell(wsCalc, `B${row}`, 0, `=1-${p['specificityInterventionTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test-|no disease)');
  setCell(wsCalc, `B${row}`, 0, `=${p['specificityInterventionTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test+)');
  setCell(wsCalc, `B${row}`, 0, `=${p['prevalenceDisease']}*B${dtIntStart}+(1-${p['prevalenceDisease']})*B${dtIntStart + 2}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test-)');
  setCell(wsCalc, `B${row}`, 0, `=${p['prevalenceDisease']}*B${dtIntStart + 1}+(1-${p['prevalenceDisease']})*B${dtIntStart + 3}`);
  row++;
  setCell(wsCalc, `A${row}`, '  PPV');
  setCell(wsCalc, `B${row}`, 0, `=IF(B${dtIntStart + 4}>0, ${p['prevalenceDisease']}*B${dtIntStart}/B${dtIntStart + 4}, 0)`);
  row++;
  setCell(wsCalc, `A${row}`, '  NPV');
  setCell(wsCalc, `B${row}`, 0, `=IF(B${dtIntStart + 5}>0, ${p['prevalenceDisease']}*B${dtIntStart + 1}/B${dtIntStart + 5}, 0)`);
  row++;
  const intPPV = dtIntStart + 6;
  const intNPV = dtIntStart + 7;
  const intPpos = dtIntStart + 4;
  const intPneg = dtIntStart + 5;

  setCell(wsCalc, `A${row}`, '  Expected Cost');
  setCell(wsCalc, `B${row}`, 0,
    `=${p['costInterventionTest']}+B${intPpos}*(B${intPPV}*${p['costTreatmentCorrectPositive']}+(1-B${intPPV})*${p['costFalsePositiveManagement']})+B${intPneg}*(B${intNPV}*${p['costFalseNegativeConsequence']}+(1-B${intNPV})*${p['costCorrectNegativeManagement']})`);
  const intCost = row;
  row++;
  setCell(wsCalc, `A${row}`, '  Expected Utility');
  setCell(wsCalc, `B${row}`, 0,
    `=B${intPpos}*(B${intPPV}*${p['utilityTreatmentCorrectPositive']}+(1-B${intPPV})*${p['utilityFalsePositiveState']})+B${intPneg}*(B${intNPV}*${p['utilityFalseNegativeState']}+(1-B${intNPV})*${p['utilityCorrectNegativeState']})`);
  const intUtil = row;
  row++;

  // Comparator arm
  setCell(wsCalc, `A${row}`, 'Comparator Arm');
  setCell(wsCalc, `B${row}`, '');
  row++;
  const dtCompStart = row;

  setCell(wsCalc, `A${row}`, '  P(test+|disease)');
  setCell(wsCalc, `B${row}`, 0, `=${p['sensitivityComparatorTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test-|disease)');
  setCell(wsCalc, `B${row}`, 0, `=1-${p['sensitivityComparatorTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test+|no disease)');
  setCell(wsCalc, `B${row}`, 0, `=1-${p['specificityComparatorTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test-|no disease)');
  setCell(wsCalc, `B${row}`, 0, `=${p['specificityComparatorTest']}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test+)');
  setCell(wsCalc, `B${row}`, 0, `=${p['prevalenceDisease']}*B${dtCompStart}+(1-${p['prevalenceDisease']})*B${dtCompStart + 2}`);
  row++;
  setCell(wsCalc, `A${row}`, '  P(test-)');
  setCell(wsCalc, `B${row}`, 0, `=${p['prevalenceDisease']}*B${dtCompStart + 1}+(1-${p['prevalenceDisease']})*B${dtCompStart + 3}`);
  row++;
  setCell(wsCalc, `A${row}`, '  PPV');
  setCell(wsCalc, `B${row}`, 0, `=IF(B${dtCompStart + 4}>0, ${p['prevalenceDisease']}*B${dtCompStart}/B${dtCompStart + 4}, 0)`);
  row++;
  setCell(wsCalc, `A${row}`, '  NPV');
  setCell(wsCalc, `B${row}`, 0, `=IF(B${dtCompStart + 5}>0, ${p['prevalenceDisease']}*B${dtCompStart + 1}/B${dtCompStart + 5}, 0)`);
  row++;
  const compPPV = dtCompStart + 6;
  const compNPV = dtCompStart + 7;
  const compPpos = dtCompStart + 4;
  const compPneg = dtCompStart + 5;

  setCell(wsCalc, `A${row}`, '  Expected Cost');
  setCell(wsCalc, `B${row}`, 0,
    `=${p['costComparatorTest']}+B${compPpos}*(B${compPPV}*${p['costTreatmentCorrectPositive']}+(1-B${compPPV})*${p['costFalsePositiveManagement']})+B${compPneg}*(B${compNPV}*${p['costFalseNegativeConsequence']}+(1-B${compNPV})*${p['costCorrectNegativeManagement']})`);
  const compCost = row;
  row++;
  setCell(wsCalc, `A${row}`, '  Expected Utility');
  setCell(wsCalc, `B${row}`, 0,
    `=B${compPpos}*(B${compPPV}*${p['utilityTreatmentCorrectPositive']}+(1-B${compPPV})*${p['utilityFalsePositiveState']})+B${compPneg}*(B${compNPV}*${p['utilityFalseNegativeState']}+(1-B${compNPV})*${p['utilityCorrectNegativeState']})`);
  const compUtil = row;
  row++;

  // Results
  setCell(wsCalc, `A${row}`, 'Results');
  setCell(wsCalc, `B${row}`, '');
  row++;
  setCell(wsCalc, `A${row}`, '  Incremental Cost');
  setCell(wsCalc, `B${row}`, 0, `=B${intCost}-B${compCost}`);
  row++;
  setCell(wsCalc, `A${row}`, '  Incremental Utility');
  setCell(wsCalc, `B${row}`, 0, `=B${intUtil}-B${compUtil}`);
  row++;
  setCell(wsCalc, `A${row}`, '  ICER');
  setCell(wsCalc, `B${row}`, 0, `=IF(B${row - 1}=0, "N/A", B${row - 2}/B${row - 1})`);
  row++;

  XLSX.utils.book_append_sheet(wb, wsInputs, 'DT_Inputs');
  XLSX.utils.book_append_sheet(wb, wsCalc, 'DT_Calculation');

  // Engine-computed results sheet (for verification)
  const wsResults = aoa(['Metric', 'Engine Value']);
  wsResults['!cols'] = [{ wch: 35 }, { wch: 20 }];
  const dtResults = results as Record<string, unknown>;
  if (dtResults.interventionArm) {
    setCell(wsResults, 'A2', 'Intervention: Expected Cost');
    setCell(wsResults, 'B2', (dtResults.interventionArm as any).expectedCost);
    setCell(wsResults, 'A3', 'Intervention: Expected Utility');
    setCell(wsResults, 'B3', (dtResults.interventionArm as any).expectedUtility);
    setCell(wsResults, 'A4', 'Comparator: Expected Cost');
    setCell(wsResults, 'B4', (dtResults.comparatorArm as any).expectedCost);
    setCell(wsResults, 'A5', 'Comparator: Expected Utility');
    setCell(wsResults, 'B5', (dtResults.comparatorArm as any).expectedUtility);
  }
  setCell(wsResults, 'A6', 'Incremental Cost');
  setCell(wsResults, 'B6', dtResults.incrementalCost);
  setCell(wsResults, 'A7', 'Incremental Utility');
  setCell(wsResults, 'B7', dtResults.incrementalUtility);
  setCell(wsResults, 'A8', 'ICER');
  setCell(wsResults, 'B8', typeof dtResults.icer === 'number' ? dtResults.icer : String(dtResults.icer));
  XLSX.utils.book_append_sheet(wb, wsResults, 'DT_EngineResults');
}

function buildMarkovSheets(wb: XLSX.WorkBook, run: RunRecord): void {
  const inputs = run.inputs ?? {};
  const results = run.results ?? {};

  const { ws: wsInputs, paramMap } = buildInputsSheet(inputs, 'Markov_Inputs', "'Markov_Inputs'");
  const p = paramMap;

  // Simulation sheet with per-cycle state traces and live formulas
  const wsSim = aoa(['Cycle', 'Healthy', 'Disease', 'Dead', 'Cycle Cost', 'Cycle QALYs', 'Discounted Cost', 'Discounted QALYs']);
  wsSim['!cols'] = Array(8).fill({ wch: 15 });

  const stateTrace = (results as any).stateTrace as Array<{ cycle: number; healthy: number; disease: number; dead: number }> | undefined;
  const numCycles = Number(inputs['Number of Cycles'] ?? stateTrace?.length ?? 0);
  const startRow = 2;

  // Cycle 0 (initial state)
  setCell(wsSim, 'A2', 0);
  setCell(wsSim, 'B2', 0, `=${p['Initial Cohort % Healthy']}`);
  setCell(wsSim, 'C2', 0, `=${p['Initial Cohort % Disease']}`);
  setCell(wsSim, 'D2', 0, `=1-B2-C2`);

  for (let i = 1; i <= numCycles; i++) {
    const row = startRow + i;
    const prev = row - 1;
    setCell(wsSim, `A${row}`, i);
    setCell(wsSim, `B${row}`, 0, `=B${prev}*${p['Prob Healthy to Healthy']}+C${prev}*${p['Prob Disease to Healthy']}`);
    setCell(wsSim, `C${row}`, 0, `=B${prev}*${p['Prob Healthy to Disease']}+C${prev}*${p['Prob Disease to Disease']}`);
    setCell(wsSim, `D${row}`, 0, `=D${prev}+B${prev}*${p['Prob Healthy to Dead']}+C${prev}*${p['Prob Disease to Dead']}`);
    setCell(wsSim, `E${row}`, 0, `=B${row}*${p['Cost Healthy State']}+C${row}*${p['Cost Disease State']}+D${row}*${p['Cost Dead State']}`);
    setCell(wsSim, `F${row}`, 0, `=B${row}*${p['Utility Healthy State']}+C${row}*${p['Utility Disease State']}+D${row}*${p['Utility Dead State']}`);
    setCell(wsSim, `G${row}`, 0, `=E${row}/(1+${p['Annual Discount Rate']})^A${row}`);
    setCell(wsSim, `H${row}`, 0, `=F${row}/(1+${p['Annual Discount Rate']})^A${row}`);
  }

  const totalRow = startRow + numCycles + 1;
  setCell(wsSim, `F${totalRow}`, 'Total:');
  setCell(wsSim, `G${totalRow}`, 0, `=SUM(G${startRow + 1}:G${startRow + numCycles})`);
  setCell(wsSim, `H${totalRow}`, 0, `=SUM(H${startRow + 1}:H${startRow + numCycles})`);

  XLSX.utils.book_append_sheet(wb, wsInputs, 'Markov_Inputs');
  XLSX.utils.book_append_sheet(wb, wsSim, 'Markov_Simulation');

  // Engine results sheet
  const wsResults = aoa(['Metric', 'Engine Value']);
  wsResults['!cols'] = [{ wch: 35 }, { wch: 20 }];
  setCell(wsResults, 'A2', 'Total Discounted Cost');
  setCell(wsResults, 'B2', (results as any).totalDiscountedCost);
  setCell(wsResults, 'A3', 'Total Discounted QALYs');
  setCell(wsResults, 'B3', (results as any).totalDiscountedQALYs);
  XLSX.utils.book_append_sheet(wb, wsResults, 'Markov_EngineResults');
}

function buildBIASheets(wb: XLSX.WorkBook, run: RunRecord): void {
  const inputs = run.inputs ?? {};
  const results = run.results ?? {};

  const { ws: wsInputs, paramMap } = buildInputsSheet(inputs, 'BIA_Inputs', "'BIA_Inputs'");
  const p = paramMap;

  // Calculation sheet with per-year breakdown and live formulas
  const wsCalc = aoa(['Year', 'Intervention Patients', 'Comparator Patients', 'Intervention Cost', 'Displaced Comparator Cost', 'Net Budget Impact']);
  wsCalc['!cols'] = Array(6).fill({ wch: 25 });

  const numYears = Number(inputs['Number of Years for BIA Assessment (1-5)'] ?? (results as any).numYears ?? 0);

  for (let i = 1; i <= numYears; i++) {
    const row = i + 1;
    setCell(wsCalc, `A${row}`, i);
    const msIntKey = i <= 3 ? `marketShareInterventionY${i}` : `marketShareInterventionY3`;
    const msCompKey = i <= 3 ? `marketShareComparatorY${i}` : `marketShareComparatorY3`;
    setCell(wsCalc, `B${row}`, 0, `=${p['Target Population Size (Total Eligible)']}*${p[msIntKey]}/100`);
    setCell(wsCalc, `C${row}`, 0, `=${p['Target Population Size (Total Eligible)']}*${p[msCompKey]}/100`);
    setCell(wsCalc, `D${row}`, 0, `=B${row}*${p['Annual Cost of Intervention per Patient']}`);
    setCell(wsCalc, `E${row}`, 0, `=B${row}*${p['Annual Cost of Comparator per Patient']}`);
    setCell(wsCalc, `F${row}`, 0, `=D${row}-E${row}`);
  }

  const totalRow = numYears + 2;
  setCell(wsCalc, `E${totalRow}`, 'Total Net Impact:');
  setCell(wsCalc, `F${totalRow}`, 0, `=SUM(F2:F${numYears + 1})`);

  XLSX.utils.book_append_sheet(wb, wsInputs, 'BIA_Inputs');
  XLSX.utils.book_append_sheet(wb, wsCalc, 'BIA_Calculation');

  // Engine results sheet
  const wsResults = aoa(['Metric', 'Engine Value']);
  wsResults['!cols'] = [{ wch: 35 }, { wch: 20 }];
  setCell(wsResults, 'A2', 'Total Net Budget Impact');
  setCell(wsResults, 'B2', (results as any).totalNetBudgetImpact);
  setCell(wsResults, 'A3', 'Target Market');
  setCell(wsResults, 'B3', String((results as any).targetMarket ?? ''));
  setCell(wsResults, 'A4', 'Number of Years');
  setCell(wsResults, 'B4', (results as any).numYears);
  XLSX.utils.book_append_sheet(wb, wsResults, 'BIA_EngineResults');
}

function buildGenericSheets(wb: XLSX.WorkBook, run: RunRecord): void {
  const modelSlug = run.model ?? 'model';
  const prefix = modelSlug.replace(/[^A-Za-z0-9]/g, '_');
  const inputs = run.inputs ?? {};
  const results = run.results ?? {};

  const { ws: wsInputs } = buildInputsSheet(inputs, `${prefix}_Inputs`, `'${prefix}_Inputs'`);
  XLSX.utils.book_append_sheet(wb, wsInputs, `${prefix}_Inputs`);

  // Results as a flat key-value sheet
  const wsResults = aoa(['Metric', 'Value']);
  wsResults['!cols'] = [{ wch: 35 }, { wch: 20 }];
  let row = 2;
  for (const [key, value] of Object.entries(results)) {
    if (value !== null && typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        setCell(wsResults, `A${row}`, `${key}.${subKey}`);
        setCell(wsResults, `B${row}`, typeof subValue === 'number' ? subValue : String(subValue ?? ''));
        row++;
      }
    } else {
      setCell(wsResults, `A${row}`, key);
      setCell(wsResults, `B${row}`, typeof value === 'number' ? value : String(value ?? ''));
      row++;
    }
  }
  XLSX.utils.book_append_sheet(wb, wsResults, `${prefix}_Results`);
}

function buildPSASheets(wb: XLSX.WorkBook, run: RunRecord): void {
  const psaResult = run.result ?? (run.results as any);
  if (!psaResult || typeof psaResult !== 'object') return;

  // Statistics sheet
  const wsStats = aoa(['Statistic', 'Value']);
  wsStats['!cols'] = [{ wch: 35 }, { wch: 20 }];
  const stats = (psaResult as any).statistics;
  if (stats) {
    let row = 2;
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value === 'object' && value !== null) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          setCell(wsStats, `A${row}`, `${key}.${subKey}`);
          setCell(wsStats, `B${row}`, typeof subValue === 'number' ? subValue : String(subValue ?? ''));
          row++;
        }
      } else {
        setCell(wsStats, `A${row}`, key);
        setCell(wsStats, `B${row}`, typeof value === 'number' ? value : String(value ?? ''));
        row++;
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsStats, 'PSA_Statistics');

  // CEAC curve sheet
  const ceac = (psaResult as any).ceacCurve;
  if (Array.isArray(ceac) && ceac.length > 0) {
    const wsCeac = aoa(['WTP Threshold', 'P(Cost-Effective)']);
    wsCeac['!cols'] = [{ wch: 20 }, { wch: 20 }];
    ceac.forEach((point: any, i: number) => {
      setCell(wsCeac, `A${i + 2}`, point.wtpThreshold ?? point.wtp);
      setCell(wsCeac, `B${i + 2}`, point.probability ?? point.probCostEffective);
    });
    XLSX.utils.book_append_sheet(wb, wsCeac, 'PSA_CEAC');
  }

  // Tornado diagram sheet
  const tornado = (psaResult as any).tornadoDiagram;
  if (Array.isArray(tornado) && tornado.length > 0) {
    const wsTornado = aoa(['Parameter', 'Low Value', 'High Value', 'Low ICER', 'High ICER', '% Impact']);
    wsTornado['!cols'] = Array(6).fill({ wch: 20 });
    tornado.forEach((param: any, i: number) => {
      setCell(wsTornado, `A${i + 2}`, param.parameter ?? param.name);
      setCell(wsTornado, `B${i + 2}`, param.lowValue);
      setCell(wsTornado, `C${i + 2}`, param.highValue);
      setCell(wsTornado, `D${i + 2}`, param.lowResult ?? param.lowICER);
      setCell(wsTornado, `E${i + 2}`, param.highResult ?? param.highICER);
      setCell(wsTornado, `F${i + 2}`, param.percentageImpact);
    });
    XLSX.utils.book_append_sheet(wb, wsTornado, 'PSA_Tornado');
  }
}

function buildScenarioComparisonSheet(wb: XLSX.WorkBook, run: RunRecord): void {
  const result = run.result as any;
  if (!result?.results || !Array.isArray(result.results)) return;

  // Collect all parameter names across scenarios
  const allParams = new Set<string>();
  const allMetrics = new Set<string>();
  for (const r of result.results) {
    if (r.mergedInputs) Object.keys(r.mergedInputs).forEach(k => allParams.add(k));
    if (r.baselineResult) Object.keys(r.baselineResult).forEach(k => allMetrics.add(k));
  }

  // Parameter comparison sheet
  const paramList = [...allParams];
  const wsParams = XLSX.utils.aoa_to_sheet([
    ['Parameter', ...result.results.map((r: any) => r.scenarioName ?? r.scenarioId)],
  ]);
  wsParams['!cols'] = [{ wch: 35 }, ...result.results.map(() => ({ wch: 20 }))];
  paramList.forEach((param, i) => {
    const row = i + 2;
    setCell(wsParams, `A${row}`, param);
    result.results.forEach((r: any, j: number) => {
      setCell(wsParams, `${col(j + 1)}${row}`, r.mergedInputs?.[param] ?? '');
    });
  });
  XLSX.utils.book_append_sheet(wb, wsParams, 'Scenario_Inputs');

  // Results comparison sheet
  const metricList = [...allMetrics].filter(m => m !== 'stateTrace' && m !== 'details' && m !== 'error');
  const wsMetrics = XLSX.utils.aoa_to_sheet([
    ['Metric', ...result.results.map((r: any) => r.scenarioName ?? r.scenarioId)],
  ]);
  wsMetrics['!cols'] = [{ wch: 35 }, ...result.results.map(() => ({ wch: 20 }))];
  metricList.forEach((metric, i) => {
    const row = i + 2;
    setCell(wsMetrics, `A${row}`, metric);
    result.results.forEach((r: any, j: number) => {
      const val = r.baselineResult?.[metric];
      setCell(wsMetrics, `${col(j + 1)}${row}`, typeof val === 'object' ? JSON.stringify(val) : (val ?? ''));
    });
  });

  // Aggregated metrics
  const aggStartRow = metricList.length + 3;
  setCell(wsMetrics, `A${aggStartRow}`, 'Aggregated Metrics');
  const agg = result.aggregatedMetrics;
  if (agg) {
    setCell(wsMetrics, `A${aggStartRow + 1}`, 'Average ICER');
    setCell(wsMetrics, `B${aggStartRow + 1}`, agg.averageICER);
    setCell(wsMetrics, `A${aggStartRow + 2}`, 'ICER Range (min)');
    setCell(wsMetrics, `B${aggStartRow + 2}`, agg.icer_range?.min);
    setCell(wsMetrics, `A${aggStartRow + 3}`, 'ICER Range (max)');
    setCell(wsMetrics, `B${aggStartRow + 3}`, agg.icer_range?.max);
    setCell(wsMetrics, `A${aggStartRow + 4}`, 'Avg Incremental Cost');
    setCell(wsMetrics, `B${aggStartRow + 4}`, agg.averageIncrementalCost);
    setCell(wsMetrics, `A${aggStartRow + 5}`, 'Avg Incremental Utility');
    setCell(wsMetrics, `B${aggStartRow + 5}`, agg.averageIncrementalUtility);
  }
  XLSX.utils.book_append_sheet(wb, wsMetrics, 'Scenario_Results');
}

// --- CLI --------------------------------------------------------------------

const args = process.argv.slice(2);
const files: string[] = [];
let outputPath = 'heor-export.xlsx';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output') {
    outputPath = args[i + 1] ?? fail('--output requires a path.');
    i++;
  } else {
    files.push(args[i]);
  }
}

if (files.length === 0) {
  fail(usage);
}

const wb = XLSX.utils.book_new();

for (const file of files) {
  const run = readJsonInput(file, usage) as RunRecord;

  if (run.kind === 'scenario-batch-run' || (run.result && Array.isArray((run.result as any).results))) {
    buildScenarioComparisonSheet(wb, run);
  } else if (run.kind === 'psa-run' || (run.result && (run.result as any).statistics)) {
    // First build model-specific sheets from inputs/results
    const modelSlug = run.model ?? '';
    if (modelSlug === 'decision-tree') buildDecisionTreeSheets(wb, run);
    else if (modelSlug === 'markov-chain') buildMarkovSheets(wb, run);
    else if (modelSlug === 'budget-impact') buildBIASheets(wb, run);
    else buildGenericSheets(wb, run);
    buildPSASheets(wb, run);
  } else if (run.kind === 'model-run' || run.results) {
    const modelSlug = run.model ?? '';
    if (modelSlug === 'decision-tree') buildDecisionTreeSheets(wb, run);
    else if (modelSlug === 'markov-chain') buildMarkovSheets(wb, run);
    else if (modelSlug === 'budget-impact') buildBIASheets(wb, run);
    else buildGenericSheets(wb, run);
  } else {
    fail(`Unrecognized run record format in "${file}". Expected kind: model-run, psa-run, or scenario-batch-run.`);
  }
}

if (wb.SheetNames.length === 0) {
  fail('No valid model runs found to export.');
}

XLSX.writeFile(wb, outputPath);
process.stderr.write(`Excel workbook written to ${outputPath} (${wb.SheetNames.length} sheets: ${wb.SheetNames.join(', ')})\n`);
