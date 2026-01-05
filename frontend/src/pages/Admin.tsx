import { Center, Text, Title, Stack, Paper, Table, Button, Group, Badge } from '@mantine/core';
import { IconUserPlus, IconUsers } from '@tabler/icons-react';

export function Admin() {
  // Placeholder admin page
  const mockUsers = [
    { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN', status: 'Active' },
    { id: '2', name: 'John Smith', email: 'mlo@example.com', role: 'MLO', status: 'Active' },
    { id: '3', name: 'Jane Doe', email: 'manager@example.com', role: 'MANAGER', status: 'Active' },
  ];

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'red';
      case 'MANAGER': return 'blue';
      case 'MLO': return 'green';
      case 'PROCESSOR': return 'yellow';
      case 'UNDERWRITER': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Admin Panel</Title>
          <Text c="dimmed" size="sm">Manage users and system settings</Text>
        </div>
        <Button leftSection={<IconUserPlus size={18} />}>
          Add User
        </Button>
      </Group>

      <Paper withBorder p="md">
        <Group mb="md">
          <IconUsers size={20} />
          <Title order={4}>User Management</Title>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mockUsers.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.name}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>
                  <Badge color={getRoleBadgeColor(user.role)} variant="light">
                    {user.role}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color="green" variant="outline">{user.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button size="xs" variant="light">Edit</Button>
                    <Button size="xs" variant="light" color="red">Delete</Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

export default Admin;
