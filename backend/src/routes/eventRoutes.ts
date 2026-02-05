import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/events - Get all events for the current user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { startDate, endDate, clientId, eventType } = req.query;

    const where: any = {
      createdById: userId,
      status: { not: 'CANCELLED' }
    };

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (eventType) {
      where.eventType = eventType as string;
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        client: true,
        eventAttendees: true
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/:id - Get a single event by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const event = await prisma.event.findFirst({
      where: {
        id,
        createdById: userId
      },
      include: {
        client: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        eventAttendees: true
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events - Create a new event
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const {
      title,
      description,
      eventType,
      startTime,
      endTime,
      allDay,
      location,
      clientId,
      taskId,
      isRecurring,
      recurringRule,
      recurringEndDate,
      attendees,
      reminders,
      status,
      color,
      metadata
    } = req.body;

    // Validate required fields
    if (!title || !eventType || !startTime) {
      return res.status(400).json({ error: 'Title, event type, and start time are required' });
    }

    // Create event
    const event = await prisma.event.create({
      data: {
        title,
        description,
        eventType,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        allDay: allDay || false,
        location,
        clientId,
        taskId,
        createdById: userId,
        isRecurring: isRecurring || false,
        recurringRule,
        recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
        reminders: JSON.stringify(reminders || []),
        status: status || 'CONFIRMED',
        color,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });

    // Create attendees if provided
    if (attendees && Array.isArray(attendees) && attendees.length > 0) {
      await prisma.eventAttendee.createMany({
        data: attendees.map((attendee: any) => ({
          eventId: event.id,
          userId: attendee.userId || null,
          email: attendee.email,
          name: attendee.name || null,
          rsvpStatus: attendee.rsvpStatus || 'NEEDS_ACTION'
        }))
      });
    }

    // Fetch the complete event with attendees
    const completeEvent = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        client: true,
        eventAttendees: true
      }
    });

    res.status(201).json(completeEvent);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id - Update an event
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Check if event exists and belongs to user
    const existingEvent = await prisma.event.findFirst({
      where: {
        id,
        createdById: userId
      }
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const {
      title,
      description,
      eventType,
      startTime,
      endTime,
      allDay,
      location,
      clientId,
      taskId,
      isRecurring,
      recurringRule,
      recurringEndDate,
      attendees,
      reminders,
      status,
      color,
      metadata
    } = req.body;

    // Update event
    const event = await prisma.event.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existingEvent.title,
        description: description !== undefined ? description : existingEvent.description,
        eventType: eventType !== undefined ? eventType : existingEvent.eventType,
        startTime: startTime !== undefined ? new Date(startTime) : existingEvent.startTime,
        endTime: endTime !== undefined ? new Date(endTime) : existingEvent.endTime,
        allDay: allDay !== undefined ? allDay : existingEvent.allDay,
        location: location !== undefined ? location : existingEvent.location,
        clientId: clientId !== undefined ? clientId : existingEvent.clientId,
        taskId: taskId !== undefined ? taskId : existingEvent.taskId,
        isRecurring: isRecurring !== undefined ? isRecurring : existingEvent.isRecurring,
        recurringRule: recurringRule !== undefined ? recurringRule : existingEvent.recurringRule,
        recurringEndDate: recurringEndDate !== undefined ? new Date(recurringEndDate) : existingEvent.recurringEndDate,
        reminders: reminders !== undefined ? JSON.stringify(reminders) : existingEvent.reminders,
        status: status !== undefined ? status : existingEvent.status,
        color: color !== undefined ? color : existingEvent.color,
        metadata: metadata !== undefined ? JSON.stringify(metadata) : existingEvent.metadata
      }
    });

    // Update attendees if provided
    if (attendees !== undefined) {
      // Delete existing attendees
      await prisma.eventAttendee.deleteMany({
        where: { eventId: id }
      });

      // Create new attendees
      if (Array.isArray(attendees) && attendees.length > 0) {
        await prisma.eventAttendee.createMany({
          data: attendees.map((attendee: any) => ({
            eventId: id,
            userId: attendee.userId || null,
            email: attendee.email,
            name: attendee.name || null,
            rsvpStatus: attendee.rsvpStatus || 'NEEDS_ACTION'
          }))
        });
      }
    }

    // Fetch the complete event with attendees
    const completeEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        client: true,
        eventAttendees: true
      }
    });

    res.json(completeEvent);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id - Delete an event
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Check if event exists and belongs to user
    const existingEvent = await prisma.event.findFirst({
      where: {
        id,
        createdById: userId
      }
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete event (cascade will delete attendees)
    await prisma.event.delete({
      where: { id }
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// PATCH /api/events/:id/status - Update event status
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Check if event exists and belongs to user
    const existingEvent = await prisma.event.findFirst({
      where: {
        id,
        createdById: userId
      }
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = await prisma.event.update({
      where: { id },
      data: { status }
    });

    res.json(event);
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

// PATCH /api/events/:id/rsvp - Update attendee RSVP status
router.patch('/:id/rsvp', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const { attendeeId, rsvpStatus } = req.body;

    if (!attendeeId || !rsvpStatus) {
      return res.status(400).json({ error: 'Attendee ID and RSVP status are required' });
    }

    // Check if event exists
    const event = await prisma.event.findFirst({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Update attendee RSVP
    const attendee = await prisma.eventAttendee.update({
      where: { id: attendeeId },
      data: {
        rsvpStatus,
        respondedAt: new Date()
      }
    });

    res.json(attendee);
  } catch (error) {
    console.error('Error updating RSVP:', error);
    res.status(500).json({ error: 'Failed to update RSVP status' });
  }
});

// ============================================================================
// TASKS-CALENDAR-REMINDERS INTEGRATION ENDPOINTS
// ============================================================================

// POST /api/events/:id/create-task - Create a task from a calendar event
router.post('/:id/create-task', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dueDate, priority = 'MEDIUM' } = req.body;
    const userId = (req as any).user.userId;

    // Fetch the event
    const event = await prisma.event.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check access
    if (event.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create the task
    const task = await prisma.task.create({
      data: {
        text: event.title,
        description: event.description,
        type: 'CLIENT_SPECIFIC',
        priority,
        clientId: event.clientId,
        dueDate: dueDate ? new Date(dueDate) : event.startTime,
        createdById: userId,
        status: 'TODO',
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task from event:', error);
    res.status(500).json({ error: 'Failed to create task from event' });
  }
});

// POST /api/events/:id/create-reminder - Create a reminder from a calendar event
router.post('/:id/create-reminder', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { remindAt, category = 'GENERAL', priority = 'MEDIUM' } = req.body;
    const userId = (req as any).user.userId;

    // Fetch the event
    const event = await prisma.event.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check access
    if (event.createdById !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create the reminder
    const reminder = await prisma.reminder.create({
      data: {
        userId,
        clientId: event.clientId,
        title: `Event: ${event.title}`,
        description: event.description,
        category,
        priority,
        remindAt: remindAt ? new Date(remindAt) : new Date(event.startTime),
        dueDate: event.startTime,
        status: 'PENDING',
      },
      include: {
        client: {
          select: { id: true, nameEncrypted: true },
        },
      },
    });

    res.status(201).json(reminder);
  } catch (error) {
    console.error('Error creating reminder from event:', error);
    res.status(500).json({ error: 'Failed to create reminder from event' });
  }
});

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

// GET /api/events/check-conflicts - Check for scheduling conflicts
router.get('/check-conflicts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { startTime, endTime, excludeEventId } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    const start = new Date(startTime as string);
    const end = new Date(endTime as string);

    // Build where clause for conflict detection
    const where: any = {
      createdById: userId,
      status: { not: 'CANCELLED' },
      OR: [
        // Event starts during the proposed time
        {
          startTime: { gte: start, lt: end }
        },
        // Event ends during the proposed time
        {
          endTime: { gt: start, lte: end }
        },
        // Event completely encompasses the proposed time
        {
          startTime: { lt: start },
          endTime: { gt: end }
        },
        // Proposed time completely encompasses the event
        {
          startTime: { gt: start },
          endTime: { lt: end }
        }
      ]
    };

    // Exclude current event when updating
    if (excludeEventId) {
      where.id = { not: excludeEventId as string };
    }

    const conflicts = await prisma.event.findMany({
      where,
      include: {
        client: {
          select: { id: true, nameEncrypted: true }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    res.json({
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts.map(conflict => ({
        id: conflict.id,
        title: conflict.title,
        startTime: conflict.startTime,
        endTime: conflict.endTime,
        allDay: conflict.allDay,
        location: conflict.location,
        eventType: conflict.eventType,
        client: conflict.client
      }))
    });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({ error: 'Failed to check for conflicts' });
  }
});

// GET /api/events/availability - Get available time slots
router.get('/availability', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { date, duration = 60 } = req.query; // duration in minutes

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const targetDate = new Date(date as string);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all events for the day
    const events = await prisma.event.findMany({
      where: {
        createdById: userId,
        status: { not: 'CANCELLED' },
        startTime: { gte: startOfDay, lte: endOfDay }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    // Find available slots
    const slotDuration = parseInt(duration as string);
    const availableSlots: Array<{ start: Date; end: Date }> = [];
    let currentTime = new Date(startOfDay);
    currentTime.setHours(9, 0, 0, 0); // Start at 9 AM
    const endTime = new Date(startOfDay);
    endTime.setHours(17, 0, 0, 0); // End at 5 PM

    for (const event of events) {
      // Check if there's a gap before this event
      const timeDiff = event.startTime.getTime() - currentTime.getTime();
      if (timeDiff >= slotDuration * 60 * 1000) {
        availableSlots.push({
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + slotDuration * 60 * 1000)
        });
      }
      // Move current time past this event
      currentTime = new Date(event.endTime || event.startTime);
    }

    // Check for slot after last event
    const timeDiff = endTime.getTime() - currentTime.getTime();
    if (timeDiff >= slotDuration * 60 * 1000) {
      availableSlots.push({
        start: new Date(currentTime),
        end: new Date(currentTime.getTime() + slotDuration * 60 * 1000)
      });
    }

    res.json({
      date: targetDate,
      duration: slotDuration,
      availableSlots
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

export default router;
