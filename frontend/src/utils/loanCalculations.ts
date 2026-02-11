import type {
  LoanProgram,
  LoanInputs,
  LoanScenarioData,
  ProgramComputedMetrics,
  DebtEntry,
  ProgramDebtSelection,
  ARMConfig,
} from './loanTypes';

const MONTHS_PER_YEAR = 12;

// ── Core Calculations ────────────────────────────────────────────────────

export const calculateMonthlyPayment = (
  principal: number,
  annualRatePercent: number,
  termYears: number,
): number => {
  if (principal <= 0 || annualRatePercent <= 0 || termYears <= 0) return 0;

  const monthlyRate = annualRatePercent / 100 / MONTHS_PER_YEAR;
  const totalPayments = termYears * MONTHS_PER_YEAR;

  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, totalPayments);
  const denominator = Math.pow(1 + monthlyRate, totalPayments) - 1;

  return denominator === 0 ? 0 : numerator / denominator;
};

export const resolveLoanAmount = (inputs: LoanInputs, program: LoanProgram): number => {
  if (program.overrideLoanAmount && program.overrideLoanAmount > 0) {
    return program.overrideLoanAmount;
  }
  if (inputs.scenarioType === 'refinance') {
    return inputs.refinanceLoanAmount ?? 0;
  }
  return (inputs.purchasePrice ?? 0) - (inputs.downPayment ?? 0);
};

export const calculatePMI = (
  loanAmount: number,
  propertyValue: number,
  programType: string,
): number => {
  // VA loans don't have PMI, FHA has MIP which is different
  if (programType === 'va') return 0;

  const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0;

  if (ltv <= 80) return 0;

  // Approximate PMI rate based on LTV
  let pmiRate = 0;
  if (programType === 'fha') {
    pmiRate = 0.85; // FHA MIP is typically 0.85%
  } else if (ltv > 95) {
    pmiRate = 1.05;
  } else if (ltv > 90) {
    pmiRate = 0.78;
  } else {
    pmiRate = 0.52;
  }

  return (loanAmount * (pmiRate / 100)) / MONTHS_PER_YEAR;
};

export const calculateLTV = (loanAmount: number, propertyValue: number): number => {
  if (propertyValue <= 0) return 0;
  return (loanAmount / propertyValue) * 100;
};

export const calculateDTI = (
  totalMonthlyPITI: number,
  monthlyDebts: number,
  grossMonthlyIncome: number,
): number => {
  if (grossMonthlyIncome <= 0) return 0;
  return ((totalMonthlyPITI + monthlyDebts) / grossMonthlyIncome) * 100;
};

export const calculateTotalInterest = (
  monthlyPayment: number,
  termYears: number,
  principal: number,
): number => {
  return monthlyPayment * termYears * MONTHS_PER_YEAR - principal;
};

export const calculateBuydownBreakEven = (
  buydownCost: number,
  monthlySavings: number,
): number | undefined => {
  if (!buydownCost || buydownCost <= 0 || !monthlySavings || monthlySavings <= 0) return undefined;
  return Math.ceil(buydownCost / monthlySavings);
};

// ── ARM-Specific Calculations ────────────────────────────────────────────

/**
 * Calculate the worst-case (maximum) monthly payment for an ARM loan.
 * This assumes the rate increases to the lifetime cap after the initial period.
 */
