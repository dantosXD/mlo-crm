import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Title,
  Group,
  TextInput,
  Paper,
  Text,
  Badge,
  Card,
  Stack,
  LoadingOverlay,
  Anchor,
  ActionIcon,
  Tooltip,
  Button,
  Pagination,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconPin, IconEye, IconNotes } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { api } from '../utils/api';
import { formatRelativeTime } from '../utils/dateUtils';
import type { Note } from '../types';

interface NotesListResponse {
  notes: Note[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Notes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [page, setPage] = useState(() => {
    const parsed = parseInt(searchParams.get('page') || '1', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const notesPerPage = 25;

  // Sync search to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [searchQuery, page, setSearchParams]);

  const { data: notesResponse, isLoading: loading } = useQuery<NotesListResponse>({
    queryKey: ['notes', searchQuery, page],
    queryFn: async () => {
      const query = new URLSearchParams({
        paginated: 'true',
        page: String(page),
        limit: String(notesPerPage),
      });
      if (searchQuery) {
        query.set('search', searchQuery);
      }
      const url = `/notes?${query.toString()}`;
      const response = await api.get(url);
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json() as Promise<NotesListResponse>;
    },
    enabled: !!accessToken,
  });

  const notes = notesResponse?.notes || [];
  const pagination = notesResponse?.pagination || {
    page,
    limit: notesPerPage,
    total: 0,
    totalPages: 0,
  };

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} />

      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <IconNotes size={28} stroke={1.5} aria-hidden="true" />
          <Title order={2}>Notes Hub</Title>
        </Group>
      </Group>

      {/* Search */}
      <Group mb="md" gap="md">
        <TextInput
          placeholder="Search notes or client names..."
          leftSection={<IconSearch size={16} aria-hidden="true" />}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          style={{ flex: 1 }}
        />
      </Group>
      <Text size="xs" c="dimmed" mb="md">
        Search matches note text and exact full client name.
      </Text>

      {/* Notes List */}
      <Paper shadow="xs" p="md" withBorder>
        {sortedNotes.length === 0 ? (
          searchQuery ? (
            <EmptyState
              iconType="notes"
              title="No matching notes"
              description="No notes match your search. Try a different search term."
              ctaLabel="Clear Search"
              onCtaClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
            />
          ) : (
            <EmptyState
              iconType="notes"
              title="No notes yet"
              description="Notes from all clients will appear here. Create notes from a client's detail page."
            />
          )
        ) : (
          <Stack gap="md">
            {sortedNotes.map((note) => (
              <Card key={note.id} withBorder shadow="sm" p="md" style={{ borderLeft: note.isPinned ? '4px solid #228be6' : undefined }}>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    {note.isPinned && (
                      <Tooltip label="Pinned">
                        <IconPin size={16} color="#228be6" aria-hidden="true" />
                      </Tooltip>
                    )}
                    <Anchor
                      component="button"
                      type="button"
                      onClick={() => navigate(`/clients/${note.clientId}`)}
                      fw={500}
                    >
                      {note.clientName}
                    </Anchor>
                  </Group>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" title={new Date(note.createdAt).toLocaleString()}>
                      {formatRelativeTime(note.createdAt)}
                    </Text>
                    <Tooltip label="View Client">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => navigate(`/clients/${note.clientId}`)}
                        aria-label={`View client details`}
                      >
                        <IconEye size={16} aria-hidden="true" />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                <Text
                  size="sm"
                  mb="xs"
                  style={{ whiteSpace: 'pre-wrap' }}
                  lineClamp={expandedNotes[note.id] ? undefined : 6}
                >
                  {note.text}
                </Text>
                {note.text.length > 280 && (
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    onClick={() => setExpandedNotes((prev) => ({ ...prev, [note.id]: !prev[note.id] }))}
                    mb="xs"
                  >
                    {expandedNotes[note.id] ? 'Show less' : 'Show more'}
                  </Button>
                )}

                <Group justify="space-between">
                  <Group gap={4}>
                    {note.tags && note.tags.length > 0 && note.tags.map((tag, index) => (
                      <Badge key={index} size="sm" variant="outline" color="violet">
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                  <Text size="xs" c="dimmed">
                    by {note.createdBy?.name || 'Unknown'}
                  </Text>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

        {sortedNotes.length > 0 && (
          <Text c="dimmed" size="sm" ta="center" mt="md">
            Showing {Math.max((pagination.page - 1) * pagination.limit + 1, 1)}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} note
            {pagination.total !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </Text>
        )}

        {pagination.totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              total={pagination.totalPages}
              value={pagination.page}
              onChange={(nextPage) => setPage(nextPage)}
            />
          </Group>
        )}
      </Paper>
    </Container>
  );
}
