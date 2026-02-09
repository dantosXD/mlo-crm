import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Container, Title, Text, Button, Stack, Paper, Code } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="sm" py="xl">
          <Paper p="xl" withBorder>
            <Stack align="center" gap="md">
              <IconAlertTriangle size={48} color="var(--mantine-color-red-6)" />
              <Title order={2}>Something went wrong</Title>
              <Text c="dimmed" ta="center">
                An unexpected error occurred. You can try again or reload the page.
              </Text>
              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <Code block style={{ maxWidth: '100%', overflow: 'auto' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Code>
              )}
              <Button.Group>
                <Button variant="default" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>
                  Reload Page
                </Button>
              </Button.Group>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}
