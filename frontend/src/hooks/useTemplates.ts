import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type {
  NoteTemplate,
  TaskTemplate,
  ReminderTemplate,
  ActivityTemplate,
  ReminderTemplateConfig,
  ActivityTemplateConfig,
  ActivityTemplateFollowUpConfig,
} from '../types';

export const TEMPLATE_QUERY_KEYS = {
  notes: ['note-templates'] as const,
  tasks: ['task-templates'] as const,
  reminders: ['reminder-templates'] as const,
  activities: ['activity-templates'] as const,
};

interface NoteTemplateInput {
  name: string;
  description?: string;
  content: string;
  tags?: string[];
}

interface TaskTemplateInput {
  name: string;
  description?: string;
  text: string;
  type?: string;
  priority?: string;
  tags?: string[];
  dueDays?: number | null;
  steps?: string[];
}

interface ReminderTemplateInput {
  name: string;
  description?: string;
  config: ReminderTemplateConfig;
}

interface ActivityTemplateInput {
  name: string;
  description?: string;
  config: ActivityTemplateConfig;
  autoFollowUp?: ActivityTemplateFollowUpConfig | null;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : fallbackMessage;
    throw new Error(message);
  }
  return payload as T;
}

export function useNoteTemplates(enabled = true) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.notes,
    queryFn: async () => {
      const response = await api.get('/notes/templates');
      return parseApiResponse<NoteTemplate[]>(response, 'Failed to fetch note templates');
    },
    enabled,
  });
}

export function useCreateNoteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NoteTemplateInput) => {
      const response = await api.post('/notes/templates', payload);
      return parseApiResponse<NoteTemplate>(response, 'Failed to create note template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.notes });
    },
  });
}

export function useUpdateNoteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<NoteTemplateInput> }) => {
      const response = await api.put(`/notes/templates/${id}`, payload);
      return parseApiResponse<NoteTemplate>(response, 'Failed to update note template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.notes });
    },
  });
}

export function useDeleteNoteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/notes/templates/${id}`);
      return parseApiResponse<{ message: string }>(response, 'Failed to delete note template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.notes });
    },
  });
}

export function useTaskTemplates(enabled = true) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.tasks,
    queryFn: async () => {
      const response = await api.get('/tasks/templates');
      return parseApiResponse<TaskTemplate[]>(response, 'Failed to fetch task templates');
    },
    enabled,
  });
}

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TaskTemplateInput) => {
      const response = await api.post('/tasks/templates', payload);
      return parseApiResponse<TaskTemplate>(response, 'Failed to create task template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.tasks });
    },
  });
}

export function useUpdateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<TaskTemplateInput> }) => {
      const response = await api.put(`/tasks/templates/${id}`, payload);
      return parseApiResponse<TaskTemplate>(response, 'Failed to update task template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.tasks });
    },
  });
}

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/tasks/templates/${id}`);
      return parseApiResponse<{ message: string }>(response, 'Failed to delete task template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.tasks });
    },
  });
}

export function useReminderTemplates(enabled = true) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.reminders,
    queryFn: async () => {
      const response = await api.get('/reminders/templates');
      return parseApiResponse<ReminderTemplate[]>(response, 'Failed to fetch reminder templates');
    },
    enabled,
  });
}

export function useCreateReminderTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ReminderTemplateInput) => {
      const response = await api.post('/reminders/templates', payload);
      return parseApiResponse<ReminderTemplate>(response, 'Failed to create reminder template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.reminders });
    },
  });
}

export function useUpdateReminderTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ReminderTemplateInput> }) => {
      const response = await api.put(`/reminders/templates/${id}`, payload);
      return parseApiResponse<ReminderTemplate>(response, 'Failed to update reminder template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.reminders });
    },
  });
}

export function useDeleteReminderTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/reminders/templates/${id}`);
      return parseApiResponse<{ message: string }>(response, 'Failed to delete reminder template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.reminders });
    },
  });
}

export function useActivityTemplates(enabled = true) {
  return useQuery({
    queryKey: TEMPLATE_QUERY_KEYS.activities,
    queryFn: async () => {
      const response = await api.get('/activities/templates');
      return parseApiResponse<ActivityTemplate[]>(response, 'Failed to fetch activity templates');
    },
    enabled,
  });
}

export function useCreateActivityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ActivityTemplateInput) => {
      const response = await api.post('/activities/templates', payload);
      return parseApiResponse<ActivityTemplate>(response, 'Failed to create activity template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.activities });
    },
  });
}

export function useUpdateActivityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ActivityTemplateInput> }) => {
      const response = await api.put(`/activities/templates/${id}`, payload);
      return parseApiResponse<ActivityTemplate>(response, 'Failed to update activity template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.activities });
    },
  });
}

export function useDeleteActivityTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/activities/templates/${id}`);
      return parseApiResponse<{ message: string }>(response, 'Failed to delete activity template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEMPLATE_QUERY_KEYS.activities });
    },
  });
}
