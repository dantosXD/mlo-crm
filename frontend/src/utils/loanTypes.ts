// ── Loan Scenario Comparison Types ──────────────────────────────────────

export type LoanProgramType = 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo' | 'portfolio';
export type LoanScenarioType = 'purchase' | 'refinance';
export type LoanCategory = 'FIXED' | 'ARM';

// ── ARM Configuration ────────────────────────────────────────────────────

export interface ARMConfig {
  /** Initial fixed-rate period in years (e.g. 3, 5, 7) */
  initialPeriod: number;
  /** How often rate adjusts after initial period, in years (typically 1) */
  adjustmentPeriod: number;
  /** Max rate increase at first adjustment (e.g. 2%) */
  initialCap: number;
  /** Max rate increase per subsequent adjustment (e.g. 2%) */
  periodicCap: number;
  /** Max total rate increase over life of loan (e.g. 5%) */
  lifetimeCap: number;
  /** Index the ARM is based on (e.g. "SOFR", "1-Year Treasury") */
  indexName?: string;
  /** Margin added to index for rate calculation */
  margin?: number;
}

// ── Loan Program Template (from backend) ─────────────────────────────────

export interface LoanProgramTemplate {
  id: string;
  name: string;
  category: LoanCategory;
  termYears: number;
  defaultRate: number | null;
  armConfig: string | null; // JSON string of ARMConfig
  loanType: string;
  isActive: boolean;
  sortOrder: number;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export function parseARMConfig(json: string | null): ARMConfig | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ARMConfig;
  } catch {
    return null;
  }
}

export interface LoanProgram {
  id: string;
  name: string;
  type: LoanProgramType;
  category: LoanCategory;
  termYears: number;
  ratePercent: number;
  /** ARM configuration (null for fixed-rate loans) */
  armConfig?: ARMConfig | null;
  /** Optional reduction applied via buydown points (expressed in percentage points). */
  rateReductionPercent?: number;
  /** Effective interest rate after buydown adjustments. */
  effectiveRatePercent?: number;
  /** Cost to obtain the buydown in dollars. */
  buydownCost?: number;
  /** Mark a program as visible in comparison tables. */
  selected: boolean;
  /** Optional custom loan amount override for this specific program. */
  overrideLoanAmount?: number;
  /** Previous monthly PITI when evaluating refinance savings. */
  previousMonthlyPITI?: number;
  /** ID of the template this program was created from */
  templateId?: string;
}

export interface DebtEntry {
  id: string;
  name: string;
  monthlyPayment: number;
  balance?: number;
  willPayOff?: boolean;
}

export interface ProgramDebtSelection {
  programId: string;
  debtIds: string[];
}

export interface LoanInputs {
  scenarioType: LoanScenarioType;
  purchasePrice?: number;
  downPayment?: number;
  downPaymentPercent?: number;
  refinanceLoanAmount?: number;
  grossMonthlyIncome?: number;
  annualPropertyTax?: number;
  annualHomeInsurance?: number;
  previousMonthlyPITI?: number;
}

export interface LoanScenarioData {
  inputs: LoanInputs;
  programs: LoanProgram[];
  debts: DebtEntry[];
  programDebtSelections: ProgramDebtSelection[];
}

export interface LoanScenarioSnapshot {
  metadata: ScenarioMetadata;
  data: LoanScenarioData;
  preferredProgramId?: string | null;
}

export interface ScenarioMetadata {
  id: string;
  name: string;
  clientId: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
  version: string;
}

// ── Computed Results ─────────────────────────────────────────────────────

export interface ProgramComputedMetrics {
  programId: string;
  loanAmount: number;
  monthlyPI: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  totalMonthlyPITI: number;
  totalInterest: number;
  totalCost: number;
  effectiveRate: number;
  ltv: number;
  dti: number;
  /** Total monthly debts used in DTI computation */
  monthlyDebts: number;
  buydownBreakEvenMonths?: number;
  refinanceMonthlySavings?: number;
  /** ARM-specific: worst-case monthly P&I if rate hits lifetime cap */
  armWorstCasePI?: number;
  /** ARM-specific: worst-case total monthly PITI */
  armWorstCasePITI?: number;
  /** ARM-specific: maximum possible rate (initial + lifetime cap) */
  armMaxRate?: number;
}

// ── Backend Entity Shape ─────────────────────────────────────────────────

export interface LoanScenarioEntity {
  id: string;
  clientId: string;
  name: string;
  loanType: string;
  amount: number;
  interestRate: number;
  termYears: number;
  downPayment: number | null;
  propertyValue: number | null;
  propertyTaxes: number | null;
  homeInsurance: number | null;
  hoaFees: number | null;
  pmiRate: number | null;
  monthlyPayment: number | null;
  totalMonthlyPayment: number | null;
  totalInterest: number | null;
  loanToValue: number | null;
  debtToIncome: number | null;
  isPreferred: boolean;
  scenarioData: string | null;
  preferredProgramId: string | null;
  status: string;
  version: string;
  recommendationNotes: string | null;
  sharedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Default Factories ────────────────────────────────────────────────────

let _nextId = 1;
export function uid(): string {
  return `prog_${Date.now()}_${_nextId++}`;
}

export function createDefaultProgram(overrides?: Partial<LoanProgram>): LoanProgram {
  return {
    id: uid(),
    name: 'Conventional 30yr',
    type: 'conventional',
    category: 'FIXED',
    termYears: 30,
    ratePercent: 6.75,
    selected: true,
    ...overrides,
  };
}

/** Convert a backend LoanProgramTemplate into a LoanProgram for the scenario builder */
export function templateToProgram(template: LoanProgramTemplate, rateOverride?: number): LoanProgram {
  const armCfg = parseARMConfig(template.armConfig);
  return {
    id: uid(),
    name: template.name,
    type: template.loanType as LoanProgramType,
    category: template.category,
    termYears: template.termYears,
    ratePercent: rateOverride ?? template.defaultRate ?? 6.5,
    armConfig: armCfg,
    selected: true,
    templateId: template.id,
  };
}

export function createDefaultInputs(overrides?: Partial<LoanInputs>): LoanInputs {
  return {
    scenarioType: 'purchase',
    purchasePrice: 400000,
    downPayment: 80000,
    downPaymentPercent: 20,
    grossMonthlyIncome: 10000,
    annualPropertyTax: 4800,
    annualHomeInsurance: 1800,
    ...overrides,
  };
}

export function createDefaultScenarioData(templates?: LoanProgramTemplate[]): LoanScenarioData {
  const programs = templates && templates.length > 0
    ? templates.map(t => templateToProgram(t))
    : [
        createDefaultProgram({ name: 'Conventional 30yr Fixed', type: 'conventional', category: 'FIXED', termYears: 30, ratePercent: 6.75 }),
        createDefaultProgram({ name: 'FHA 30yr Fixed', type: 'fha', category: 'FIXED', termYears: 30, ratePercent: 6.25 }),
        createDefaultProgram({ name: 'VA 30yr Fixed', type: 'va', category: 'FIXED', termYears: 30, ratePercent: 6.0 }),
      ];

  return {
    inputs: createDefaultInputs(),
    programs,
    debts: [],
    programDebtSelections: [],
  };
}

/** Format ARM description string, e.g. "5/1 ARM (2-2-5 caps)" */
export function formatARMDescription(cfg: ARMConfig): string {
  return `${cfg.initialPeriod}/${cfg.adjustmentPeriod} ARM (${cfg.initialCap}-${cfg.periodicCap}-${cfg.lifetimeCap} caps)`;
}
