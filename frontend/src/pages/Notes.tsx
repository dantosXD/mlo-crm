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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconPin, IconEye, IconNotes } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { api } from '../utils/api';
import { formatRelativeTime } from '../utils/dateUtils';
import type { Note } from '../types';

export default function Notes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Sync search to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    setSearchParams(params, { replace: true });
  }, [searchQuery, setSearchParams]);

  const { data: notes = [], isLoading: loading } = useQuery({
    queryKey: ['notes', searchQuery],
    queryFn: async () => {
      const url = searchQuery
        ? `/notes?search=${encodeURIComponent(searchQuery)}`
        : `/notes`;
      const response = await api.get(url);
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json() as Promise<Note[]>;
    },
    enabled: !!accessToken,
  });

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
          placeholder="Search all notes..."
          leftSection={<IconSearch size={16} aria-hidden="true" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
        />
      </Group>

      {/* Notes List */}
      <Paper shadow="xs" p="md" withBorder>
        {sortedNotes.length === 0 ? (
          searchQuery ? (
            <EmptyState
              iconType="notes"
              title="No matching notes"
              description="No notes match your search. Try a different search term."
              ctaLabel="Clear Search"
              onCtaClick={() => setSearchQuery('')}
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

                <Text size="sm" mb="xs" style={{ whiteSpace: 'pre-wrap' }}>
                  {note.text}
                </Text>

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
            Showing {sortedNotes.length} note{sortedNotes.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </Text>
        )}
      </Paper>
    </Container>
  );
}
