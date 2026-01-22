import { Center, Stack, Title, Text, Button } from '@mantine/core';
import { IconShieldOff } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export function AccessDenied() {
  const navigate = useNavigate();

  return (
    <Center h="100%">
      <Stack align="center" gap="md">
        <IconShieldOff size={64} color="#fa5252" aria-hidden="true" />
        <Title order={2}>Access Denied</Title>
        <Text c="dimmed" ta="center" maw={400}>
          You do not have permission to access this page.
          Please contact your administrator if you believe this is an error.
        </Text>
        <Button onClick={() => navigate('/')} variant="light">
          Go to Dashboard
        </Button>
      </Stack>
    </Center>
  );
}

export default AccessDenied;
