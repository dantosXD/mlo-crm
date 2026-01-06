import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Calculate loan scenario values
function calculateLoanScenario(data: {
  amount: number;
  interestRate: number;
  termYears: number;
  downPayment?: number;
  propertyValue?: number;
  propertyTaxes?: number;
  homeInsurance?: number;
  hoaFees?: number;
  pmiRate?: number;
}) {
  const principal = data.amount;
  const monthlyRate = data.interestRate / 100 / 12;
  const numPayments = data.termYears * 12;

  // Calculate monthly mortgage payment (P&I)
  let monthlyPayment = 0;
  if (monthlyRate > 0) {
    monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                     (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else {
    monthlyPayment = principal / numPayments;
  }

  // Calculate LTV (Loan to Value)
  let loanToValue = null;
  if (data.propertyValue && data.propertyValue > 0) {
    loanToValue = (principal / data.propertyValue) * 100;
  }

  // Calculate monthly PMI if LTV > 80%
  let monthlyPMI = 0;
  if (loanToValue && loanToValue > 80 && data.pmiRate) {
    monthlyPMI = (principal * (data.pmiRate / 100)) / 12;
  }

  // Calculate total monthly payment (PITI + HOA + PMI)
  const monthlyPropertyTaxes = (data.propertyTaxes || 0) / 12;
  const monthlyInsurance = (data.homeInsurance || 0) / 12;
  const monthlyHOA = data.hoaFees || 0;

  const totalMonthlyPayment = monthlyPayment + monthlyPropertyTaxes + monthlyInsurance + monthlyHOA + monthlyPMI;

  // Calculate total interest over life of loan
  const totalInterest = (monthlyPayment * numPayments) - principal;

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalMonthlyPayment: Math.round(totalMonthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    loanToValue: loanToValue ? Math.round(loanToValue * 100) / 100 : null,
  };
}

// GET /api/loan-scenarios - List loan scenarios (optionally filtered by client_id)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { client_id } = req.query;

    const scenarios = await prisma.loanScenario.findMany({
      where: client_id ? { clientId: client_id as string } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(scenarios);
  } catch (error) {
    console.error('Error fetching loan scenarios:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch loan scenarios',
    });
  }
});

// GET /api/loan-scenarios/:id - Get single loan scenario
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const scenario = await prisma.loanScenario.findUnique({
      where: { id },
    });

    if (!scenario) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Loan scenario not found',
      });
    }

    res.json(scenario);
  } catch (error) {
    console.error('Error fetching loan scenario:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch loan scenario',
    });
  }
});

// POST /api/loan-scenarios - Create new loan scenario
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      clientId,
      name,
      loanType,
      amount,
      interestRate,
      termYears,
      downPayment,
      propertyValue,
      propertyTaxes,
      homeInsurance,
      hoaFees,
      pmiRate,
      isPreferred,
    } = req.body;
    const userId = req.user?.userId;

    if (!clientId || !name || !loanType || !amount || !interestRate || !termYears) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Client ID, name, loan type, amount, interest rate, and term are required',
      });
    }

    // Calculate loan values
    const calculations = calculateLoanScenario({
      amount,
      interestRate,
      termYears,
      downPayment,
      propertyValue,
      propertyTaxes,
      homeInsurance,
      hoaFees,
      pmiRate,
    });

    const scenario = await prisma.loanScenario.create({
      data: {
        clientId,
        name,
        loanType,
        amount,
        interestRate,
        termYears,
        downPayment: downPayment || null,
        propertyValue: propertyValue || null,
        propertyTaxes: propertyTaxes || null,
        homeInsurance: homeInsurance || null,
        hoaFees: hoaFees || null,
        pmiRate: pmiRate || null,
        monthlyPayment: calculations.monthlyPayment,
        totalMonthlyPayment: calculations.totalMonthlyPayment,
        totalInterest: calculations.totalInterest,
        loanToValue: calculations.loanToValue,
        isPreferred: isPreferred || false,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId,
        userId: userId!,
        type: 'LOAN_SCENARIO_CREATED',
        description: `Loan scenario "${name}" created`,
      },
    });

    res.status(201).json(scenario);
  } catch (error) {
    console.error('Error creating loan scenario:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create loan scenario',
    });
  }
});

