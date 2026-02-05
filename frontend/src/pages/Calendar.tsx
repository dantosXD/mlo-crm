import React, { useState, useEffect } from 'react';
import {
  Container,
  Group,
  Title,
  Button,
  Select,
  Stack,
  Paper,
  Badge,
  Text,
  Box,
  ActionIcon,
  Tooltip,
  Menu,
  Flex,
  Grid,
  Card,
  ScrollArea,
  Modal,
  TextInput,
  Textarea,
  DatePicker,
  TimeInput,
  Checkbox,
  MultiSelect,
  ColorInput,
  Alert,
} from '@mantine/core';
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconToday,
  IconPlus,
  IconDots,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconFilter,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

// Types
interface Event {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  startTime: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  clientId?: string;
  taskId?: string;
  status: string;
  color?: string;
  client?: {
    id: string;
    nameEncrypted: string;
  };
  eventAttendees: Array<{
    id: string;
    email: string;
    name?: string;
    rsvpStatus: string;
  }>;
}

interface CalendarViewProps {
  view: 'month' | 'week' | 'day' | 'agenda';
  currentDate: dayjs.Dayjs;
  events: Event[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}

const Calendar: React.FC = () => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch events
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['events', currentDate.format('YYYY-MM')],
    queryFn: async () => {
      const startDate = currentDate.startOf(view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toISOString();
      const endDate = currentDate.endOf(view === 'month' ? 'month' : view === 'week' ? 'week' : 'day').toISOString();

      const response = await fetch(
        `/api/events?startDate=${startDate}&endDate=${endDate}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      return response.json();
    },
  });

  // Navigation
  const goToToday = () => setCurrentDate(dayjs());
  const goPrev = () => {
    if (view === 'month') setCurrentDate(currentDate.subtract(1, 'month'));
    else if (view === 'week') setCurrentDate(currentDate.subtract(1, 'week'));
    else setCurrentDate(currentDate.subtract(1, 'day'));
  };
  const goNext = () => {
    if (view === 'month') setCurrentDate(currentDate.add(1, 'month'));
    else if (view === 'week') setCurrentDate(currentDate.add(1, 'week'));
    else setCurrentDate(currentDate.add(1, 'day'));
  };

  // Event handlers
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setEventModalOpen(true);
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setEventModalOpen(true);
  };

  // Color coding for event types
  const getEventColor = (eventType: string): string => {
    const colors: Record<string, string> = {
      MEETING: '#228be6',
      APPOINTMENT: '#40c057',
      CLOSING: '#fd7e14',
      FOLLOW_UP: '#fab005',
      CUSTOM: '#868e96',
      TASK: '#7950f2',
      REMINDER: '#fa5252',
    };
    return colors[eventType] || colors.CUSTOM;
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Paper p="md" withBorder>
          <Flex justify="space-between" align="center" gap="md">
            <Group>
              <IconCalendar size={32} />
              <Title order={2}>Calendar</Title>
            </Group>

            <Group>
              <Select
                value={view}
                onChange={(v) => setView(v as 'month' | 'week' | 'day' | 'agenda')}
                data={[
                  { value: 'month', label: 'Month' },
                  { value: 'week', label: 'Week' },
                  { value: 'day', label: 'Day' },
                  { value: 'agenda', label: 'Agenda' },
                ]}
                style={{ width: 120 }}
              />

              <Button variant="default" onClick={goToToday} leftSection={<IconToday size={16} />}>
                Today
              </Button>

              <Group gap="xs">
                <ActionIcon onClick={goPrev} variant="default">
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <ActionIcon onClick={goNext} variant="default">
                  <IconChevronRight size={16} />
                </ActionIcon>
              </Group>

              <Text fw={500} size="lg" miw={150} ta="center">
                {currentDate.format('MMMM YYYY')}
              </Text>
            </Group>

            <Group>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setEventModalOpen(true)}>
                New Event
              </Button>
              <ActionIcon variant="default" onClick={() => refetch()}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Group>
          </Flex>
        </Paper>

        {/* Calendar Legend */}
        <Paper p="xs" withBorder>
          <Group gap="sm">
            <Text size="sm" fw={500}>Event Types:</Text>
            <Badge color="blue" variant="light">Meeting</Badge>
            <Badge color="green" variant="light">Appointment</Badge>
            <Badge color="orange" variant="light">Closing</Badge>
            <Badge color="yellow" variant="light">Follow-up</Badge>
            <Badge color="grape" variant="light">Task</Badge>
            <Badge color="red" variant="light">Reminder</Badge>
            <Badge color="gray" variant="light">Custom</Badge>
          </Group>
        </Paper>

        {/* Calendar View */}
        <Paper p="md" withBorder h="calc(100vh - 250px)">
          {isLoading ? (
            <Flex justify="center" align="center" h="100%">
              <Text>Loading events...</Text>
            </Flex>
          ) : (
            <CalendarView
              view={view}
              currentDate={currentDate}
              events={events}
              onDateClick={handleDateClick}
              onEventClick={handleEventClick}
            />
          )}
        </Paper>
      </Stack>

      {/* Event Modal */}
      <EventModal
        opened={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setSelectedEvent(null);
          setSelectedDate(null);
        }}
        event={selectedEvent}
        selectedDate={selectedDate}
        onSuccess={() => {
          refetch();
          setEventModalOpen(false);
          setSelectedEvent(null);
          setSelectedDate(null);
        }}
      />
    </Container>
  );
};

// Calendar View Component
const CalendarView: React.FC<CalendarViewProps> = ({ view, currentDate, events, onDateClick, onEventClick }) => {
  switch (view) {
    case 'month':
      return <MonthView currentDate={currentDate} events={events} onDateClick={onDateClick} onEventClick={onEventClick} />;
    case 'week':
      return <WeekView currentDate={currentDate} events={events} onDateClick={onDateClick} onEventClick={onEventClick} />;
    case 'day':
      return <DayView currentDate={currentDate} events={events} onDateClick={onDateClick} onEventClick={onEventClick} />;
    case 'agenda':
      return <AgendaView currentDate={currentDate} events={events} onEventClick={onEventClick} />;
    default:
      return <MonthView currentDate={currentDate} events={events} onDateClick={onDateClick} onEventClick={onEventClick} />;
  }
};

// Month View Component
const MonthView: React.FC<{
  currentDate: dayjs.Dayjs;
  events: Event[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}> = ({ currentDate, events, onDateClick, onEventClick }) => {
  const startOfMonth = currentDate.startOf('month');
  const endOfMonth = currentDate.endOf('month');
  const startOfCalendar = startOfMonth.startOf('week');
  const endOfCalendar = endOfMonth.endOf('week');

  const weeks: Array<Array<dayjs.Dayjs>> = [];
  let currentWeek: dayjs.Dayjs[] = [];
  let day = startOfCalendar;

  while (day.isBefore(endOfCalendar) || day.isSame(endOfCalendar, 'day')) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
    day = day.add(1, 'day');
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const getEventsForDay = (date: dayjs.Dayjs) => {
    return events.filter((event) =>
      dayjs(event.startTime).isSame(date, 'day')
    );
  };

  const isToday = (date: dayjs.Dayjs) => date.isSame(dayjs(), 'day');
  const isCurrentMonth = (date: dayjs.Dayjs) => date.isSame(currentDate, 'month');

  return (
    <Box>
      {/* Day headers */}
      <Grid>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <Grid.Col key={day} span={1}>
            <Text ta="center" fw={500} size="sm">
              {day}
            </Text>
          </Grid.Col>
        ))}
      </Grid>

      {/* Calendar days */}
      <Box mt="xs">
        {weeks.map((week, weekIndex) => (
          <Grid key={weekIndex} gutter={2}>
            {week.map((date) => {
              const dayEvents = getEventsForDay(date);
              return (
                <Grid.Col key={date.toISOString()} span={12 / 7}>
                  <Paper
                    p="xs"
                    h={100}
                    withBorder
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isToday(date) ? '#e7f5ff' : isCurrentMonth(date) ? 'white' : '#f8f9fa',
                    }}
                    onClick={() => onDateClick(date.toDate())}
                  >
                    <Flex justify="space-between" align="flex-start" mb="xs">
                      <Text
                        size="sm"
                        fw={isToday(date) ? 700 : 400}
                        c={isCurrentMonth(date) ? 'white' : 'gray'}
                        sx={{
                          color: isCurrentMonth(date) ? 'inherit' : '#868e96',
                        }}
                      >
                        {date.format('D')}
                      </Text>
                      {isToday(date) && (
                        <Badge size="xs" color="blue" variant="filled">
                          Today
                        </Badge>
                      )}
                    </Flex>

                    <ScrollArea h={60}>
                      <Stack gap={2}>
                        {dayEvents.slice(0, 3).map((event) => (
                          <Paper
                            key={event.id}
                            p={4}
                            withBorder
                            style={{
                              backgroundColor: getEventColor(event.eventType),
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick(event);
                            }}
                          >
                            <Text size="xs" lineClamp={1} c="white">
                              {event.allDay ? event.title : `${dayjs(event.startTime).format('h:mm A')} ${event.title}`}
                            </Text>
                          </Paper>
                        ))}
                        {dayEvents.length > 3 && (
                          <Text size="xs" c="dimmed">
                            +{dayEvents.length - 3} more
                          </Text>
                        )}
                      </Stack>
                    </ScrollArea>
                  </Paper>
                </Grid.Col>
              );
            })}
          </Grid>
        ))}
      </Box>
    </Box>
  );
};

// Week View Component
const WeekView: React.FC<{
  currentDate: dayjs.Dayjs;
  events: Event[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}> = ({ currentDate, events, onDateClick, onEventClick }) => {
  const startOfWeek = currentDate.startOf('week');
  const days = Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day'));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDayAndHour = (date: dayjs.Dayjs, hour: number) => {
    return events.filter((event) => {
      const eventStart = dayjs(event.startTime);
      const eventHour = eventStart.hour();
      return eventStart.isSame(date, 'day') && eventHour === hour;
    });
  };

  return (
    <ScrollArea>
      <Box miw={800}>
        {/* Header row */}
        <Flex>
          <Box w={60} />
          {days.map((day) => (
            <Box key={day.toISOString()} flex={1} p="xs" ta="center" style={{ border: '1px solid #dee2e6' }}>
              <Text size="sm" fw={500}>
                {day.format('ddd')}
              </Text>
              <Text
                size="lg"
                fw={700}
                c={day.isSame(dayjs(), 'day') ? 'blue' : 'white'}
              >
                {day.format('D')}
              </Text>
            </Box>
          ))}
        </Flex>

        {/* Time grid */}
        {hours.map((hour) => (
          <Flex key={hour}>
            <Box w={60} p="xs" style={{ border: '1px solid #dee2e6' }}>
              <Text size="xs" ta="center">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </Text>
            </Box>
            {days.map((day) => {
              const hourEvents = getEventsForDayAndHour(day, hour);
              return (
                <Box
                  key={day.toISOString()}
                  flex={1}
                  h={60}
                  p={4}
                  style={{ border: '1px solid #dee2e6', cursor: 'pointer' }}
                  onClick={() => onDateClick(day.hour(hour).toDate())}
                >
                  {hourEvents.map((event) => (
                    <Paper
                      key={event.id}
                      p={4}
                      mb={4}
                      withBorder
                      style={{
                        backgroundColor: getEventColor(event.eventType),
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      <Text size="xs" lineClamp={1} c="white">
                        {event.title}
                      </Text>
                    </Paper>
                  ))}
                </Box>
              );
            })}
          </Flex>
        ))}
      </Box>
    </ScrollArea>
  );
};

// Day View Component
const DayView: React.FC<{
  currentDate: dayjs.Dayjs;
  events: Event[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}> = ({ currentDate, events, onDateClick, onEventClick }) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour: number) => {
    return events.filter((event) => {
      const eventStart = dayjs(event.startTime);
      return eventStart.isSame(currentDate, 'day') && eventStart.hour() === hour;
    });
  };

  return (
    <ScrollArea>
      <Box miw={600}>
        <Text size="xl" fw={700} ta="center" mb="md">
          {currentDate.format('dddd, MMMM D, YYYY')}
        </Text>

        {hours.map((hour) => {
          const hourEvents = getEventsForHour(hour);
          return (
            <Flex
              key={hour}
              p="sm"
              style={{ borderBottom: '1px solid #dee2e6', cursor: 'pointer' }}
              onClick={() => onDateClick(currentDate.hour(hour).toDate())}
            >
              <Box w={80}>
                <Text size="sm" fw={500}>
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </Text>
              </Box>
              <Box flex={1}>
                {hourEvents.map((event) => (
                  <Paper
                    key={event.id}
                    p="sm"
                    mb="xs"
                    withBorder
                    style={{
                      backgroundColor: getEventColor(event.eventType),
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <Text size="sm" fw={500} c="white">
                      {event.title}
                    </Text>
                    <Text size="xs" c="white">
                      {dayjs(event.startTime).format('h:mm A')}
                      {event.endTime && ` - ${dayjs(event.endTime).format('h:mm A')}`}
                    </Text>
                    {event.location && (
                      <Text size="xs" c="white" opacity={0.8}>
                        📍 {event.location}
                      </Text>
                    )}
                  </Paper>
                ))}
              </Box>
            </Flex>
          );
        })}
      </Box>
    </ScrollArea>
  );
};

// Agenda View Component
const AgendaView: React.FC<{
  currentDate: dayjs.Dayjs;
  events: Event[];
  onEventClick: (event: Event) => void;
}> = ({ currentDate, events, onEventClick }) => {
  const sortedEvents = [...events].sort((a, b) =>
    dayjs(a.startTime).unix() - dayjs(b.startTime).unix()
  );

  const groupedEvents = sortedEvents.reduce((acc, event) => {
    const dateKey = dayjs(event.startTime).format('YYYY-MM-DD');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  return (
    <ScrollArea>
      <Stack gap="md">
        {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
          <Box key={dateKey}>
            <Text size="lg" fw={700} mb="sm">
              {dayjs(dateKey).format('dddd, MMMM D, YYYY')}
            </Text>
            <Stack gap="sm">
              {dayEvents.map((event) => (
                <Paper
                  key={event.id}
                  p="md"
                  withBorder
                  style={{
                    borderLeft: `4px solid ${getEventColor(event.eventType)}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => onEventClick(event)}
                >
                  <Flex justify="space-between" align="flex-start">
                    <Box flex={1}>
                      <Group gap="sm" mb="xs">
                        <Text size="md" fw={600}>
                          {event.title}
                        </Text>
                        <Badge color={getEventColor(event.eventType)} variant="light">
                          {event.eventType}
                        </Badge>
                        <Badge color={event.status === 'CONFIRMED' ? 'green' : event.status === 'TENTATIVE' ? 'yellow' : 'red'}>
                          {event.status}
                        </Badge>
                      </Group>

                      <Group gap="xl" mb="xs">
                        <Text size="sm" c="dimmed">
                          🕐 {dayjs(event.startTime).format('h:mm A')}
                          {event.endTime && ` - ${dayjs(event.endTime).format('h:mm A')}`}
                          {event.allDay && ' (All Day)'}
                        </Text>
                        {event.location && (
                          <Text size="sm" c="dimmed">
                            📍 {event.location}
                          </Text>
                        )}
                        {event.client && (
                          <Text size="sm" c="dimmed">
                            👤 Client
                          </Text>
                        )}
                      </Group>

                      {event.description && (
                        <Text size="sm" lineClamp={2}>
                          {event.description}
                        </Text>
                      )}
                    </Box>

                    <ActionIcon>
                      <IconDots size={16} />
                    </ActionIcon>
                  </Flex>
                </Paper>
              ))}
            </Stack>
          </Box>
        ))}

        {sortedEvents.length === 0 && (
          <Alert variant="light" color="blue" title="No events">
            No events scheduled for this period. Click "New Event" to create one.
          </Alert>
        )}
      </Stack>
    </ScrollArea>
  );
};

