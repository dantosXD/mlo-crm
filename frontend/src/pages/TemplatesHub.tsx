import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams } from 'react-router-dom';
import { IconEdit, IconPlus, IconTemplate, IconTrash } from '@tabler/icons-react';
import {
  useActivityTemplates,
  useCreateActivityTemplate,
  useCreateNoteTemplate,
  useCreateReminderTemplate,
  useCreateTaskTemplate,
  useDeleteActivityTemplate,
  useDeleteNoteTemplate,
  useDeleteReminderTemplate,
  useDeleteTaskTemplate,
  useNoteTemplates,
  useReminderTemplates,
  useTaskTemplates,
  useUpdateActivityTemplate,
  useUpdateNoteTemplate,
  useUpdateReminderTemplate,
  useUpdateTaskTemplate,
} from '../hooks';
import type {
  ActivityTemplateConfig,
  ActivityTemplateFollowUpConfig,
  ActivityTemplate,
  FollowUpKind,
  NoteTemplate,
  ReminderTemplateConfig,
  ReminderTemplate,
  TaskTemplate,
  TemplateOffsetUnit,
} from '../types';

type ScopeFilter = 'all' | 'system' | 'mine';

const TEMPLATE_SCOPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'system', label: 'System' },
  { value: 'mine', label: 'Mine' },
];

const OFFSET_UNIT_OPTIONS: Array<{ value: TemplateOffsetUnit; label: string }> = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

function filterByScope<T extends { isSystem: boolean }>(items: T[], scope: ScopeFilter): T[] {
  if (scope === 'system') return items.filter((item) => item.isSystem);
  if (scope === 'mine') return items.filter((item) => !item.isSystem);
  return items;
}

