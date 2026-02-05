import React, { useState, useEffect, useRef } from 'react';
import {
  Popover,
  TextInput,
  Stack,
  Text,
  Group,
  Badge,
  ScrollArea,
  Box,
  LoadingOverlay,
  Button,
  Divider,
} from '@mantine/core';
import {
  IconSearch,
  IconCheckbox,
  IconCalendar,
  IconBell,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/apiBase';

interface SearchResult {
  type: 'task' | 'event' | 'reminder';
  id: string;
  title?: string;
  text?: string;
  description?: string;
  priority?: string;
  category?: string;
  eventType?: string;
  startTime?: string;
  remindAt?: string;
  dueDate?: string;
  status?: string;
  client?: {
    id: string;
    name: string;
  };
}

interface UnifiedSearchProps {
  placeholder?: string;
}

export const UnifiedSearch: React.FC<UnifiedSearchProps> = ({
  placeholder = 'Search tasks, events, reminders...',
}) => {
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{
    tasks: SearchResult[];
    events: SearchResult[];
    reminders: SearchResult[];
  }>({ tasks: [], events: [], reminders: [] });
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setResults({ tasks: [], events: [], reminders: [] });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get(`/integration/unified-search?q=${encodeURIComponent(debouncedQuery)}`);
        setResults(response.data);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedQuery]);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'gray';
      default: return 'blue';
    }
  };

  const getEventTypeColor = (eventType?: string) => {
    switch (eventType) {
      case 'MEETING': return 'blue';
      case 'APPOINTMENT': return 'green';
      case 'CLOSING': return 'orange';
      case 'FOLLOW_UP': return 'yellow';
      default: return 'gray';
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'CLIENT': return 'blue';
      case 'COMPLIANCE': return 'red';
      case 'CLOSING': return 'green';
      case 'FOLLOW_UP': return 'yellow';
      default: return 'gray';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setOpened(false);
    setQuery('');

    switch (result.type) {
      case 'task':
        // Navigate to tasks dashboard (could highlight the task)
        navigate('/tasks');
        break;
      case 'event':
        navigate('/calendar');
        break;
      case 'reminder':
        navigate('/reminders');
        break;
    }
  };

  const totalResults = results.tasks.length + results.events.length + results.reminders.length;

  const ResultItem: React.FC<{ result: SearchResult }> = ({ result }) => (
    <Box
      p="sm"
      style={{
        cursor: 'pointer',
        borderRadius: '4px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f8f9fa';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      onClick={() => handleResultClick(result)}
    >
      <Group justify="space-between" align="flex-start" mb="xs">
        <Group gap="xs" style={{ flex: 1 }}>
          {result.type === 'task' && <IconCheckbox size={16} color="#228be6" />}
          {result.type === 'event' && <IconCalendar size={16} color="#40c057" />}
          {result.type === 'reminder' && <IconBell size={16} color="#fab005" />}

          <Text size="sm" fw={500} lineClamp={1} style={{ flex: 1 }}>
            {result.title || result.text}
          </Text>
        </Group>

        <Group gap="xs">
          {result.priority && (
            <Badge size="xs" color={getPriorityColor(result.priority)}>
              {result.priority}
            </Badge>
          )}
          {result.eventType && (
            <Badge size="xs" color={getEventTypeColor(result.eventType)}>
              {result.eventType}
            </Badge>
          )}
          {result.category && (
            <Badge size="xs" color={getCategoryColor(result.category)}>
              {result.category}
            </Badge>
          )}
        </Group>
      </Group>

      {result.description && (
        <Text size="xs" c="dimmed" lineClamp={1} mb="xs">
          {result.description}
        </Text>
      )}

      <Group gap="xs">
        <Text size="xs" c="dimmed">
          {result.type === 'task' && 'Task'}
          {result.type === 'event' && 'Event'}
          {result.type === 'reminder' && 'Reminder'}
        </Text>
        {result.client && (
          <>
            <Text size="xs" c="dimmed">•</Text>
            <Text size="xs" c="blue">
              {result.client.name}
            </Text>
          </>
        )}
      </Group>
    </Box>
  );

  return (
    <Popover
      width={400}
      position="bottom"
      withArrow
      shadow="md"
      opened={opened && query.length > 0}
      onChange={setOpened}
    >
      <Popover.Target>
        <TextInput
          ref={searchInputRef}
          placeholder={placeholder}
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            if (!opened) setOpened(true);
          }}
          onFocus={() => {
            if (query.length > 0) setOpened(true);
          }}
          style={{ minWidth: 300 }}
        />
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Stack gap={0}>
          {loading ? (
            <Box p="md" style={{ textAlign: 'center' }}>
              <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
            </Box>
          ) : query.length === 0 ? (
            <Box p="md">
              <Text size="sm" c="dimmed" ta="center">
                Start typing to search...
              </Text>
            </Box>
          ) : totalResults === 0 ? (
            <Box p="md">
              <Text size="sm" c="dimmed" ta="center">
                No results found for "{query}"
              </Text>
            </Box>
          ) : (
            <>
              {/* Tasks Section */}
              {results.tasks.length > 0 && (
                <>
                  <Box px="sm" pt="sm" pb="xs">
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      Tasks ({results.tasks.length})
                    </Text>
                  </Box>
                  <Stack gap={2} px="sm">
                    {results.tasks.map((result) => (
                      <ResultItem key={result.id} result={result} />
                    ))}
                  </Stack>
                  {results.events.length > 0 && <Divider my="sm" />}
                </>
              )}

              {/* Events Section */}
              {results.events.length > 0 && (
                <>
                  <Box px="sm" pt="sm" pb="xs">
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      Events ({results.events.length})
                    </Text>
                  </Box>
                  <Stack gap={2} px="sm">
                    {results.events.map((result) => (
                      <ResultItem key={result.id} result={result} />
                    ))}
                  </Stack>
                  {results.reminders.length > 0 && <Divider my="sm" />}
                </>
              )}

              {/* Reminders Section */}
              {results.reminders.length > 0 && (
                <>
                  <Box px="sm" pt="sm" pb="xs">
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                      Reminders ({results.reminders.length})
                    </Text>
                  </Box>
                  <Stack gap={2} px="sm" pb="sm">
                    {results.reminders.map((result) => (
                      <ResultItem key={result.id} result={result} />
                    ))}
                  </Stack>
                </>
              )}

              {/* View All Results Button */}
              {totalResults > 0 && (
                <>
                  <Divider />
                  <Box p="sm">
                    <Button
                      variant="light"
                      size="sm"
                      fullWidth
                      onClick={() => {
                        navigate('/search?q=' + encodeURIComponent(query));
                        setOpened(false);
                        setQuery('');
                      }}
                    >
                      View All Results ({totalResults})
                    </Button>
                  </Box>
                </>
              )}
            </>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default UnifiedSearch;