// Helper function for event colors
const getEventColor = (eventType: string): string => {
  const colors: Record<string, string> = {
    MEETING: 'blue',
    APPOINTMENT: 'green',
    CLOSING: 'orange',
    FOLLOW_UP: 'yellow',
    CUSTOM: 'gray',
    TASK: 'grape',
    REMINDER: 'red',
  };
  return colors[eventType] || 'gray';
};

// Event Modal Component
const EventModal: React.FC<{
  opened: boolean;
  onClose: () => void;
  event?: Event | null;
  selectedDate?: Date | null;
  onSuccess: () => void;
}> = ({ opened, onClose, event, selectedDate, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const eventData = {
      title: formData.get('title'),
      description: formData.get('description'),
      eventType: formData.get('eventType'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      allDay: formData.get('allDay') === 'on',
      location: formData.get('location'),
      status: 'CONFIRMED',
    };

    try {
      const url = event ? `/api/events/${event.id}` : '/api/events';
      const method = event ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error('Failed to save event');
      }

      notifications.show({
        title: 'Success',
        message: event ? 'Event updated successfully' : 'Event created successfully',
        color: 'green',
      });

      onSuccess();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save event',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={event ? 'Edit Event' : 'New Event'} size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Title"
            name="title"
            required
            defaultValue={event?.title}
            placeholder="Meeting with client"
          />

          <Select
            label="Event Type"
            name="eventType"
            required
            defaultValue={event?.eventType || 'MEETING'}
            data={[
              { value: 'MEETING', label: 'Meeting' },
              { value: 'APPOINTMENT', label: 'Appointment' },
              { value: 'CLOSING', label: 'Closing' },
              { value: 'FOLLOW_UP', label: 'Follow-up' },
              { value: 'CUSTOM', label: 'Custom' },
            ]}
          />

          <Group grow>
            <TextInput
              label="Start Time"
              name="startTime"
              type="datetime-local"
              required
              defaultValue={
                event?.startTime
                  ? dayjs(event.startTime).format('YYYY-MM-DDTHH:mm')
                  : selectedDate
                  ? dayjs(selectedDate).format('YYYY-MM-DDTHH:mm')
                  : dayjs().format('YYYY-MM-DDTHH:mm')
              }
            />
            <TextInput
              label="End Time"
              name="endTime"
              type="datetime-local"
              defaultValue={event?.endTime ? dayjs(event.endTime).format('YYYY-MM-DDTHH:mm') : ''}
            />
          </Group>

          <Checkbox
            label="All Day Event"
            name="allDay"
            defaultChecked={event?.allDay}
          />

          <TextInput
            label="Location"
            name="location"
            defaultValue={event?.location || ''}
            placeholder="123 Main St, Conference Room A"
          />

          <Textarea
            label="Description"
            name="description"
            defaultValue={event?.description || ''}
            placeholder="Add event details..."
            minRows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button type="button" variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {event ? 'Update' : 'Create'} Event
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default Calendar;
