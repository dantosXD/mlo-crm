import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Group,
  Paper,
  Table,
  Text,
  Badge,
  Select,
  TextInput,
  Button,
  LoadingOverlay,
  ActionIcon,
  Tooltip,
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconFilter, IconX, IconEye, IconFile, IconFileText, IconAlertTriangle } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: string;
  category: string;
  dueDate: string | null;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  clientName: string;
}

const statusColors: Record<string, string> = {
  REQUIRED: 'red',
  REQUESTED: 'yellow',
  UPLOADED: 'blue',
  UNDER_REVIEW: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
  EXPIRED: 'gray',
};

const categoryColors: Record<string, string> = {
  INCOME: 'blue',
  EMPLOYMENT: 'cyan',
  ASSETS: 'green',
  PROPERTY: 'orange',
  INSURANCE: 'grape',
  CREDIT: 'pink',
  OTHER: 'gray',
};

const API_URL = 'http://localhost:3000/api';

// Helper function to check if a document is expired
const isDocumentExpired = (doc: Document): boolean => {
  if (!doc.expiresAt) return false;
  const expiresAt = new Date(doc.expiresAt);
  const today = new Date();
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return expiresAt < today;
};

// Helper function to check if a document is expiring soon (within 30 days)
const isDocumentExpiringSoon = (doc: Document): boolean => {
  if (!doc.expiresAt) return false;
  const expiresAt = new Date(doc.expiresAt);
  const today = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + 30);
  expiresAt.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  warningDate.setHours(0, 0, 0, 0);
  return expiresAt >= today && expiresAt <= warningDate;
};

export default function Documents() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [accessToken]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/documents`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load documents',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/clients/${clientId}?tab=documents`);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || doc.status === statusFilter;
    const matchesCategory = !categoryFilter || doc.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter(null);
    setCategoryFilter(null);
  };

  const hasFilters = searchQuery || statusFilter || categoryFilter;

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} />

      {/* Header */}
      <Group justify="space-between" mb="lg">
        <Title order={2}>Documents</Title>
        <Text c="dimmed">{documents.length} total documents</Text>
      </Group>

      {/* Search and Filters */}
      <Group mb="md" gap="md">
        <TextInput
          placeholder="Search documents..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Status"
          leftSection={<IconFilter size={16} />}
          clearable
          data={[
            { value: 'REQUIRED', label: 'Required' },
            { value: 'REQUESTED', label: 'Requested' },
            { value: 'UPLOADED', label: 'Uploaded' },
            { value: 'UNDER_REVIEW', label: 'Under Review' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'EXPIRED', label: 'Expired' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          w={150}
        />
        <Select
          placeholder="Category"
          clearable
          data={[
            { value: 'INCOME', label: 'Income' },
            { value: 'EMPLOYMENT', label: 'Employment' },
            { value: 'ASSETS', label: 'Assets' },
            { value: 'PROPERTY', label: 'Property' },
            { value: 'INSURANCE', label: 'Insurance' },
            { value: 'CREDIT', label: 'Credit' },
            { value: 'OTHER', label: 'Other' },
          ]}
          value={categoryFilter}
          onChange={setCategoryFilter}
          w={150}
        />
        {hasFilters && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconX size={16} />}
            onClick={clearFilters}
          >
            Clear
          </Button>
        )}
      </Group>

      {/* Documents Table */}
      <Paper shadow="xs" p="md" withBorder>
        {filteredDocuments.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {documents.length === 0
              ? 'No documents yet. Upload documents from a client\'s detail page.'
              : 'No documents match your search or filters.'}
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Document</Table.Th>
                <Table.Th>Client</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Expiration</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Uploaded</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredDocuments.map((doc) => {
                const expired = isDocumentExpired(doc);
                const expiringSoon = isDocumentExpiringSoon(doc);
                return (
                  <Table.Tr
                    key={doc.id}
                    style={{
                      ...(expired ? { backgroundColor: 'var(--mantine-color-red-0)' } : {}),
                      ...(expiringSoon && !expired ? { backgroundColor: 'var(--mantine-color-yellow-0)' } : {}),
                    }}
                  >
                    <Table.Td>
                      <Group gap="xs">
                        <IconFileText size={16} color="gray" />
                        <div>
                          <Text fw={500} size="sm">
                            {doc.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {doc.fileName}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Anchor
                        component="button"
                        type="button"
                        onClick={() => handleClientClick(doc.clientId)}
                        size="sm"
                      >
                        {doc.clientName || 'Unknown Client'}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={categoryColors[doc.category] || 'gray'} variant="light" size="sm">
                        {doc.category}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge color={statusColors[doc.status] || 'gray'} size="sm">
                          {doc.status.replace('_', ' ')}
                        </Badge>
                        {expired && (
                          <Badge color="red" variant="filled" size="xs">EXPIRED</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {doc.expiresAt ? (
                        <Group gap={4}>
                          {(expired || expiringSoon) && (
                            <IconAlertTriangle size={14} color={expired ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-yellow-6)'} />
                          )}
                          <Text size="sm" c={expired ? 'red' : expiringSoon ? 'yellow.7' : 'dimmed'} fw={expired || expiringSoon ? 600 : 400}>
                            {new Date(doc.expiresAt).toLocaleDateString()}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatFileSize(doc.fileSize)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="View Client">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleClientClick(doc.clientId)}
                            aria-label={`View client for document ${doc.name}`}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}

        {filteredDocuments.length > 0 && (
          <Text c="dimmed" size="sm" ta="center" mt="md">
            Showing {filteredDocuments.length} of {documents.length} documents
          </Text>
        )}
      </Paper>
    </Container>
  );
}
