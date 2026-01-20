import { useState, useEffect } from 'react';
import {
  Title,
  Stack,
  Paper,
  Table,
  Button,
  Group,
  Badge,
  Text,
  LoadingOverlay,
  Modal,
  TextInput,
  Select,
  Switch,
  PasswordInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUserPlus, IconUsers } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

const API_URL = 'http://localhost:3000/api';

export function Admin() {
  const { accessToken } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'MLO',
  });

  // Edit user state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    isActive: true,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      // Security verification: Log to verify no password fields
      console.log('Users API response fields:', Object.keys(data[0] || {}));

      // Double-check that no password-related fields are present
      const hasPasswordField = data.some((user: any) =>
        'password' in user ||
        'passwordHash' in user ||
        'password_hash' in user
      );

      if (hasPasswordField) {
        console.error('SECURITY ALERT: Password field detected in API response!');
      }

      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      notifications.show({
        title: 'Validation Error',
        message: 'Name, email, and password are required',
        color: 'red',
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(newUser),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const createdUser = await response.json();
      setUsers([createdUser, ...users]);
      setCreateModalOpen(false);
      setNewUser({ name: '', email: '', password: '', role: 'MLO' });

      notifications.show({
        title: 'Success',
        message: 'User created successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating user:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create user',
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete user "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      setUsers(users.filter(u => u.id !== id));
      notifications.show({
        title: 'Success',
        message: 'User deleted successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete user',
        color: 'red',
      });
    }
  };

  const handleEditUser = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setEditModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;

    setEditing(true);
    try {
      const response = await fetch(`${API_URL}/users/${editUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      const updatedUser = await response.json();
      setUsers(users.map(u => u.id === editUser.id ? updatedUser : u));
      setEditModalOpen(false);
      setEditUser(null);

      notifications.show({
        title: 'Success',
        message: 'User updated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating user:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update user',
        color: 'red',
      });
    } finally {
      setEditing(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'red';
      case 'MANAGER': return 'blue';
      case 'MLO': return 'green';
      case 'PROCESSOR': return 'yellow';
      case 'UNDERWRITER': return 'orange';
      case 'VIEWER': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between">
        <div>
          <Title order={2}>Admin Panel</Title>
          <Text c="dimmed" size="sm">Manage users and system settings</Text>
        </div>
        <Button leftSection={<IconUserPlus size={18} />} onClick={() => setCreateModalOpen(true)}>
          Add User
        </Button>
      </Group>

      <Paper withBorder p="md">
        <Group mb="md">
          <IconUsers size={20} />
          <Title order={4}>User Management</Title>
        </Group>

        {users.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No users found.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last Login</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td>{user.name}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>
                    <Badge color={getRoleBadgeColor(user.role)} variant="light">
                      {user.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={user.isActive ? 'green' : 'gray'} variant="outline">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : 'Never'}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button size="xs" variant="light" onClick={() => handleEditUser(user)}>Edit</Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={() => handleDeleteUser(user.id, user.name)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create User Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New User"
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="Full name"
            required
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
          />
          <TextInput
            label="Email"
            placeholder="user@example.com"
            required
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
          />
          <PasswordInput
            label="Password"
            placeholder="Minimum 8 characters"
            required
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          />
          <Select
            label="Role"
            data={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'MANAGER', label: 'Manager' },
              { value: 'MLO', label: 'MLO' },
              { value: 'PROCESSOR', label: 'Processor' },
              { value: 'UNDERWRITER', label: 'Underwriter' },
              { value: 'VIEWER', label: 'Viewer' },
            ]}
            value={newUser.role}
            onChange={(value) => setNewUser({ ...newUser, role: value || 'MLO' })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} loading={creating}>
              Create User
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User"
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="Full name"
            required
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <TextInput
            label="Email"
            placeholder="user@example.com"
            required
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Select
            label="Role"
            data={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'MANAGER', label: 'Manager' },
              { value: 'MLO', label: 'MLO' },
              { value: 'PROCESSOR', label: 'Processor' },
              { value: 'UNDERWRITER', label: 'Underwriter' },
              { value: 'VIEWER', label: 'Viewer' },
            ]}
            value={editForm.role}
            onChange={(value) => setEditForm({ ...editForm, role: value || 'MLO' })}
          />
          <Switch
            label="Active"
            checked={editForm.isActive}
            onChange={(e) => setEditForm({ ...editForm, isActive: e.currentTarget.checked })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} loading={editing}>
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default Admin;
