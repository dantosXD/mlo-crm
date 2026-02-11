import { useState } from 'react';
import {
  Container,
  Title,
  Paper,
  Tabs,
  Stack,
  Group,
  Text,
  TextInput,
  Switch,
  Select,
  Button,
  Divider,
  Avatar,
  PasswordInput,
  Card,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconLock,
  IconBell,
  IconPalette,
  IconDeviceFloppy,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string | null>('profile');
  const [saving, setSaving] = useState(false);

  // Profile settings state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
  });

  // Notification settings state
  const [notifications_, setNotifications_] = useState({
    emailAlerts: true,
    taskReminders: true,
    clientUpdates: true,
    weeklyDigest: false,
  });

  // Appearance settings state
  const [appearance, setAppearance] = useState({
    theme: 'light',
    compactMode: false,
    showWelcome: true,
  });

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleProfileSave = async () => {
    try {
      setSaving(true);
      const response = await api.put('/auth/profile', {
        name: profileForm.name,
        email: profileForm.email,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      // Update the user in the auth store
      updateUser({
        name: data.user.name,
        email: data.user.email,
      });

      notifications.show({
        title: 'Profile Updated',
        message: 'Your profile settings have been saved successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update profile',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    // Clear previous errors
    setPasswordError('');

    // Validation
    if (!passwordForm.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordError('New password is required');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      setSavingPassword(true);
      const response = await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.message || 'Failed to change password');
        return;
      }

      // Clear form and show success
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      notifications.show({
        title: 'Password Changed',
        message: 'Your password has been updated successfully',
        color: 'green',
      });
    } catch {
      setPasswordError('An error occurred while changing password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleNotificationsSave = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Your notification preferences have been updated',
      color: 'green',
    });
  };

  const handleAppearanceSave = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Your appearance settings have been updated',
      color: 'green',
    });
  };

  return (
    <Container size="md" py="md">
      <Title order={2} mb="lg">Settings</Title>

      <Paper shadow="xs" p="md" withBorder>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="profile" leftSection={<IconUser size={16} aria-hidden="true" />}>
              Profile
            </Tabs.Tab>
            <Tabs.Tab value="security" leftSection={<IconLock size={16} aria-hidden="true" />}>
              Security
            </Tabs.Tab>
            <Tabs.Tab value="notifications" leftSection={<IconBell size={16} aria-hidden="true" />}>
              Notifications
            </Tabs.Tab>
            <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} aria-hidden="true" />}>
              Appearance
            </Tabs.Tab>
          </Tabs.List>

          {/* Profile Tab */}
          <Tabs.Panel value="profile" pt="xl">
            <Stack gap="lg">
              <Group>
                <Avatar size="xl" color="blue" radius="xl">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <div>
                  <Text fw={500} size="lg">{user?.name}</Text>
                  <Text c="dimmed" size="sm">{user?.role}</Text>
                </div>
              </Group>

              <Divider />

              <TextInput
                label="Full Name"
                placeholder="Enter your name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />

              <TextInput
                label="Email Address"
                placeholder="Enter your email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              />

              <TextInput
                label="Phone Number"
                placeholder="Enter your phone number"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />

              <Group justify="flex-end" mt="md">
                <Button leftSection={<IconDeviceFloppy size={16} aria-hidden="true" />} onClick={handleProfileSave} loading={saving}>
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          {/* Security Tab */}
          <Tabs.Panel value="security" pt="xl">
            <Stack gap="lg">
              <Text fw={500} size="lg">Change Password</Text>
              <Text c="dimmed" size="sm">
                Update your password to keep your account secure
              </Text>

              <Divider />

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePasswordChange();
                }}
              >
                <Stack gap="lg">
                  <TextInput
                    aria-hidden="true"
                    tabIndex={-1}
                    type="email"
                    name="username"
                    autoComplete="username"
                    readOnly
                    value={profileForm.email || user?.email || ''}
                    styles={{
                      root: { display: 'none' },
                    }}
                  />

                  {passwordError && (
                    <Alert icon={<IconAlertCircle size={16} aria-hidden="true" />} color="red" title="Error">
                      {passwordError}
                    </Alert>
                  )}

                  <PasswordInput
                    label="Current Password"
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    error={passwordError && !passwordForm.currentPassword ? 'Required' : undefined}
                    autoComplete="current-password"
                  />

                  <PasswordInput
                    label="New Password"
                    placeholder="Enter new password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    error={passwordError && passwordForm.newPassword.length > 0 && passwordForm.newPassword.length < 8 ? 'Must be at least 8 characters' : undefined}
                    autoComplete="new-password"
                  />

                  <PasswordInput
                    label="Confirm New Password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    error={passwordError && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword ? 'Passwords do not match' : undefined}
                    autoComplete="new-password"
                  />

                  <Group justify="flex-end" mt="md">
                    <Button
                      type="submit"
                      leftSection={<IconDeviceFloppy size={16} aria-hidden="true" />}
                      loading={savingPassword}
                    >
                      Update Password
                    </Button>
                  </Group>
                </Stack>
              </form>

              <Divider my="lg" />

              <Text fw={500} size="lg">Two-Factor Authentication</Text>
              <Text c="dimmed" size="sm">
                Add an extra layer of security to your account
              </Text>

              <Card withBorder p="md">
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>Two-Factor Authentication</Text>
                    <Text c="dimmed" size="sm">Currently disabled</Text>
                  </div>
                  <Button variant="light">Enable 2FA</Button>
                </Group>
              </Card>
            </Stack>
          </Tabs.Panel>

          {/* Notifications Tab */}
          <Tabs.Panel value="notifications" pt="xl">
            <Stack gap="lg">
              <Text fw={500} size="lg">Email Notifications</Text>
              <Text c="dimmed" size="sm">
                Manage how you receive notifications
              </Text>

              <Divider />

              <Switch
                label="Email Alerts"
                description="Receive important alerts via email"
                checked={notifications_.emailAlerts}
                onChange={(e) => setNotifications_({ ...notifications_, emailAlerts: e.currentTarget.checked })}
              />

              <Switch
                label="Task Reminders"
                description="Get reminded about upcoming tasks"
                checked={notifications_.taskReminders}
                onChange={(e) => setNotifications_({ ...notifications_, taskReminders: e.currentTarget.checked })}
              />

              <Switch
                label="Client Updates"
                description="Notifications when client information changes"
                checked={notifications_.clientUpdates}
                onChange={(e) => setNotifications_({ ...notifications_, clientUpdates: e.currentTarget.checked })}
              />

              <Switch
                label="Weekly Digest"
                description="Receive a weekly summary of activities"
                checked={notifications_.weeklyDigest}
                onChange={(e) => setNotifications_({ ...notifications_, weeklyDigest: e.currentTarget.checked })}
              />

              <Group justify="flex-end" mt="md">
                <Button leftSection={<IconDeviceFloppy size={16} aria-hidden="true" />} onClick={handleNotificationsSave}>
                  Save Preferences
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          {/* Appearance Tab */}
          <Tabs.Panel value="appearance" pt="xl">
            <Stack gap="lg">
              <Text fw={500} size="lg">Display Settings</Text>
              <Text c="dimmed" size="sm">
                Customize how the application looks
              </Text>

              <Divider />

              <Select
                label="Theme"
                description="Choose your preferred color theme"
                data={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System Default' },
                ]}
                value={appearance.theme}
                onChange={(value) => setAppearance({ ...appearance, theme: value || 'light' })}
              />

              <Switch
                label="Compact Mode"
                description="Use smaller spacing and font sizes"
                checked={appearance.compactMode}
                onChange={(e) => setAppearance({ ...appearance, compactMode: e.currentTarget.checked })}
              />

              <Switch
                label="Show Welcome Message"
                description="Display welcome message on dashboard"
                checked={appearance.showWelcome}
                onChange={(e) => setAppearance({ ...appearance, showWelcome: e.currentTarget.checked })}
              />

              <Group justify="flex-end" mt="md">
                <Button leftSection={<IconDeviceFloppy size={16} aria-hidden="true" />} onClick={handleAppearanceSave}>
                  Save Settings
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