export const calculateARMWorstCasePayment = (
  principal: number,
  initialRatePercent: number,
  armConfig: ARMConfig,
  termYears: number,
): number => {
  const maxRate = initialRatePercent + armConfig.lifetimeCap;
  // Remaining term after initial period
  const remainingYears = termYears - armConfig.initialPeriod;
  if (remainingYears <= 0) return calculateMonthlyPayment(principal, initialRatePercent, termYears);

  // Calculate remaining balance after initial period
  const initialMonthlyRate = initialRatePercent / 100 / MONTHS_PER_YEAR;
  const initialPayments = armConfig.initialPeriod * MONTHS_PER_YEAR;
  const totalPayments = termYears * MONTHS_PER_YEAR;

  const monthlyPaymentInitial = calculateMonthlyPayment(principal, initialRatePercent, termYears);

  // Remaining balance after initial period using amortization formula
  let balance = principal;
  for (let i = 0; i < initialPayments; i++) {
    const interestPayment = balance * initialMonthlyRate;
    const principalPayment = monthlyPaymentInitial - interestPayment;
    balance -= principalPayment;
  }

  // New payment at worst-case rate for remaining term
  const remainingPayments = totalPayments - initialPayments;
  const worstMonthlyRate = maxRate / 100 / MONTHS_PER_YEAR;

  if (worstMonthlyRate <= 0 || remainingPayments <= 0) return monthlyPaymentInitial;

  const numerator = balance * worstMonthlyRate * Math.pow(1 + worstMonthlyRate, remainingPayments);
  const denominator = Math.pow(1 + worstMonthlyRate, remainingPayments) - 1;

  return denominator === 0 ? 0 : numerator / denominator;
};

/**
 * Calculate the total interest for an ARM loan assuming rate stays at initial for the fixed period,
 * then adjusts to worst-case for the remaining term. This is a conservative estimate.
 */
export const calculateARMTotalInterest = (
  principal: number,
  initialRatePercent: number,
  armConfig: ARMConfig,
  termYears: number,
): number => {
  const initialMonthlyRate = initialRatePercent / 100 / MONTHS_PER_YEAR;
  const initialPayments = armConfig.initialPeriod * MONTHS_PER_YEAR;
  const totalPayments = termYears * MONTHS_PER_YEAR;

  const monthlyPaymentInitial = calculateMonthlyPayment(principal, initialRatePercent, termYears);

  // Phase 1: initial fixed period interest
  let balance = principal;
  let totalInterest = 0;
  for (let i = 0; i < initialPayments && balance > 0; i++) {
    const interest = balance * initialMonthlyRate;
    totalInterest += interest;
    balance -= (monthlyPaymentInitial - interest);
  }

  // Phase 2: worst case remaining period
  const maxRate = initialRatePercent + armConfig.lifetimeCap;
  const worstMonthlyRate = maxRate / 100 / MONTHS_PER_YEAR;
  const remainingPayments = totalPayments - initialPayments;

  if (remainingPayments > 0 && balance > 0 && worstMonthlyRate > 0) {
    const numerator = balance * worstMonthlyRate * Math.pow(1 + worstMonthlyRate, remainingPayments);
    const denominator = Math.pow(1 + worstMonthlyRate, remainingPayments) - 1;
    const worstMonthlyPayment = denominator === 0 ? 0 : numerator / denominator;

    for (let i = 0; i < remainingPayments && balance > 0; i++) {
      const interest = balance * worstMonthlyRate;
      totalInterest += interest;
      balance -= (worstMonthlyPayment - interest);
    }
  }

  return totalInterest;
};

// ── Program Metrics Computation ──────────────────────────────────────────

