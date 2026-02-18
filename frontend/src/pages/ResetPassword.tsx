import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { API_URL } from '../utils/apiBase';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenValid(false);
        setError('Reset token is missing. Please request a new password reset link.');
        return;
      }

      try {
        setValidating(true);
        setError(null);
        const response = await fetch(
          `${API_URL}/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || 'Reset token is invalid or expired');
        }

        setTokenValid(true);
      } catch (validationError) {
        setTokenValid(false);
        setError(
          validationError instanceof Error
            ? validationError.message
            : 'Reset token is invalid or expired'
        );
      } finally {
        setValidating(false);
      }
    };

    void validateToken();
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!token) {
      setError('Reset token is missing. Please request a new password reset link.');
      return;
    }

    if (!password) {
      setError('New password is required');
      return;
    }

    if (password.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccessMessage(data.message || 'Password reset successfully. Redirecting to sign in...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to reset password');
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
          Set New Password
        </Title>
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Choose a new password for your account.
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
                <Alert icon={<IconCheck size={16} />} color="green" title="Success">
                  {successMessage}
                </Alert>
              )}

              <PasswordInput
                label="New Password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                disabled={!tokenValid || validating || !!successMessage}
                autoComplete="new-password"
              />

              <PasswordInput
                label="Confirm New Password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                disabled={!tokenValid || validating || !!successMessage}
                autoComplete="new-password"
              />

              <Button
                type="submit"
                fullWidth
                loading={submitting || validating}
                disabled={!tokenValid || !!successMessage}
              >
                Reset Password
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