function renderTemplateCard({
  id,
  name,
  description,
  isSystem,
  extra,
  onEdit,
  onDelete,
}: {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  extra?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card key={id} withBorder>
      <Group justify="space-between" align="flex-start">
        <Stack gap={2} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={600}>{name}</Text>
            <Badge color={isSystem ? 'grape' : 'blue'} variant="light">
              {isSystem ? 'System' : 'Personal'}
            </Badge>
          </Group>
          {description && <Text size="sm" c="dimmed">{description}</Text>}
          {extra && <Text size="xs" c="dimmed">{extra}</Text>}
        </Stack>
        {!isSystem && (
          <Group gap={4}>
            {onEdit && (
              <ActionIcon variant="subtle" color="blue" onClick={onEdit} aria-label="Edit template">
                <IconEdit size={16} />
              </ActionIcon>
            )}
            {onDelete && (
              <ActionIcon variant="subtle" color="red" onClick={onDelete} aria-label="Delete template">
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        )}
      </Group>
    </Card>
  );
}

function NotesTemplatesTab() {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<NoteTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const { data: templates = [], isLoading } = useNoteTemplates();
  const createMutation = useCreateNoteTemplate();
  const updateMutation = useUpdateNoteTemplate();
  const deleteMutation = useDeleteNoteTemplate();

  const filtered = useMemo(() => {
    const scoped = filterByScope(templates, scope);
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((t) =>
      t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.content.toLowerCase().includes(q),
    );
  }, [templates, scope, search]);

  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setContent('');
    setTags([]);
  };

  const openCreate = () => {
    reset();
    setOpened(true);
  };

  const openEdit = (t: NoteTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || '');
    setContent(t.content);
    setTags(t.tags || []);
    setOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Name and content are required', color: 'red' });
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload: { name: name.trim(), description: description.trim() || undefined, content: content.trim(), tags } });
      } else {
        await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined, content: content.trim(), tags });
      }
      setOpened(false);
      reset();
      notifications.show({ title: 'Success', message: 'Template saved', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to save template', color: 'red' });
    }
  };

  const handleDelete = async (t: NoteTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(t.id);
      notifications.show({ title: 'Deleted', message: 'Template deleted', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to delete template', color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group style={{ flex: 1 }}>
          <TextInput placeholder="Search note templates..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} style={{ flex: 1 }} />
          <Select value={scope} data={TEMPLATE_SCOPE_OPTIONS} onChange={(v) => setScope((v as ScopeFilter) || 'all')} w={120} />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New Note Template</Button>
      </Group>

      {isLoading ? <Text c="dimmed">Loading templates...</Text> : (
        <Stack gap="sm">
          {filtered.map((t) => renderTemplateCard({
            id: t.id,
            name: t.name,
            description: t.description,
            isSystem: t.isSystem,
            extra: t.tags.length ? `Tags: ${t.tags.join(', ')}` : undefined,
            onEdit: () => openEdit(t),
            onDelete: () => handleDelete(t),
          }))}
          {filtered.length === 0 && <Text c="dimmed">No note templates found.</Text>}
        </Stack>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? 'Edit Note Template' : 'New Note Template'}>
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <Textarea label="Content" value={content} onChange={(e) => setContent(e.currentTarget.value)} minRows={6} required />
          <TagsInput label="Tags" value={tags} onChange={setTags} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function TasksTemplatesTab() {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [type, setType] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [tagsCsv, setTagsCsv] = useState('');
  const [dueDays, setDueDays] = useState<string>('');
  const [stepsText, setStepsText] = useState('');

  const { data: templates = [], isLoading } = useTaskTemplates();
  const createMutation = useCreateTaskTemplate();
  const updateMutation = useUpdateTaskTemplate();
  const deleteMutation = useDeleteTaskTemplate();

  const filtered = useMemo(() => {
    const scoped = filterByScope(templates, scope);
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((t) => t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [templates, scope, search]);

  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setText('');
    setType('GENERAL');
    setPriority('MEDIUM');
    setTagsCsv('');
    setDueDays('');
    setStepsText('');
  };

  const openCreate = () => {
    reset();
    setOpened(true);
  };

  const openEdit = (t: TaskTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || '');
    setText(t.text);
    setType(t.type || 'GENERAL');
    setPriority(t.priority || 'MEDIUM');
    setTagsCsv((t.tags || []).join(', '));
    setDueDays(t.dueDays != null ? `${t.dueDays}` : '');
    setStepsText((t.steps || []).join('\n'));
    setOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !text.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Name and task text are required', color: 'red' });
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      text: text.trim(),
      type,
      priority,
      tags: tagsCsv.split(',').map((tag) => tag.trim()).filter(Boolean),
      dueDays: dueDays.trim() ? Number(dueDays) : null,
      steps: stepsText.split('\n').map((step) => step.trim()).filter(Boolean),
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setOpened(false);
      reset();
      notifications.show({ title: 'Success', message: 'Template saved', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to save template', color: 'red' });
    }
  };

  const handleDelete = async (t: TaskTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(t.id);
      notifications.show({ title: 'Deleted', message: 'Template deleted', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to delete template', color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group style={{ flex: 1 }}>
          <TextInput placeholder="Search task templates..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} style={{ flex: 1 }} />
          <Select value={scope} data={TEMPLATE_SCOPE_OPTIONS} onChange={(v) => setScope((v as ScopeFilter) || 'all')} w={120} />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New Task Template</Button>
      </Group>

      {isLoading ? <Text c="dimmed">Loading templates...</Text> : (
        <Stack gap="sm">
          {filtered.map((t) => renderTemplateCard({
            id: t.id,
            name: t.name,
            description: t.description,
            isSystem: t.isSystem,
            extra: `Type: ${t.type} | Priority: ${t.priority}`,
            onEdit: () => openEdit(t),
            onDelete: () => handleDelete(t),
          }))}
          {filtered.length === 0 && <Text c="dimmed">No task templates found.</Text>}
        </Stack>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? 'Edit Task Template' : 'New Task Template'} size="lg">
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <Textarea label="Task Text" value={text} onChange={(e) => setText(e.currentTarget.value)} required />
          <Group grow>
            <Select label="Type" value={type} onChange={(v) => setType(v || 'GENERAL')} data={['GENERAL', 'CLIENT_SPECIFIC', 'WORKFLOW_RELATED', 'FOLLOW_UP', 'COMPLIANCE']} />
            <Select label="Priority" value={priority} onChange={(v) => setPriority(v || 'MEDIUM')} data={['LOW', 'MEDIUM', 'HIGH', 'URGENT']} />
          </Group>
          <Group grow>
            <TextInput label="Tags" value={tagsCsv} onChange={(e) => setTagsCsv(e.currentTarget.value)} placeholder="comma,separated,tags" />
            <TextInput label="Due Days" value={dueDays} onChange={(e) => setDueDays(e.currentTarget.value)} placeholder="optional" />
          </Group>
          <Textarea label="Steps (one per line)" value={stepsText} onChange={(e) => setStepsText(e.currentTarget.value)} minRows={4} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function RemindersTemplatesTab() {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ReminderTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [tags, setTags] = useState<string[]>([]);
  const [remindOffsetValue, setRemindOffsetValue] = useState<number | string>(1);
  const [remindOffsetUnit, setRemindOffsetUnit] = useState<TemplateOffsetUnit>('days');
  const [remindOffsetTime, setRemindOffsetTime] = useState('09:00');
  const [dueOffsetEnabled, setDueOffsetEnabled] = useState(false);
  const [dueOffsetValue, setDueOffsetValue] = useState<number | string>(1);
  const [dueOffsetUnit, setDueOffsetUnit] = useState<TemplateOffsetUnit>('days');
  const [dueOffsetTime, setDueOffsetTime] = useState('17:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState('DAILY');
  const [recurringInterval, setRecurringInterval] = useState<number | string>(1);
  const [recurringEndDays, setRecurringEndDays] = useState<number | string>('');

  const { data: templates = [], isLoading } = useReminderTemplates();
  const createMutation = useCreateReminderTemplate();
  const updateMutation = useUpdateReminderTemplate();
  const deleteMutation = useDeleteReminderTemplate();

  const filtered = useMemo(() => {
    const scoped = filterByScope(templates, scope);
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [templates, scope, search]);

  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setTitle('');
    setTemplateDescription('');
    setCategory('GENERAL');
    setPriority('MEDIUM');
    setTags([]);
    setRemindOffsetValue(1);
    setRemindOffsetUnit('days');
    setRemindOffsetTime('09:00');
    setDueOffsetEnabled(false);
    setDueOffsetValue(1);
    setDueOffsetUnit('days');
    setDueOffsetTime('17:00');
    setIsRecurring(false);
    setRecurringPattern('DAILY');
    setRecurringInterval(1);
    setRecurringEndDays('');
  };

  const openCreate = () => {
    reset();
    setOpened(true);
  };

  const openEdit = (t: ReminderTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || '');
    setTitle(t.config.title || '');
    setTemplateDescription(t.config.description || '');
    setCategory(t.config.category || 'GENERAL');
    setPriority(t.config.priority || 'MEDIUM');
    setTags(Array.isArray(t.config.tags) ? t.config.tags : []);
    setRemindOffsetValue(t.config.remindOffset?.value ?? 1);
    setRemindOffsetUnit((t.config.remindOffset?.unit as TemplateOffsetUnit) || 'days');
    setRemindOffsetTime(t.config.remindOffset?.atTime || '09:00');
    setDueOffsetEnabled(Boolean(t.config.dueOffset));
    setDueOffsetValue(t.config.dueOffset?.value ?? 1);
    setDueOffsetUnit((t.config.dueOffset?.unit as TemplateOffsetUnit) || 'days');
    setDueOffsetTime(t.config.dueOffset?.atTime || '17:00');
    setIsRecurring(Boolean(t.config.isRecurring));
    setRecurringPattern(t.config.recurringPattern || 'DAILY');
    setRecurringInterval(t.config.recurringInterval || 1);
    setRecurringEndDays(t.config.recurringEndDays ?? '');
    setOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Name is required', color: 'red' });
      return;
    }

    if (remindOffsetTime && !/^\d{2}:\d{2}$/.test(remindOffsetTime)) {
      notifications.show({ title: 'Validation Error', message: 'Remind offset time must be HH:MM', color: 'red' });
      return;
    }
    if (dueOffsetEnabled && dueOffsetTime && !/^\d{2}:\d{2}$/.test(dueOffsetTime)) {
      notifications.show({ title: 'Validation Error', message: 'Due offset time must be HH:MM', color: 'red' });
      return;
    }

    const config: ReminderTemplateConfig = {
      ...(title.trim() && { title: title.trim() }),
      ...(templateDescription.trim() && { description: templateDescription.trim() }),
      category,
      priority,
      ...(tags.length > 0 && { tags }),
      remindOffset: {
        value: Number(remindOffsetValue) || 0,
        unit: remindOffsetUnit,
        ...(remindOffsetTime ? { atTime: remindOffsetTime } : {}),
      },
      ...(dueOffsetEnabled && {
        dueOffset: {
          value: Number(dueOffsetValue) || 0,
          unit: dueOffsetUnit,
          ...(dueOffsetTime ? { atTime: dueOffsetTime } : {}),
        },
      }),
      isRecurring,
      ...(isRecurring && {
        recurringPattern,
        recurringInterval: Math.max(1, Number(recurringInterval) || 1),
        recurringEndDays: recurringEndDays === '' ? null : Math.max(0, Number(recurringEndDays) || 0),
      }),
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload: { name: name.trim(), description: description.trim() || undefined, config } });
      } else {
        await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined, config });
      }
      setOpened(false);
      reset();
      notifications.show({ title: 'Success', message: 'Template saved', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to save template', color: 'red' });
    }
  };

  const handleDelete = async (t: ReminderTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(t.id);
      notifications.show({ title: 'Deleted', message: 'Template deleted', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to delete template', color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group style={{ flex: 1 }}>
          <TextInput placeholder="Search reminder templates..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} style={{ flex: 1 }} />
          <Select value={scope} data={TEMPLATE_SCOPE_OPTIONS} onChange={(v) => setScope((v as ScopeFilter) || 'all')} w={120} />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New Reminder Template</Button>
      </Group>

      {isLoading ? <Text c="dimmed">Loading templates...</Text> : (
        <Stack gap="sm">
          {filtered.map((t) => renderTemplateCard({
            id: t.id,
            name: t.name,
            description: t.description,
            isSystem: t.isSystem,
            extra: `Category: ${t.config.category || 'GENERAL'} | Priority: ${t.config.priority || 'MEDIUM'}`,
            onEdit: () => openEdit(t),
            onDelete: () => handleDelete(t),
          }))}
          {filtered.length === 0 && <Text c="dimmed">No reminder templates found.</Text>}
        </Stack>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? 'Edit Reminder Template' : 'New Reminder Template'} size="lg">
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <TextInput label="Default Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <Textarea
            label="Default Reminder Description"
            value={templateDescription}
            onChange={(e) => setTemplateDescription(e.currentTarget.value)}
            minRows={3}
          />
          <Group grow>
            <Select
              label="Category"
              value={category}
              data={['GENERAL', 'CLIENT', 'COMPLIANCE', 'CLOSING', 'FOLLOW_UP']}
              onChange={(value) => setCategory(value || 'GENERAL')}
            />
            <Select
              label="Priority"
              value={priority}
              data={['LOW', 'MEDIUM', 'HIGH', 'URGENT']}
              onChange={(value) => setPriority(value || 'MEDIUM')}
            />
          </Group>
          <TagsInput label="Tags" value={tags} onChange={setTags} />
          <Text size="sm" fw={500}>Remind Offset</Text>
          <Group grow>
            <NumberInput label="Value" value={remindOffsetValue} onChange={setRemindOffsetValue} min={0} />
            <Select
              label="Unit"
              value={remindOffsetUnit}
              data={OFFSET_UNIT_OPTIONS}
              onChange={(value) => setRemindOffsetUnit((value as TemplateOffsetUnit) || 'days')}
            />
            <TextInput
              label="At Time (HH:MM)"
              value={remindOffsetTime}
              onChange={(e) => setRemindOffsetTime(e.currentTarget.value)}
            />
          </Group>
          <Switch
            label="Include Due Offset"
            checked={dueOffsetEnabled}
            onChange={(e) => setDueOffsetEnabled(e.currentTarget.checked)}
          />
          {dueOffsetEnabled && (
            <Group grow>
              <NumberInput label="Due Value" value={dueOffsetValue} onChange={setDueOffsetValue} min={0} />
              <Select
                label="Due Unit"
                value={dueOffsetUnit}
                data={OFFSET_UNIT_OPTIONS}
                onChange={(value) => setDueOffsetUnit((value as TemplateOffsetUnit) || 'days')}
              />
              <TextInput
                label="Due Time (HH:MM)"
                value={dueOffsetTime}
                onChange={(e) => setDueOffsetTime(e.currentTarget.value)}
              />
            </Group>
          )}
          <Switch
            label="Recurring Reminder"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.currentTarget.checked)}
          />
          {isRecurring && (
            <Group grow>
              <Select
                label="Recurring Pattern"
                value={recurringPattern}
                data={['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']}
                onChange={(value) => setRecurringPattern(value || 'DAILY')}
              />
              <NumberInput
                label="Recurring Interval"
                value={recurringInterval}
                onChange={setRecurringInterval}
                min={1}
              />
              <NumberInput
                label="Recurring End (Days)"
                value={recurringEndDays}
                onChange={setRecurringEndDays}
                min={0}
                allowNegative={false}
              />
            </Group>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function ActivitiesTemplatesTab() {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<ActivityTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [interactionType, setInteractionType] = useState('INTERACTION_OTHER');
  const [activityDescription, setActivityDescription] = useState('');
  const [metadataDuration, setMetadataDuration] = useState<number | string>('');
  const [metadataOutcome, setMetadataOutcome] = useState('');
  const [advancedMetadataJson, setAdvancedMetadataJson] = useState('');
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpKind, setFollowUpKind] = useState<FollowUpKind>('TASK');
  const [followUpText, setFollowUpText] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDescription, setFollowUpDescription] = useState('');
  const [followUpPriority, setFollowUpPriority] = useState('MEDIUM');
  const [followUpCategory, setFollowUpCategory] = useState('FOLLOW_UP');
  const [followUpTags, setFollowUpTags] = useState<string[]>([]);
  const [dueOffsetEnabled, setDueOffsetEnabled] = useState(true);
  const [dueOffsetValue, setDueOffsetValue] = useState<number | string>(1);
  const [dueOffsetUnit, setDueOffsetUnit] = useState<TemplateOffsetUnit>('days');
  const [dueOffsetTime, setDueOffsetTime] = useState('09:00');
  const [remindOffsetEnabled, setRemindOffsetEnabled] = useState(false);
  const [remindOffsetValue, setRemindOffsetValue] = useState<number | string>(1);
  const [remindOffsetUnit, setRemindOffsetUnit] = useState<TemplateOffsetUnit>('days');
  const [remindOffsetTime, setRemindOffsetTime] = useState('09:00');

  const { data: templates = [], isLoading } = useActivityTemplates();
  const createMutation = useCreateActivityTemplate();
  const updateMutation = useUpdateActivityTemplate();
  const deleteMutation = useDeleteActivityTemplate();

  const filtered = useMemo(() => {
    const scoped = filterByScope(templates, scope);
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((t) => t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
  }, [templates, scope, search]);

  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setInteractionType('INTERACTION_OTHER');
    setActivityDescription('');
    setMetadataDuration('');
    setMetadataOutcome('');
    setAdvancedMetadataJson('');
    setFollowUpEnabled(false);
    setFollowUpKind('TASK');
    setFollowUpText('');
    setFollowUpTitle('');
    setFollowUpDescription('');
    setFollowUpPriority('MEDIUM');
    setFollowUpCategory('FOLLOW_UP');
    setFollowUpTags([]);
    setDueOffsetEnabled(true);
    setDueOffsetValue(1);
    setDueOffsetUnit('days');
    setDueOffsetTime('09:00');
    setRemindOffsetEnabled(false);
    setRemindOffsetValue(1);
    setRemindOffsetUnit('days');
    setRemindOffsetTime('09:00');
  };

  const openCreate = () => {
    reset();
    setOpened(true);
  };

  const openEdit = (t: ActivityTemplate) => {
    setEditing(t);
    setName(t.name);
    setDescription(t.description || '');
    setInteractionType(t.config.type || 'INTERACTION_OTHER');
    setActivityDescription(t.config.description || '');

    const metadata = t.config.metadata && typeof t.config.metadata === 'object'
      ? t.config.metadata as Record<string, unknown>
      : {};
    setMetadataDuration(typeof metadata.duration === 'number' ? metadata.duration : '');
    setMetadataOutcome(typeof metadata.outcome === 'string' ? metadata.outcome : '');

    const advancedMetadata = { ...metadata };
    delete advancedMetadata.duration;
    delete advancedMetadata.outcome;
    setAdvancedMetadataJson(Object.keys(advancedMetadata).length > 0 ? JSON.stringify(advancedMetadata, null, 2) : '');

    if (t.autoFollowUp && t.autoFollowUp.enabled !== false) {
      setFollowUpEnabled(true);
      setFollowUpKind(t.autoFollowUp.kind || 'TASK');
      setFollowUpText(t.autoFollowUp.text || '');
      setFollowUpTitle(t.autoFollowUp.title || '');
      setFollowUpDescription(t.autoFollowUp.description || '');
      setFollowUpPriority(t.autoFollowUp.priority || 'MEDIUM');
      setFollowUpCategory(t.autoFollowUp.category || 'FOLLOW_UP');
      setFollowUpTags(t.autoFollowUp.tags || []);
      setDueOffsetEnabled(Boolean(t.autoFollowUp.dueOffset));
      setDueOffsetValue(t.autoFollowUp.dueOffset?.value ?? 1);
      setDueOffsetUnit((t.autoFollowUp.dueOffset?.unit as TemplateOffsetUnit) || 'days');
      setDueOffsetTime(t.autoFollowUp.dueOffset?.atTime || '09:00');
      setRemindOffsetEnabled(Boolean(t.autoFollowUp.remindOffset));
      setRemindOffsetValue(t.autoFollowUp.remindOffset?.value ?? 1);
      setRemindOffsetUnit((t.autoFollowUp.remindOffset?.unit as TemplateOffsetUnit) || 'days');
      setRemindOffsetTime(t.autoFollowUp.remindOffset?.atTime || '09:00');
    } else {
      setFollowUpEnabled(false);
      setFollowUpKind('TASK');
      setFollowUpText('');
      setFollowUpTitle('');
      setFollowUpDescription('');
      setFollowUpPriority('MEDIUM');
      setFollowUpCategory('FOLLOW_UP');
      setFollowUpTags([]);
      setDueOffsetEnabled(true);
      setDueOffsetValue(1);
      setDueOffsetUnit('days');
      setDueOffsetTime('09:00');
      setRemindOffsetEnabled(false);
      setRemindOffsetValue(1);
      setRemindOffsetUnit('days');
      setRemindOffsetTime('09:00');
    }
    setOpened(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Name is required', color: 'red' });
      return;
    }

    if (dueOffsetEnabled && dueOffsetTime && !/^\d{2}:\d{2}$/.test(dueOffsetTime)) {
      notifications.show({ title: 'Validation Error', message: 'Due offset time must be HH:MM', color: 'red' });
      return;
    }
    if (remindOffsetEnabled && remindOffsetTime && !/^\d{2}:\d{2}$/.test(remindOffsetTime)) {
      notifications.show({ title: 'Validation Error', message: 'Reminder offset time must be HH:MM', color: 'red' });
      return;
    }

    const metadata: Record<string, unknown> = {};
    if (metadataDuration !== '') metadata.duration = Number(metadataDuration) || 0;
    if (metadataOutcome.trim()) metadata.outcome = metadataOutcome.trim();

    if (advancedMetadataJson.trim()) {
      try {
        const parsed = JSON.parse(advancedMetadataJson.trim());
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Advanced metadata must be a JSON object');
        }
        Object.assign(metadata, parsed);
      } catch (error) {
        notifications.show({ title: 'Validation Error', message: error instanceof Error ? error.message : 'Invalid metadata JSON', color: 'red' });
        return;
      }
    }

    const config: ActivityTemplateConfig = {
      type: interactionType,
      ...(activityDescription.trim() && { description: activityDescription.trim() }),
      ...(Object.keys(metadata).length > 0 && { metadata }),
    };

    let autoFollowUp: ActivityTemplateFollowUpConfig | null = null;
    if (followUpEnabled) {
      autoFollowUp = {
        kind: followUpKind,
        ...(followUpText.trim() && { text: followUpText.trim() }),
        ...(followUpTitle.trim() && { title: followUpTitle.trim() }),
        ...(followUpDescription.trim() && { description: followUpDescription.trim() }),
        priority: followUpPriority,
        ...(followUpKind === 'REMINDER' && { category: followUpCategory }),
        ...(followUpTags.length > 0 && { tags: followUpTags }),
        ...(dueOffsetEnabled && {
          dueOffset: {
            value: Number(dueOffsetValue) || 0,
            unit: dueOffsetUnit,
            ...(dueOffsetTime ? { atTime: dueOffsetTime } : {}),
          },
        }),
        ...(remindOffsetEnabled && {
          remindOffset: {
            value: Number(remindOffsetValue) || 0,
            unit: remindOffsetUnit,
            ...(remindOffsetTime ? { atTime: remindOffsetTime } : {}),
          },
        }),
      };
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload: { name: name.trim(), description: description.trim() || undefined, config, autoFollowUp } });
      } else {
        await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined, config, autoFollowUp });
      }
      setOpened(false);
      reset();
      notifications.show({ title: 'Success', message: 'Template saved', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to save template', color: 'red' });
    }
  };

  const handleDelete = async (t: ActivityTemplate) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(t.id);
      notifications.show({ title: 'Deleted', message: 'Template deleted', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Error', message: error instanceof Error ? error.message : 'Failed to delete template', color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group style={{ flex: 1 }}>
          <TextInput placeholder="Search activity templates..." value={search} onChange={(e) => setSearch(e.currentTarget.value)} style={{ flex: 1 }} />
          <Select value={scope} data={TEMPLATE_SCOPE_OPTIONS} onChange={(v) => setScope((v as ScopeFilter) || 'all')} w={120} />
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>New Activity Template</Button>
      </Group>

      {isLoading ? <Text c="dimmed">Loading templates...</Text> : (
        <Stack gap="sm">
          {filtered.map((t) => renderTemplateCard({
            id: t.id,
            name: t.name,
            description: t.description,
            isSystem: t.isSystem,
            extra: `Type: ${t.config.type || 'INTERACTION_OTHER'}${t.autoFollowUp ? ' | Auto follow-up enabled' : ''}`,
            onEdit: () => openEdit(t),
            onDelete: () => handleDelete(t),
          }))}
          {filtered.length === 0 && <Text c="dimmed">No activity templates found.</Text>}
        </Stack>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title={editing ? 'Edit Activity Template' : 'New Activity Template'} size="lg">
        <Stack>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <TextInput label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
          <Select
            label="Interaction Type"
            value={interactionType}
            data={['CALL_PLACED', 'CALL_RECEIVED', 'EMAIL_SENT', 'EMAIL_RECEIVED', 'MEETING', 'TEXT_SENT', 'TEXT_RECEIVED', 'INTERACTION_OTHER']}
            onChange={(value) => setInteractionType(value || 'INTERACTION_OTHER')}
          />
          <Textarea
            label="Default Activity Description"
            value={activityDescription}
            onChange={(e) => setActivityDescription(e.currentTarget.value)}
            minRows={3}
          />
          <Group grow>
            <NumberInput
              label="Default Duration (minutes)"
              value={metadataDuration}
              onChange={setMetadataDuration}
              min={0}
            />
            <TextInput
              label="Default Outcome"
              value={metadataOutcome}
              onChange={(e) => setMetadataOutcome(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Advanced Metadata JSON (optional)"
            value={advancedMetadataJson}
            onChange={(e) => setAdvancedMetadataJson(e.currentTarget.value)}
            minRows={3}
            placeholder='{"channel":"phone"}'
          />
          <Switch
            label="Enable Auto Follow-up"
            checked={followUpEnabled}
            onChange={(e) => setFollowUpEnabled(e.currentTarget.checked)}
          />
          {followUpEnabled && (
            <Stack gap="sm">
              <Group grow>
                <Select
                  label="Follow-up Kind"
                  value={followUpKind}
                  data={[{ value: 'TASK', label: 'Task' }, { value: 'REMINDER', label: 'Reminder' }]}
                  onChange={(value) => setFollowUpKind((value as FollowUpKind) || 'TASK')}
                />
                <Select
                  label="Follow-up Priority"
                  value={followUpPriority}
                  data={['LOW', 'MEDIUM', 'HIGH', 'URGENT']}
                  onChange={(value) => setFollowUpPriority(value || 'MEDIUM')}
                />
                {followUpKind === 'REMINDER' && (
                  <Select
                    label="Reminder Category"
                    value={followUpCategory}
                    data={['GENERAL', 'CLIENT', 'COMPLIANCE', 'CLOSING', 'FOLLOW_UP']}
                    onChange={(value) => setFollowUpCategory(value || 'FOLLOW_UP')}
                  />
                )}
              </Group>
              {followUpKind === 'TASK' ? (
                <TextInput
                  label="Default Task Text"
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.currentTarget.value)}
                />
              ) : (
                <TextInput
                  label="Default Reminder Title"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.currentTarget.value)}
                />
              )}
              <Textarea
                label="Follow-up Description"
                value={followUpDescription}
                onChange={(e) => setFollowUpDescription(e.currentTarget.value)}
                minRows={2}
              />
              <TagsInput label="Follow-up Tags" value={followUpTags} onChange={setFollowUpTags} />
              <Switch
                label="Include Due Offset"
                checked={dueOffsetEnabled}
                onChange={(e) => setDueOffsetEnabled(e.currentTarget.checked)}
              />
              {dueOffsetEnabled && (
                <Group grow>
                  <NumberInput label="Due Value" value={dueOffsetValue} onChange={setDueOffsetValue} min={0} />
                  <Select
                    label="Due Unit"
                    value={dueOffsetUnit}
                    data={OFFSET_UNIT_OPTIONS}
                    onChange={(value) => setDueOffsetUnit((value as TemplateOffsetUnit) || 'days')}
                  />
                  <TextInput
                    label="Due Time (HH:MM)"
                    value={dueOffsetTime}
                    onChange={(e) => setDueOffsetTime(e.currentTarget.value)}
                  />
                </Group>
              )}
              <Switch
                label="Include Reminder Offset"
                checked={remindOffsetEnabled}
                onChange={(e) => setRemindOffsetEnabled(e.currentTarget.checked)}
              />
              {remindOffsetEnabled && (
                <Group grow>
                  <NumberInput label="Reminder Value" value={remindOffsetValue} onChange={setRemindOffsetValue} min={0} />
                  <Select
                    label="Reminder Unit"
                    value={remindOffsetUnit}
                    data={OFFSET_UNIT_OPTIONS}
                    onChange={(value) => setRemindOffsetUnit((value as TemplateOffsetUnit) || 'days')}
                  />
                  <TextInput
                    label="Reminder Time (HH:MM)"
                    value={remindOffsetTime}
                    onChange={(e) => setRemindOffsetTime(e.currentTarget.value)}
                  />
                </Group>
              )}
            </Stack>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>Cancel</Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

const VALID_TABS = ['notes', 'tasks', 'reminders', 'activities'];

export default function TemplatesHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'notes';
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : 'notes';

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group gap="sm">
          <IconTemplate size={28} />
          <div>
            <Title order={2}>Templates</Title>
            <Text size="sm" c="dimmed">
              Manage personal and system templates for notes, tasks, reminders, and activities.
            </Text>
          </div>
        </Group>

        <Tabs value={activeTab} onChange={(value) => setSearchParams({ tab: value || 'notes' }, { replace: true })}>
          <Tabs.List>
            <Tabs.Tab value="notes">Notes</Tabs.Tab>
            <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
            <Tabs.Tab value="reminders">Reminders</Tabs.Tab>
            <Tabs.Tab value="activities">Activities</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="notes" pt="md">
            <NotesTemplatesTab />
          </Tabs.Panel>
          <Tabs.Panel value="tasks" pt="md">
            <TasksTemplatesTab />
          </Tabs.Panel>
          <Tabs.Panel value="reminders" pt="md">
            <RemindersTemplatesTab />
          </Tabs.Panel>
          <Tabs.Panel value="activities" pt="md">
            <ActivitiesTemplatesTab />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
