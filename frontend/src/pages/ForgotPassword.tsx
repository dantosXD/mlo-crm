import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { API_URL } from '../utils/apiBase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debugResetLink, setDebugResetLink] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setDebugResetLink(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit password reset request');
      }

      setSuccessMessage(
        data.message || 'If an account exists for that email, a password reset link has been sent.'
      );

      if (typeof data.debugResetLink === 'string' && data.debugResetLink.length > 0) {
        try {
          const parsed = new URL(data.debugResetLink);
          setDebugResetLink(`${parsed.pathname}${parsed.search}`);
        } catch {
          setDebugResetLink(data.debugResetLink);
        }
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to submit password reset request'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
      }}
    >
      <Container size={420} my={40}>
        <Title ta="center" fw={700} style={{ color: '#228be6' }}>
          Reset Your Password
        </Title>
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Enter your email and we will send a reset link.
        </Text>

        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
                  {error}
                </Alert>
              )}

              {successMessage && (
                <Alert icon={<IconCheck size={16} />} color="green" title="Request sent">
                  <Text size="sm">{successMessage}</Text>
                  {debugResetLink && (
                    <Text size="sm" mt="xs">
                      Dev reset link:{' '}
                      <Anchor component={Link} to={debugResetLink}>
                        Open reset page
                      </Anchor>
                    </Text>
                  )}
                </Alert>
              )}

              <TextInput
                label="Email"
                placeholder="your@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                autoComplete="email"
              />

              <Button type="submit" fullWidth loading={submitting}>
                Send Reset Link
              </Button>
            </Stack>
          </form>

          <Text ta="center" mt="md">
            <Anchor component={Link} to="/login" size="sm">
              Back to Sign In
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}