// POST /api/loan-scenarios/calculate - Calculate loan scenario without saving
router.post('/calculate', async (req: AuthRequest, res: Response) => {
  try {
    const {
      amount,
      interestRate,
      termYears,
      downPayment,
      propertyValue,
      propertyTaxes,
      homeInsurance,
      hoaFees,
      pmiRate,
    } = req.body;

    if (!amount || !interestRate || !termYears) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Amount, interest rate, and term are required',
      });
    }

    const calculations = calculateLoanScenario({
      amount,
      interestRate,
      termYears,
      downPayment,
      propertyValue,
      propertyTaxes,
      homeInsurance,
      hoaFees,
      pmiRate,
    });

    res.json(calculations);
  } catch (error) {
    console.error('Error calculating loan scenario:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to calculate loan scenario',
    });
  }
});

// PUT /api/loan-scenarios/:id - Update loan scenario
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      loanType,
      amount,
      interestRate,
      termYears,
      downPayment,
      propertyValue,
      propertyTaxes,
      homeInsurance,
      hoaFees,
      pmiRate,
      isPreferred,
    } = req.body;
    const userId = req.user?.userId;

    const existingScenario = await prisma.loanScenario.findUnique({ where: { id } });

    if (!existingScenario) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Loan scenario not found',
      });
    }

    // Calculate new loan values if amounts changed
    const calculations = calculateLoanScenario({
      amount: amount ?? existingScenario.amount,
      interestRate: interestRate ?? existingScenario.interestRate,
      termYears: termYears ?? existingScenario.termYears,
      downPayment: downPayment ?? existingScenario.downPayment ?? undefined,
      propertyValue: propertyValue ?? existingScenario.propertyValue ?? undefined,
      propertyTaxes: propertyTaxes ?? existingScenario.propertyTaxes ?? undefined,
      homeInsurance: homeInsurance ?? existingScenario.homeInsurance ?? undefined,
      hoaFees: hoaFees ?? existingScenario.hoaFees ?? undefined,
      pmiRate: pmiRate ?? existingScenario.pmiRate ?? undefined,
    });

    const scenario = await prisma.loanScenario.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(loanType !== undefined && { loanType }),
        ...(amount !== undefined && { amount }),
        ...(interestRate !== undefined && { interestRate }),
        ...(termYears !== undefined && { termYears }),
        ...(downPayment !== undefined && { downPayment }),
        ...(propertyValue !== undefined && { propertyValue }),
        ...(propertyTaxes !== undefined && { propertyTaxes }),
        ...(homeInsurance !== undefined && { homeInsurance }),
        ...(hoaFees !== undefined && { hoaFees }),
        ...(pmiRate !== undefined && { pmiRate }),
        ...(isPreferred !== undefined && { isPreferred }),
        monthlyPayment: calculations.monthlyPayment,
        totalMonthlyPayment: calculations.totalMonthlyPayment,
        totalInterest: calculations.totalInterest,
        loanToValue: calculations.loanToValue,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: scenario.clientId,
        userId: userId!,
        type: 'LOAN_SCENARIO_UPDATED',
        description: `Loan scenario "${scenario.name}" updated`,
      },
    });

    res.json(scenario);
  } catch (error) {
    console.error('Error updating loan scenario:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update loan scenario',
    });
  }
});

// PATCH /api/loan-scenarios/:id/preferred - Set as preferred scenario
router.patch('/:id/preferred', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const existingScenario = await prisma.loanScenario.findUnique({ where: { id } });

    if (!existingScenario) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Loan scenario not found',
      });
    }

    // Unset all other preferred scenarios for this client
    await prisma.loanScenario.updateMany({
      where: { clientId: existingScenario.clientId },
      data: { isPreferred: false },
    });

    // Set this one as preferred
    const scenario = await prisma.loanScenario.update({
      where: { id },
      data: { isPreferred: true },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: scenario.clientId,
        userId: userId!,
        type: 'LOAN_SCENARIO_PREFERRED',
        description: `Loan scenario "${scenario.name}" set as preferred`,
      },
    });

    res.json(scenario);
  } catch (error) {
    console.error('Error setting preferred scenario:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to set preferred scenario',
    });
  }
});

// DELETE /api/loan-scenarios/:id - Delete loan scenario
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const existingScenario = await prisma.loanScenario.findUnique({ where: { id } });

    if (!existingScenario) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Loan scenario not found',
      });
    }

    await prisma.loanScenario.delete({ where: { id } });

    // Log activity
    await prisma.activity.create({
      data: {
        clientId: existingScenario.clientId,
        userId: userId!,
        type: 'LOAN_SCENARIO_DELETED',
        description: `Loan scenario "${existingScenario.name}" deleted`,
      },
    });

    res.json({ message: 'Loan scenario deleted successfully' });
  } catch (error) {
    console.error('Error deleting loan scenario:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete loan scenario',
    });
  }
});

export default router;
