import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// Standard document packages
const STANDARD_PACKAGES = [
  {
    name: 'Purchase Package',
    description: 'Standard documents required for a purchase loan',
    isStandard: true,
    documents: [
      { name: 'Proof of Income (Pay Stubs)', category: 'INCOME' },
      { name: 'W-2 Forms (Last 2 Years)', category: 'INCOME' },
      { name: 'Bank Statements (Last 2 Months)', category: 'ASSETS' },
      { name: 'Employment Verification', category: 'EMPLOYMENT' },
      { name: 'ID (Driver License or Passport)', category: 'OTHER' },
      { name: 'Purchase Agreement', category: 'PROPERTY' },
      { name: 'Homeowners Insurance', category: 'INSURANCE' },
    ],
  },
  {
    name: 'Refinance Package',
    description: 'Standard documents required for a refinance',
    isStandard: true,
    documents: [
      { name: 'Proof of Income (Pay Stubs)', category: 'INCOME' },
      { name: 'W-2 Forms (Last 2 Years)', category: 'INCOME' },
      { name: 'Bank Statements (Last 2 Months)', category: 'ASSETS' },
      { name: 'Employment Verification', category: 'EMPLOYMENT' },
      { name: 'Current Mortgage Statement', category: 'PROPERTY' },
      { name: 'Homeowners Insurance', category: 'INSURANCE' },
      { name: 'Property Tax Bill', category: 'PROPERTY' },
    ],
  },
  {
    name: 'Pre-Approval Package',
    description: 'Documents needed for pre-approval',
    isStandard: true,
    documents: [
      { name: 'Proof of Income (Pay Stubs)', category: 'INCOME' },
      { name: 'W-2 Forms (Last 2 Years)', category: 'INCOME' },
      { name: 'Bank Statements (Last 2 Months)', category: 'ASSETS' },
      { name: 'Employment Verification', category: 'EMPLOYMENT' },
      { name: 'ID (Driver License or Passport)', category: 'OTHER' },
    ],
  },
  {
    name: 'Closing Package',
    description: 'Final documents required for closing',
    isStandard: true,
    documents: [
      { name: 'Final Closing Disclosure', category: 'PROPERTY' },
      { name: 'Homeowners Insurance Policy', category: 'INSURANCE' },
      { name: 'Title Insurance', category: 'PROPERTY' },
      { name: 'Property Survey', category: 'PROPERTY' },
      { name: 'Termite Inspection (if applicable)', category: 'PROPERTY' },
    ],
  },
];

// GET /api/document-packages - Get all document packages
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const packages = await prisma.documentPackage.findMany({
      orderBy: { createdAt: 'asc' },
    });

    res.json(packages);
  } catch (error) {
    console.error('Error fetching document packages:', error);
    res.status(500).json({ error: 'Failed to fetch document packages' });
  }
});

// POST /api/document-packages/assign - Assign a package to a client
router.post('/assign', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, packageId } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (!clientId || !packageId) {
      return res.status(400).json({ error: 'clientId and packageId are required' });
    }

    // Check if user has access to this client
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && client.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get the document package
    const documentPackage = await prisma.documentPackage.findUnique({
      where: { id: packageId },
    });

    if (!documentPackage) {
      return res.status(404).json({ error: 'Document package not found' });
    }

    // Parse the documents JSON
    const packageDocuments = JSON.parse(documentPackage.documents);

    // Create document records for each document in the package
    const createdDocuments = await Promise.all(
      packageDocuments.map((doc: any) =>
        prisma.document.create({
          data: {
            clientId,
            name: doc.name,
            fileName: '',
            filePath: '',
            fileSize: 0,
            mimeType: 'application/octet-stream',
            status: 'REQUIRED',
            category: doc.category || 'OTHER',
            notes: `Required for ${documentPackage.name}`,
          },
        })
      )
    );

    // Log activity
    await prisma.activity.create({
      data: {
        clientId,
        type: 'PACKAGE_ASSIGNED',
        description: `${documentPackage.name} assigned (${createdDocuments.length} documents)`,
        userId,
      },
    });

    res.status(201).json({
      message: 'Document package assigned successfully',
      documents: createdDocuments,
      package: documentPackage,
    });
  } catch (error) {
    console.error('Error assigning document package:', error);
    res.status(500).json({ error: 'Failed to assign document package' });
  }
});

// POST /api/document-packages/seed - Seed standard packages (for initial setup)
router.post('/seed', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user!.role;

    // Only admin can seed packages
    if (userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if packages already exist
    const existingCount = await prisma.documentPackage.count();
    if (existingCount > 0) {
      return res.status(400).json({ error: 'Standard packages already exist' });
    }

    // Create standard packages
    const createdPackages = await Promise.all(
      STANDARD_PACKAGES.map((pkg) =>
        prisma.documentPackage.create({
          data: {
            name: pkg.name,
            description: pkg.description,
            isStandard: pkg.isStandard,
            documents: JSON.stringify(pkg.documents),
          },
        })
      )
    );

    res.status(201).json({
      message: 'Standard document packages created successfully',
      packages: createdPackages,
    });
  } catch (error) {
    console.error('Error seeding document packages:', error);
    res.status(500).json({ error: 'Failed to seed document packages' });
  }
});

export default router;
