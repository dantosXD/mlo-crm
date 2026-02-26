import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Container,
  Anchor,
  Stack,
  Box,
  Alert,
  Checkbox,
  Group,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('mlo-remember-me') === 'true');

  // Get the intended destination from location state or URL params
  const from = (location.state as { from?: string })?.from || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    // Clear any previous errors when component mounts
    clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mlo-remember-me', String(rememberMe));
    if (rememberMe) {
      localStorage.setItem('mlo-session-persistent', 'true');
    } else {
      localStorage.removeItem('mlo-session-persistent');
    }
    const success = await login(email, password);
    if (success) {
      navigate(from, { replace: true });
    } else {
      // Clear password field on failed login for security
      setPassword('');
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
          MLO Dashboard
        </Title>
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Mortgage Loan Origination System
        </Text>

        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} aria-hidden="true" />}
                  title="Error"
                  color="red"
                  variant="light"
                  onClose={clearError}
                  withCloseButton
                >
                  {error}
                </Alert>
              )}

              <TextInput
                label="Email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                type="email"
                autoComplete="email"
                data-testid="email-input"
              />

              <PasswordInput
                label="Password"
                placeholder="Your password"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                data-testid="password-input"
              />

              <Group justify="space-between" mt="xs">
                <Checkbox
                  label="Remember me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.currentTarget.checked)}
                />
              </Group>

              <Button
                type="submit"
                fullWidth
                loading={isLoading}
                data-testid="sign-in-button"
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Text ta="center" mt="md">
            <Anchor
              component="a"
              href="/forgot-password"
              size="sm"
              data-testid="forgot-password-link"
            >
              Forgot Password?
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

export default Login;
