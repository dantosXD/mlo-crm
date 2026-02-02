import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/communication-templates - List communication templates with filtering
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      category,
      is_active,
      search,
      page = '1',
      limit = '50'
    } = req.query;

    // Build where clause
    const where: any = {};

    // Filter by type
    if (type) {
      const validTypes = ['EMAIL', 'SMS', 'LETTER'];
      if (validTypes.includes(type as string)) {
        where.type = type as string;
      } else {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Type must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    // Filter by category
    if (category) {
      where.category = category as string;
    }

    // Filter by active status
    if (is_active !== undefined) {
      where.isActive = is_active === 'true';
    }

    // Search in name and subject
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { subject: { contains: search as string } },
      ];
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [templates, total] = await Promise.all([
      prisma.communicationTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.communicationTemplate.count({ where }),
    ]);

    // Parse JSON fields
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      type: template.type,
      category: template.category,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));

    res.json({
      data: formattedTemplates,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching communication templates:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch communication templates',
    });
  }
});

// GET /api/communication-templates/meta/types - Get available template types
router.get('/meta/types', async (_req: AuthRequest, res: Response) => {
  try {
    const types = [
      {
        value: 'EMAIL',
        label: 'Email',
        description: 'Email communication template',
        hasSubject: true,
      },
      {
        value: 'SMS',
        label: 'SMS',
        description: 'SMS/text message template',
        hasSubject: false,
      },
      {
        value: 'LETTER',
        label: 'Letter',
        description: 'Printed letter template',
        hasSubject: true,
      },
    ];

    res.json({ data: types });
  } catch (error) {
    console.error('Error fetching template types:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch template types',
    });
  }
});

// GET /api/communication-templates/meta/categories - Get available template categories
router.get('/meta/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = [
      { value: 'WELCOME', label: 'Welcome', description: 'New client welcome messages' },
      { value: 'FOLLOWUP', label: 'Follow Up', description: 'Follow up communications' },
      { value: 'REMINDER', label: 'Reminder', description: 'Payment and document reminders' },
      { value: 'STATUS_UPDATE', label: 'Status Update', description: 'Loan status updates' },
      { value: 'DOCUMENT_REQUEST', label: 'Document Request', description: 'Request documents from clients' },
      { value: 'APPOINTMENT', label: 'Appointment', description: 'Appointment scheduling and confirmations' },
      { value: 'CLOSING', label: 'Closing', description: 'Closing and finalization messages' },
      { value: 'THANK_YOU', label: 'Thank You', description: 'Thank you messages' },
      { value: 'OTHER', label: 'Other', description: 'Other communications' },
    ];

    res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch template categories',
    });
  }
});

// GET /api/communication-templates/meta/placeholders - Get available placeholder variables
router.get('/meta/placeholders', async (_req: AuthRequest, res: Response) => {
  try {
    const placeholders = [
      { value: 'client_name', label: 'Client Name', description: 'Full name of the client' },
      { value: 'client_email', label: 'Client Email', description: 'Email address of the client' },
      { value: 'client_phone', label: 'Client Phone', description: 'Phone number of the client' },
      { value: 'loan_officer_name', label: 'Loan Officer Name', description: 'Name of the loan officer' },
      { value: 'loan_officer_email', label: 'Loan Officer Email', description: 'Email of the loan officer' },
      { value: 'loan_officer_phone', label: 'Loan Officer Phone', description: 'Phone number of the loan officer' },
      { value: 'loan_amount', label: 'Loan Amount', description: 'Loan amount' },
      { value: 'property_address', label: 'Property Address', description: 'Property address' },
      { value: 'due_date', label: 'Due Date', description: 'Document due date' },
      { value: 'document_name', label: 'Document Name', description: 'Name of the document' },
      { value: 'current_date', label: 'Current Date', description: 'Today\'s date' },
      { value: 'company_name', label: 'Company Name', description: 'Your company name' },
    ];

    res.json({ data: placeholders });
  } catch (error) {
    console.error('Error fetching placeholder variables:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch placeholder variables',
    });
  }
});

// GET /api/communication-templates/:id - Get single communication template
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const template = await prisma.communicationTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication template not found',
      });
    }

    res.json({
      id: template.id,
      name: template.name,
      type: template.type,
      category: template.category,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching communication template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch communication template',
    });
  }
});

