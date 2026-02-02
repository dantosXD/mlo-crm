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
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from '../components/EmptyState';
import { API_URL } from '../utils/apiBase';

// Helper function to format relative time (e.g., "just now", "5 minutes ago", "2 hours ago")
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
  }

  // For older dates, show the full date
  return date.toLocaleDateString();
};

interface Note {
  id: string;
  clientId: string;
  clientName: string;
  text: string;
  tags: string[];
  isPinned: boolean;
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function Notes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken } = useAuthStore();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Sync search to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    setSearchParams(params, { replace: true });
  }, [searchQuery, setSearchParams]);

  // Fetch notes
  useEffect(() => {
    fetchNotes();
  }, [accessToken, searchQuery]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const url = searchQuery
        ? `${API_URL}/notes?search=${encodeURIComponent(searchQuery)}`
        : `${API_URL}/notes`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }

      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load notes',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
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
