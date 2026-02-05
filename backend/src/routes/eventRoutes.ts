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

export default router;