export function computeProgramMetrics(
  program: LoanProgram,
  inputs: LoanInputs,
  debts: DebtEntry[],
  programDebtSelections: ProgramDebtSelection[],
): ProgramComputedMetrics {
  const loanAmount = resolveLoanAmount(inputs, program);
  const effectiveRate = program.effectiveRatePercent ?? (program.ratePercent - (program.rateReductionPercent ?? 0));
  const propertyValue = inputs.scenarioType === 'purchase'
    ? (inputs.purchasePrice ?? 0)
    : loanAmount; // For refinance, use loan amount as proxy

  // P&I
  const monthlyPI = calculateMonthlyPayment(loanAmount, effectiveRate, program.termYears);

  // Taxes & Insurance
  const monthlyPropertyTax = (inputs.annualPropertyTax ?? 0) / MONTHS_PER_YEAR;
  const monthlyInsurance = (inputs.annualHomeInsurance ?? 0) / MONTHS_PER_YEAR;

  // PMI
  const monthlyPMI = calculatePMI(loanAmount, propertyValue, program.type);

  // Total PITI
  const totalMonthlyPITI = monthlyPI + monthlyPropertyTax + monthlyInsurance + monthlyPMI;

  // Total interest over life of loan
  const totalInterest = calculateTotalInterest(monthlyPI, program.termYears, loanAmount);

  // Total cost = total payments + buydown cost
  const totalCost = monthlyPI * program.termYears * MONTHS_PER_YEAR + (program.buydownCost ?? 0);

  // LTV
  const ltv = calculateLTV(loanAmount, propertyValue);

  // Debts for this program
  const selection = programDebtSelections.find(s => s.programId === program.id);
  const selectedDebtIds = selection?.debtIds ?? debts.map(d => d.id);
  const monthlyDebts = debts
    .filter(d => selectedDebtIds.includes(d.id) && !d.willPayOff)
    .reduce((sum, d) => sum + d.monthlyPayment, 0);

  // DTI
  const dti = calculateDTI(totalMonthlyPITI, monthlyDebts, inputs.grossMonthlyIncome ?? 0);

  // Buydown break-even
  const baseMonthlyPI = calculateMonthlyPayment(loanAmount, program.ratePercent, program.termYears);
  const buydownSavings = baseMonthlyPI - monthlyPI;
  const buydownBreakEvenMonths = calculateBuydownBreakEven(program.buydownCost ?? 0, buydownSavings);

  // Refinance savings
  const refinanceMonthlySavings = inputs.scenarioType === 'refinance' && program.previousMonthlyPITI
    ? program.previousMonthlyPITI - totalMonthlyPITI
    : undefined;

  // ARM-specific metrics
  let armWorstCasePI: number | undefined;
  let armWorstCasePITI: number | undefined;
  let armMaxRate: number | undefined;

  if (program.category === 'ARM' && program.armConfig) {
    armMaxRate = round2(effectiveRate + program.armConfig.lifetimeCap);
    armWorstCasePI = round2(calculateARMWorstCasePayment(loanAmount, effectiveRate, program.armConfig, program.termYears));
    armWorstCasePITI = round2(armWorstCasePI + monthlyPropertyTax + monthlyInsurance + monthlyPMI);
  }

  return {
    programId: program.id,
    loanAmount: round2(loanAmount),
    monthlyPI: round2(monthlyPI),
    monthlyPropertyTax: round2(monthlyPropertyTax),
    monthlyInsurance: round2(monthlyInsurance),
    monthlyPMI: round2(monthlyPMI),
    totalMonthlyPITI: round2(totalMonthlyPITI),
    totalInterest: round2(totalInterest),
    totalCost: round2(totalCost),
    effectiveRate: round2(effectiveRate),
    ltv: round2(ltv),
    dti: round2(dti),
    monthlyDebts: round2(monthlyDebts),
    buydownBreakEvenMonths,
    refinanceMonthlySavings: refinanceMonthlySavings != null ? round2(refinanceMonthlySavings) : undefined,
    armWorstCasePI,
    armWorstCasePITI,
    armMaxRate,
  };
}

export function computeAllMetrics(data: LoanScenarioData): Map<string, ProgramComputedMetrics> {
  const map = new Map<string, ProgramComputedMetrics>();
  for (const prog of data.programs) {
    map.set(prog.id, computeProgramMetrics(prog, data.inputs, data.debts, data.programDebtSelections));
  }
  return map;
}

// ── Formatting Utilities ─────────────────────────────────────────────────

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyFull = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercent = (value: number, decimals = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

// ── Helpers ──────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getSelectedPrograms(programs: LoanProgram[]): LoanProgram[] {
  return programs.filter(p => p.selected);
}

export function findBestProgram(
  metrics: Map<string, ProgramComputedMetrics>,
  criterion: 'lowestPayment' | 'lowestTotalCost' | 'lowestRate' | 'lowestDTI',
): string | null {
  let bestId: string | null = null;
  let bestVal = Infinity;

  for (const [id, m] of metrics) {
    let val: number;
    switch (criterion) {
      case 'lowestPayment': val = m.totalMonthlyPITI; break;
      case 'lowestTotalCost': val = m.totalCost; break;
      case 'lowestRate': val = m.effectiveRate; break;
      case 'lowestDTI': val = m.dti; break;
    }
    if (val < bestVal) {
      bestVal = val;
      bestId = id;
    }
  }

  return bestId;
}