// POST /api/communication-templates - Create new communication template (ADMIN, MANAGER only)
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      type,
      category,
      subject,
      body,
      placeholders,
      isActive
    } = req.body;

    // Validation
    if (!name || !type || !body) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name, type, and body are required',
      });
    }

    // Validate type
    const validTypes = ['EMAIL', 'SMS', 'LETTER'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Type must be one of: ${validTypes.join(', ')}`,
      });
    }

    // For EMAIL and LETTER, subject is required
    if ((type === 'EMAIL' || type === 'LETTER') && !subject) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Subject is required for EMAIL and LETTER types',
      });
    }

    // Validate category if provided
    const validCategories = [
      'WELCOME', 'FOLLOWUP', 'REMINDER', 'STATUS_UPDATE',
      'DOCUMENT_REQUEST', 'APPOINTMENT', 'CLOSING', 'THANK_YOU', 'OTHER'
    ];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Category must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Validate placeholders array if provided
    if (placeholders && !Array.isArray(placeholders)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Placeholders must be an array',
      });
    }

    // Create template
    const template = await prisma.communicationTemplate.create({
      data: {
        name,
        type,
        category: category || null,
        subject: subject || null,
        body,
        placeholders: placeholders && placeholders.length > 0 ? JSON.stringify(placeholders) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    res.status(201).json({
      id: template.id,
      name: template.name,
      type: template.type,
      category: template.category,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    console.error('Error creating communication template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create communication template',
    });
  }
});

// PUT /api/communication-templates/:id - Update communication template (ADMIN, MANAGER only)
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      category,
      subject,
      body,
      placeholders,
      isActive
    } = req.body;

    // Check if template exists
    const existingTemplate = await prisma.communicationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication template not found',
      });
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['EMAIL', 'SMS', 'LETTER'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Type must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    // For EMAIL and LETTER, subject is required
    const templateType = type || existingTemplate.type;
    if (
      (templateType === 'EMAIL' || templateType === 'LETTER') &&
      !subject &&
      !existingTemplate.subject
    ) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Subject is required for EMAIL and LETTER types',
      });
    }

    // Validate category if provided
    if (category) {
      const validCategories = [
        'WELCOME', 'FOLLOWUP', 'REMINDER', 'STATUS_UPDATE',
        'DOCUMENT_REQUEST', 'APPOINTMENT', 'CLOSING', 'THANK_YOU', 'OTHER'
      ];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Category must be one of: ${validCategories.join(', ')}`,
        });
      }
    }

    // Validate placeholders array if provided
    if (placeholders !== undefined && !Array.isArray(placeholders)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Placeholders must be an array',
      });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (category !== undefined) updateData.category = category;
    if (subject !== undefined) updateData.subject = subject;
    if (body !== undefined) updateData.body = body;
    if (placeholders !== undefined) {
      updateData.placeholders = placeholders && placeholders.length > 0 ? JSON.stringify(placeholders) : null;
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update template
    const template = await prisma.communicationTemplate.update({
      where: { id },
      data: updateData,
    });

    res.json({
      id: template.id,
      name: template.name,
      type: template.type,
      category: template.category,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    console.error('Error updating communication template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update communication template',
    });
  }
});

// DELETE /api/communication-templates/:id - Delete communication template (ADMIN only)
router.delete('/:id', authorizeRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const template = await prisma.communicationTemplate.findUnique({
      where: { id },
      include: {
        communications: {
          take: 1,
        },
      },
    });

    if (!template) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication template not found',
      });
    }

    // Check if template is in use
    if (template.communications && template.communications.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Cannot delete template that is in use. Deactivate it instead.',
      });
    }

    await prisma.communicationTemplate.delete({ where: { id } });

    res.json({ message: 'Communication template deleted successfully' });
  } catch (error) {
    console.error('Error deleting communication template:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete communication template',
    });
  }
});

// PATCH /api/communication-templates/:id/toggle - Toggle template active status (ADMIN, MANAGER)
router.patch('/:id/toggle', authorizeRoles('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if template exists
    const existingTemplate = await prisma.communicationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Communication template not found',
      });
    }

    // Toggle isActive status
    const template = await prisma.communicationTemplate.update({
      where: { id },
      data: {
        isActive: !existingTemplate.isActive,
      },
    });

    res.json({
      id: template.id,
      name: template.name,
      type: template.type,
      category: template.category,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders ? JSON.parse(template.placeholders) : [],
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  } catch (error) {
    console.error('Error toggling communication template status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to toggle communication template status',
    });
  }
});

export default router;
