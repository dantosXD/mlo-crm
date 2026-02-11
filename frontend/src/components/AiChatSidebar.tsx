import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Drawer,
  ActionIcon,
  Tooltip,
  Stack,
  Group,
  Text,
  TextInput,
  ScrollArea,
  Paper,
  Loader,
  Badge,
  Box,
  ThemeIcon,
} from '@mantine/core';
import {
  IconRobot,
  IconSend,
  IconUser,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAuthStore } from '../stores/authStore';
import { API_URL } from '../utils/apiBase';

function getMessageText(msg: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('');
}

export function AiChatSidebar() {
  const [opened, setOpened] = useState(false);
  const [input, setInput] = useState('');
  const { accessToken } = useAuthStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL.replace(/\/api$/, '')}/api/agent/chat`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    [accessToken]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({ transport });

  const isBusy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    if (opened) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [opened]);

  const handleClear = () => {
    setMessages([]);
  };

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput('');
  };

  const quickActions = [
    "What's my daily briefing?",
    'Show my pipeline summary',
    'What tasks are overdue?',
    'Search for recent activity',
  ];

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip label="AI Assistant" position="left" withArrow>
        <ActionIcon
          variant="filled"
          color="blue"
          size={48}
          radius="xl"
          onClick={() => setOpened(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
          aria-label="Open AI Assistant"
        >
          <IconSparkles size={24} />
        </ActionIcon>
      </Tooltip>

      {/* Chat Drawer */}
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="blue" size="sm">
              <IconRobot size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              MLO AI Assistant
            </Text>
            <Badge size="xs" variant="light" color="blue">
              Beta
            </Badge>
          </Group>
        }
        position="right"
        size="md"
        padding="sm"
        styles={{
          body: {
            height: 'calc(100% - 60px)',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Stack gap={0} style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          {/* Messages Area */}
          <ScrollArea style={{ flex: 1 }} viewportRef={scrollRef} offsetScrollbars>
            <Stack gap="sm" p="xs">
              {messages.length === 0 && (
                <Box py="xl" style={{ textAlign: 'center' }}>
                  <ThemeIcon
                    variant="light"
                    color="blue"
                    size={48}
                    radius="xl"
                    mx="auto"
                    mb="md"
                  >
                    <IconSparkles size={24} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" mb={4}>
                    How can I help you today?
                  </Text>
                  <Text size="xs" c="dimmed" maw={280} mx="auto" mb="md">
                    Ask about your clients, tasks, pipeline, or anything else. I
                    can also create tasks, add notes, and draft communications.
                  </Text>
                  <Stack gap="xs">
                    {quickActions.map((action) => (
                      <Paper
                        key={action}
                        withBorder
                        p="xs"
                        radius="md"
                        style={{ cursor: 'pointer', textAlign: 'left' }}
                        onClick={() => handleSend(action)}
                      >
                        <Text size="xs">{action}</Text>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {messages.map((msg) => (
                <Group
                  key={msg.id}
                  align="flex-start"
                  gap="xs"
                  wrap="nowrap"
                  style={{
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <ThemeIcon
                    variant="light"
                    color={msg.role === 'user' ? 'gray' : 'blue'}
                    size="sm"
                    radius="xl"
                    mt={4}
                  >
                    {msg.role === 'user' ? (
                      <IconUser size={12} />
                    ) : (
                      <IconRobot size={12} />
                    )}
                  </ThemeIcon>
                  <Paper
                    p="xs"
                    radius="md"
                    style={{
                      maxWidth: '85%',
                      backgroundColor:
                        msg.role === 'user'
                          ? 'var(--mantine-color-blue-light)'
                          : 'var(--mantine-color-gray-light)',
                    }}
                  >
                    <Text
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {getMessageText(msg as any)}
                    </Text>
                  </Paper>
                </Group>
              ))}

              {status === 'submitted' && (
                <Group align="flex-start" gap="xs" wrap="nowrap">
                  <ThemeIcon variant="light" color="blue" size="sm" radius="xl" mt={4}>
                    <IconRobot size={12} />
                  </ThemeIcon>
                  <Paper
                    p="xs"
                    radius="md"
                    style={{
                      backgroundColor: 'var(--mantine-color-gray-light)',
                    }}
                  >
                    <Loader size="xs" type="dots" />
                  </Paper>
                </Group>
              )}

              {error && (
                <Paper p="xs" radius="md" bg="red.0">
                  <Text size="xs" c="red">
                    {error.message || 'Something went wrong. Please try again.'}
                  </Text>
                </Paper>
              )}
            </Stack>
          </ScrollArea>

          {/* Input Area */}
          <Box
            p="xs"
            style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
            >
              <Group gap="xs" wrap="nowrap">
                {messages.length > 0 && (
                  <Tooltip label="Clear chat" position="top">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="lg"
                      onClick={handleClear}
                      aria-label="Clear chat"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                <TextInput
                  ref={inputRef}
                  placeholder="Ask me anything..."
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  disabled={isBusy}
                  style={{ flex: 1 }}
                  size="sm"
                  radius="md"
                  rightSection={
                    <ActionIcon
                      type="submit"
                      variant="filled"
                      color="blue"
                      size="sm"
                      radius="xl"
                      disabled={!input.trim() || isBusy}
                      aria-label="Send message"
                    >
                      <IconSend size={14} />
                    </ActionIcon>
                  }
                />
              </Group>
            </form>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}

export default AiChatSidebar;
