import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { Client, Note, Task, LoanScenario, ClientDocument, Activity } from '../types';

type ClientQueryOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async ({ signal }) => {
      const response = await api.get(`/clients/${id}`, { signal });
      if (response.status === 403) throw Object.assign(new Error('Access denied'), { status: 403 });
      if (response.status === 404) throw Object.assign(new Error('Client not found'), { status: 404 });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json() as Promise<Client>;
    },
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}

export function useClientNotes(id: string | undefined, options?: ClientQueryOptions) {
  return useQuery({
    queryKey: ['client-notes', id],
    queryFn: async ({ signal }) => {
      const response = await api.get(`/notes?client_id=${id}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json() as Promise<Note[]>;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    refetchOnWindowFocus: false,
  });
}

export function useClientTasks(id: string | undefined, options?: ClientQueryOptions) {
  return useQuery({
    queryKey: ['client-tasks', id],
    queryFn: async ({ signal }) => {
      const response = await api.get(`/tasks?client_id=${id}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      return Array.isArray(data) ? data as Task[] : (data.tasks || []) as Task[];
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    refetchOnWindowFocus: false,
  });
}

export function useClientLoanScenarios(id: string | undefined, options?: ClientQueryOptions) {
  return useQuery({
    queryKey: ['client-loan-scenarios', id],
    queryFn: async ({ signal }) => {
      const response = await api.get(`/loan-scenarios?client_id=${id}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch loan scenarios');
      return response.json() as Promise<LoanScenario[]>;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    refetchOnWindowFocus: false,
  });
}

export function useClientDocuments(id: string | undefined, options?: ClientQueryOptions) {
  return useQuery({
    queryKey: ['client-documents', id],
    queryFn: async ({ signal }) => {
      const response = await api.get(`/documents?client_id=${id}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch documents');
      return response.json() as Promise<ClientDocument[]>;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    refetchOnWindowFocus: false,
  });
}

export function useClientActivities(id: string | undefined, options?: ClientQueryOptions) {
  return useQuery({
    queryKey: ['client-activities', id],
    queryFn: async ({ signal }) => {
      const response = await api.get(`/activities?client_id=${id}`, { signal });
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json() as Promise<Activity[]>;
    },
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime,
    refetchOnWindowFocus: false,
  });
}

export function useLogInteraction(clientId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: string;
      description: string;
      metadata?: Record<string, any>;
      occurredAt?: string;
      templateId?: string;
      followUp?: Record<string, any>;
    }) => {
      const response = await api.post('/activities', {
        clientId,
        ...data,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to log interaction');
      }
      return response.json() as Promise<Activity>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-activities', clientId] });
    },
  });
}
