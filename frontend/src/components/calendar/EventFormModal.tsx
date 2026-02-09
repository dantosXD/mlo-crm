import React, { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  Checkbox,
  Group,
  Button,
  Divider,
  MultiSelect,
  Alert,
  Text,
  NumberInput,
  Tabs,
  Card,
  ActionIcon,
  Badge,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconMapPin,
  IconUsers,
  IconBell,
  IconRepeat,
  IconPaperclip,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../utils/api';

interface Event {
  id?: string;
  title?: string;
  description?: string;
  eventType?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  clientId?: string;
  taskId?: string;
  isRecurring?: boolean;
  recurringRule?: string;
  recurringEndDate?: string;
  attendees?: Array<{
    id?: string;
    email: string;
    name?: string;
    rsvpStatus?: string;
  }>;
  reminders?: number[];
  status?: string;
  color?: string;
}

interface Client {
  id: string;
  nameEncrypted: string;
}

interface EventFormModalProps {
  opened: boolean;
  onClose: () => void;
  event?: Event | null;
  selectedDate?: Date | null;
  onSuccess: () => void;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  opened,
  onClose,
  event,
  selectedDate,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendees, setAttendees] = useState<Array<{ email: string; name?: string }>>(
    event?.attendees?.map(a => ({ email: a.email, name: a.name || undefined })) || []
  );
  const [reminders, setReminders] = useState<number[]>(
    event?.reminders || []
  );

  // Fetch clients for linking
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await apiRequest('/clients?limit=100');
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
    enabled: opened,
  });

  const clientOptions = clients.map((client: Client) => {
    let label = 'Unknown Client';
    if (client.nameEncrypted) {
      try {
        const parsed = JSON.parse(client.nameEncrypted);
        label = parsed?.name || label;
      } catch {
        label = client.nameEncrypted;
      }
    }
    return {
      value: client.id,
      label,
    };
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    // Build attendees array
    const attendeesData = attendees.map(a => ({
      email: a.email,
      name: a.name || '',
    }));

    // Build reminders array
    const remindersData = reminders;

    // Build recurrence rule
    let recurringRule = null;
    const isRecurring = formData.get('isRecurring') === 'on';
    if (isRecurring) {
      const recurrenceType = formData.get('recurrenceType') as string;
      const recurrenceInterval = parseInt(formData.get('recurrenceInterval') as string) || 1;
      recurringRule = `${recurrenceType}_${recurrenceInterval}`;
    }

    const eventData = {
      title: formData.get('title'),
      description: formData.get('description'),
      eventType: formData.get('eventType'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime') || null,
      allDay: formData.get('allDay') === 'on',
      location: formData.get('location') || null,
      clientId: formData.get('clientId') || null,
      isRecurring,
      recurringRule,
      recurringEndDate: isRecurring ? formData.get('recurringEndDate') : null,
      attendees: attendeesData,
      reminders: remindersData,
      status: 'CONFIRMED',
    };

    try {
      const url = event?.id ? `/events/${event.id}` : '/events';
      const method = event?.id ? 'PUT' : 'POST';

      const response = await apiRequest(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error('Failed to save event');
      }

      notifications.show({
        title: 'Success',
        message: event?.id ? 'Event updated successfully' : 'Event created successfully',
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

  const addAttendee = () => {
    if (!attendeeEmail.trim()) return;

    if (attendees.some(a => a.email === attendeeEmail)) {
      notifications.show({
        title: 'Duplicate',
        message: 'This attendee has already been added',
        color: 'yellow',
      });
      return;
    }

    setAttendees([...attendees, { email: attendeeEmail.trim() }]);
    setAttendeeEmail('');
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter(a => a.email !== email));
  };

  const addReminder = (minutes: number) => {
    if (reminders.includes(minutes)) return;
    setReminders([...reminders, minutes].sort((a, b) => a - b));
  };

  const removeReminder = (minutes: number) => {
    setReminders(reminders.filter(r => r !== minutes));
  };

  const reminderOptions = [
    { value: '0', label: 'At time of event' },
    { value: '5', label: '5 minutes before' },
    { value: '15', label: '15 minutes before' },
    { value: '30', label: '30 minutes before' },
    { value: '60', label: '1 hour before' },
    { value: '1440', label: '1 day before' },
    { value: '10080', label: '1 week before' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={event?.id ? 'Edit Event' : 'New Event'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="details">
          <Tabs.List>
            <Tabs.Tab value="details" leftSection={<IconPaperclip size={14} />}>
              Details
            </Tabs.Tab>
            <Tabs.Tab value="attendees" leftSection={<IconUsers size={14} />}>
              Attendees ({attendees.length})
            </Tabs.Tab>
            <Tabs.Tab value="reminders" leftSection={<IconBell size={14} />}>
              Reminders ({reminders.length})
            </Tabs.Tab>
            <Tabs.Tab value="recurrence" leftSection={<IconRepeat size={14} />}>
              Recurrence
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details">
            <Stack gap="md" mt="md">
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
                  { value: 'TASK', label: 'Task' },
                  { value: 'REMINDER', label: 'Reminder' },
                  { value: 'CUSTOM', label: 'Custom' },
                ]}
              />

              <Select
                label="Link to Client (Optional)"
                name="clientId"
                clearable
                searchable
                defaultValue={event?.clientId}
                data={clientOptions}
                placeholder="Select a client"
                leftSection={<IconUsers size={16} />}
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
                leftSection={<IconMapPin size={16} />}
              />

              <Textarea
                label="Description"
                name="description"
                defaultValue={event?.description || ''}
                placeholder="Add event details, agenda, notes..."
                minRows={3}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="attendees">
            <Stack gap="md" mt="md">
              <Alert variant="light" color="blue" title="About Attendees">
                Add attendees to your event. They will receive email invitations and can RSVP.
              </Alert>

              <Group>
                <TextInput
                  placeholder="attendee@example.com"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.currentTarget.value)}
                  style={{ flex: 1 }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAttendee();
                    }
                  }}
                />
                <ActionIcon
                  onClick={addAttendee}
                  disabled={!attendeeEmail.trim()}
                  color="blue"
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Group>

              {attendees.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Attendees List
                  </Text>
                  {attendees.map((attendee, index) => (
                    <Card key={index} padding="xs" withBorder>
                      <Group justify="space-between">
                        <Text size="sm">{attendee.email}</Text>
                        <ActionIcon
                          color="red"
                          onClick={() => removeAttendee(attendee.email)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="reminders">
            <Stack gap="md" mt="md">
              <Alert variant="light" color="blue" title="About Reminders">
                Choose when to receive reminders before this event. You can set multiple reminders.
              </Alert>

              <Text size="sm" fw={500}>
                Add Reminder
              </Text>
              <Group>
                <Select
                  placeholder="Select reminder time"
                  data={reminderOptions.filter(r => !reminders.includes(Number(r.value)))}
                  onChange={(value) => {
                    if (value !== null) {
                      addReminder(Number(value));
                    }
                  }}
                  style={{ flex: 1 }}
                />
              </Group>

              {reminders.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Active Reminders
                  </Text>
                  {reminders.map((minutes) => {
                    const option = reminderOptions.find(r => Number(r.value) === minutes);
                    return (
                      <Card key={minutes} padding="xs" withBorder>
                        <Group justify="space-between">
                          <Badge color="blue">{option?.label}</Badge>
                          <ActionIcon
                            color="red"
                            onClick={() => removeReminder(minutes)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="recurrence">
            <Stack gap="md" mt="md">
              <Alert variant="light" color="blue" title="About Recurrence">
                Make this event repeat daily, weekly, or monthly. You can also set an end date.
              </Alert>

              <Checkbox
                label="Repeat this event"
                name="isRecurring"
                defaultChecked={event?.isRecurring}
              />

              <Stack gap="sm" pl="md">
                <Select
                  label="Repeat"
                  name="recurrenceType"
                  defaultValue={event?.recurringRule?.split('_')[0] || 'WEEKLY'}
                  data={[
                    { value: 'DAILY', label: 'Daily' },
                    { value: 'WEEKLY', label: 'Weekly' },
                    { value: 'MONTHLY', label: 'Monthly' },
                    { value: 'YEARLY', label: 'Yearly' },
                  ]}
                />

                <NumberInput
                  label="Repeat every"
                  name="recurrenceInterval"
                  defaultValue={parseInt(event?.recurringRule?.split('_')[1] || '1')}
                  min={1}
                  max={52}
                  rightSection={<Text size="sm">x</Text>}
                />

                <TextInput
                  label="End Date (Optional)"
                  name="recurringEndDate"
                  type="date"
                  defaultValue={
                    event?.recurringEndDate
                      ? dayjs(event.recurringEndDate).format('YYYY-MM-DD')
                      : ''
                  }
                  placeholder="No end date"
                />
              </Stack>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Divider my="md" />

        <Group justify="flex-end">
          <Button type="button" variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {event?.id ? 'Update' : 'Create'} Event
          </Button>
        </Group>
      </form>
    </Modal>
  );
};
