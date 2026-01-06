import { Center, Stack, Title, Text, Button, Group } from '@mantine/core';
import { IconError404, IconHome, IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <Center h="100%">
      <Stack align="center" gap="lg">
        <IconError404 size={80} color="#868e96" stroke={1.5} />
        <Title order={1} ta="center">
          404 - Page Not Found
        </Title>
        <Text c="dimmed" ta="center" maw={400} size="lg">
          The page you are looking for does not exist or has been moved.
          Please check the URL or navigate back to the dashboard.
        </Text>
        <Group gap="md" mt="md">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="light"
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Button
            leftSection={<IconHome size={16} />}
            onClick={() => navigate('/')}
          >
            Go to Dashboard
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}

export default NotFound;
