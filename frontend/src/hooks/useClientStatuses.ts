import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

const DEFAULT_STATUSES = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'PRE_QUALIFIED', label: 'Pre-Qualified' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'UNDERWRITING', label: 'Underwriting' },
  { value: 'CLEAR_TO_CLOSE', label: 'Clear to Close' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export function useClientStatuses() {
  const { data: fetchedStatuses } = useQuery({
    queryKey: ['client-statuses'],
    queryFn: async () => {
      const response = await api.get('/clients/statuses');
      if (!response.ok) return DEFAULT_STATUSES;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? data : DEFAULT_STATUSES;
    },
    staleTime: 300_000, // 5 minutes
  });

  return fetchedStatuses ?? DEFAULT_STATUSES;
}
