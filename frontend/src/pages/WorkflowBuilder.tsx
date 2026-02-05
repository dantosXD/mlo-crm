import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { notifications } from '@mantine/notifications';
import { useAuthStore } from '../stores/authStore';
import { useParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../utils/apiBase';
import { api } from '../utils/api';
import {
  Button,
  Container,
  Title,
  Group,
  Stack,
  Paper,
  Select,
  TextInput,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Alert,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconRobot,
  IconGitBranch,
  IconBolt,
  IconSettings,
  IconTrash,
  IconPlus,
  IconPlayerPlay,
  IconVersions,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import ActionConfigPanel from '../components/workflows/ActionConfigPanel';
import TriggerConfigPanel from '../components/workflows/TriggerConfigPanel';
import ConditionConfigPanel from '../components/workflows/ConditionConfigPanel';
import TestWorkflowModal from '../components/workflows/TestWorkflowModal';

// Custom node components
const TriggerNode = ({ data }: { data: any }) => {
  // Format trigger type for display
  const formatTriggerType = (type: string) => {
    if (!type) return 'Manual';
    return type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  return (
    <div
      style={{
        padding: '10px 15px',
        borderRadius: '8px',
        border: '2px solid #228be6',
        backgroundColor: '#e7f5ff',
        minWidth: '150px',
      }}
    >
      <Group gap="xs">
        <IconRobot size={16} color="#228be6" />
        <Text size="sm" fw={600}>
          {data.label}
        </Text>
      </Group>
      {data.triggerType && (
        <Badge size="xs" color="blue" mt={5} fullWidth>
          {formatTriggerType(data.triggerType)}
        </Badge>
      )}
    </div>
  );
};

const ConditionNode = ({ data }: { data: any }) => {
  // Format condition type for display
  const formatConditionType = (condition: any) => {
    if (!condition || !condition.type) return 'New Condition';
    return condition.type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  return (
    <div
      style={{
        padding: '10px 15px',
        borderRadius: '8px',
        border: '2px solid #fab005',
        backgroundColor: '#fff9db',
        minWidth: '150px',
      }}
    >
      <Group gap="xs">
        <IconGitBranch size={16} color="#fab005" />
        <Text size="sm" fw={600}>
          {data.label}
        </Text>
      </Group>
      {data.condition && data.condition.type && (
        <Badge size="xs" color="yellow" mt={5} fullWidth>
          {formatConditionType(data.condition)}
        </Badge>
      )}
    </div>
  );
};

const ActionNode = ({ data }: { data: any }) => {
  const actionColors: Record<string, string> = {
    SEND_EMAIL: '#15aabf',
    SEND_SMS: '#15aabf',
    CREATE_TASK: '#7950f2',
    UPDATE_CLIENT_STATUS: '#40c057',
    CALL_WEBHOOK: '#fd7e14',
  };

  const color = actionColors[data.actionType] || '#868e96';

  return (
    <div
      style={{
        padding: '10px 15px',
        borderRadius: '8px',
        border: `2px solid ${color}`,
        backgroundColor: `${color}15`,
        minWidth: '150px',
      }}
    >
      <Group gap="xs">
        <IconBolt size={16} color={color} style={{ color }} />
        <Text size="sm" fw={600}>
          {data.label}
        </Text>
      </Group>
      {data.actionType && (
        <Badge size="xs" color={data.actionType === 'CALL_WEBHOOK' ? 'orange' : 'cyan'} mt={5}>
          {data.actionType}
        </Badge>
      )}
    </div>
  );
};

// Node types configuration
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};

export default function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [testModalOpened, setTestModalOpened] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { accessToken } = useAuthStore();

  const isEditing = !!id;

  // Load workflow data when editing
  useEffect(() => {
    const loadWorkflow = async () => {
      if (isEditing && id) {
        try {
          const response = await fetch(`${API_URL}/workflows/${id}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (response.ok) {
            const workflow = await response.json();
            setWorkflowName(workflow.name || '');
            setWorkflowDescription(workflow.description || '');

            // Load nodes and edges if they exist in the workflow
            if (workflow.nodes && workflow.edges) {
              setNodes(workflow.nodes);
              setEdges(workflow.edges);
            } else {
              // Reconstruct nodes from workflow data if nodes/edges not stored
              const reconstructedNodes: Node[] = [];
              const reconstructedEdges: Edge[] = [];

              // Create trigger node
              if (workflow.triggerType) {
                reconstructedNodes.push({
                  id: 'trigger-1',
                  type: 'trigger',
                  position: { x: 100, y: 100 },
                  data: {
                    label: 'Trigger',
                    triggerType: workflow.triggerType,
                    config: workflow.triggerConfig || {},
                  },
                });
              }

              // Create action nodes
              workflow.actions?.forEach((action: any, index: number) => {
                const nodeId = `action-${index}`;
                reconstructedNodes.push({
                  id: nodeId,
                  type: 'action',
                  position: { x: 100, y: 250 + index * 120 },
                  data: {
                    label: action.description || action.type,
                    actionType: action.type,
                    config: action.config || {},
                  },
                });

                // Connect to previous node
                if (index === 0) {
                  reconstructedEdges.push({
                    id: `trigger-${nodeId}`,
                    source: 'trigger-1',
                    target: nodeId,
                  });
                } else {
                  reconstructedEdges.push({
                    id: `action-${index - 1}-${nodeId}`,
                    source: `action-${index - 1}`,
                    target: nodeId,
                  });
                }
              });

              setNodes(reconstructedNodes);
              setEdges(reconstructedEdges);
            }
          }
        } catch (error) {
          console.error('Error loading workflow:', error);
          notifications.show({
            title: 'Error',
            message: 'Failed to load workflow',
            color: 'red',
          });
        }
      }
    };

    loadWorkflow();
  }, [isEditing, id]);

  // Clear validation errors when workflow changes
  useEffect(() => {
    if (validationErrors.length > 0) {
      // Re-validate after a short delay to clear errors if they're fixed
      const timer = setTimeout(() => {
        const validation = validateWorkflow();
        if (validation.isValid) {
          setValidationErrors([]);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, workflowName, validationErrors.length]);

  // Connect nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Add node
  const addNode = useCallback(
    (type: 'trigger' | 'condition' | 'action') => {
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: Math.random() * 400, y: Math.random() * 300 },
        data: {
          label:
            type === 'trigger'
              ? 'New Trigger'
              : type === 'condition'
              ? 'New Condition'
              : 'New Action',
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  // Delete selected node
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  // Validation helper function
  const validateWorkflow = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check workflow name
    if (!workflowName.trim()) {
      errors.push('Workflow name is required');
    }

    // Check if there are any nodes
    if (nodes.length === 0) {
      errors.push('Workflow must have at least one node');
      return { isValid: false, errors };
    }

    // Check for trigger node
    const triggerNodes = nodes.filter((n) => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    } else if (triggerNodes.length > 1) {
      errors.push('Workflow can only have one trigger node');
    } else {
      // Check if trigger has type selected
      const triggerNode = triggerNodes[0];
      if (!triggerNode.data.triggerType) {
        errors.push('Trigger node must have a trigger type selected');
      }
    }

    // Check for action nodes
    const actionNodes = nodes.filter((n) => n.type === 'action');
    if (actionNodes.length === 0) {
      errors.push('Workflow must have at least one action node');
    } else {
      // Check if all actions have type selected
      actionNodes.forEach((node, index) => {
        if (!node.data.actionType) {
          errors.push(`Action node #${index + 1} must have an action type selected`);
        }
      });
    }

    // Check if all nodes are connected (no orphan nodes)
    const connectedNodeIds = new Set<string>();

    // Add all nodes that have edges
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    // Find nodes without any connections
    const orphanNodes = nodes.filter((n) => !connectedNodeIds.has(n.id));

    // Allow single node workflows (trigger only during setup)
    if (nodes.length > 1 && orphanNodes.length > 0) {
      errors.push(
        `${orphanNodes.length} node(s) are not connected to the workflow flow. Please connect all nodes.`
      );
    }

    // Check for disconnected components (workflow should be one connected graph)
    if (nodes.length > 1 && edges.length > 0) {
      // Build adjacency list
      const adj = new Map<string, string[]>();
      nodes.forEach((node) => adj.set(node.id, []));
      edges.forEach((edge) => {
        adj.get(edge.source)?.push(edge.target);
        adj.get(edge.target)?.push(edge.source);
      });

      // BFS from first node to count reachable nodes
      const startNode = nodes[0].id;
      const visited = new Set<string>();
      const queue = [startNode];
      visited.add(startNode);

      while (queue.length > 0) {
        const current = queue.shift()!;
        adj.get(current)?.forEach((neighbor) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }

      // If not all nodes are reachable, workflow is disconnected
      if (visited.size !== nodes.length) {
        errors.push(
          'Workflow contains disconnected components. All nodes must be connected in a single flow.'
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Handle save button click with validation preview
  const handleSaveClick = () => {
    const validation = validateWorkflow();

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      notifications.show({
        title: 'Validation Errors',
        message: 'Please fix the errors before saving',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    // Clear validation errors and proceed with save
    setValidationErrors([]);
    saveWorkflow.mutate();
  };

  // Save workflow mutation
  const saveWorkflow = useMutation({
    mutationFn: async (saveAsNewVersion = false) => {
      // Validate workflow before saving
      const validation = validateWorkflow();
      if (!validation.isValid) {
        throw new Error(validation.errors.join('\n'));
      }

      // Convert visual flow to workflow JSON structure
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      const actionNodes = nodes.filter((n) => n.type === 'action');
      const conditionNodes = nodes.filter((n) => n.type === 'condition');

      // Build conditions object from condition nodes
      const conditions: any = {};
      conditionNodes.forEach((node) => {
        if (node.data.condition) {
          Object.assign(conditions, node.data.condition);
        }
      });

      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        triggerType: triggerNode?.data?.triggerType || 'MANUAL',
        triggerConfig: triggerNode?.data?.config || {},
        conditions: Object.keys(conditions).length > 0 ? conditions : {},
        actions: actionNodes.map((n) => ({
          type: n.data.actionType,
          config: n.data.config || {},
          description: n.data.label || `${n.data.actionType}`,
        })),
      };

      if (isEditing && id) {
        // Update existing workflow
        const response = await api.put(`/workflows/${id}`, workflowData);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to update workflow' }));
          throw new Error(errorData.message || 'Failed to update workflow');
        }
        return await response.json();
      } else {
        // Create new workflow
        const response = await api.post('/workflows', workflowData);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to create workflow' }));
          throw new Error(errorData.message || 'Failed to create workflow');
        }
        return await response.json();
      }
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Success',
        message: isEditing
          ? 'Workflow updated successfully'
          : 'Workflow created successfully',
        color: 'green',
      });
      navigate('/workflows');
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save workflow',
        color: 'red',
      });
    },
  });

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="light" onClick={() => navigate('/workflows')}>
              <IconArrowLeft />
            </ActionIcon>
            <div>
              <Title order={3}>
                {isEditing ? 'Edit Workflow' : 'Create New Workflow'}
              </Title>
              <Text size="sm" c="dimmed">
                Visual workflow builder with drag-and-drop interface
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={deleteSelectedNode}
              disabled={!selectedNode}
            >
              Delete Selected
            </Button>
            {isEditing && (
              <Button
                variant="light"
                color="green"
                leftSection={<IconPlayerPlay size={16} />}
                onClick={() => setTestModalOpened(true)}
              >
                Test Workflow
              </Button>
            )}
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSaveClick}
              loading={saveWorkflow.isPending}
            >
              Save Workflow
            </Button>
          </Group>
        </Group>

        {/* Workflow Details */}
        <Paper withBorder p="md">
          <Stack gap="sm">
            <TextInput
              label="Workflow Name"
              placeholder="Enter workflow name..."
              value={workflowName}
              onChange={(e) => setWorkflowName(e.currentTarget.value)}
              required
            />
            <TextInput
              label="Description"
              placeholder="Describe what this workflow does..."
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.currentTarget.value)}
            />
          </Stack>
        </Paper>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Paper withBorder p="md" bg="red.0">
            <Stack gap="xs">
              <Group gap="xs">
                <IconAlertCircle size={20} color="var(--mantine-color-red-6)" />
                <Text fw={600} c="red.9">
                  Validation Errors
                </Text>
              </Group>
              <Stack gap={4} pl={34}>
                {validationErrors.map((error, index) => (
                  <Text key={index} size="sm" c="red.9">
                    • {error}
                  </Text>
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}

        {/* Toolbar */}
        <Paper withBorder p="sm">
          <Group gap="sm">
            <Text size="sm" fw={600}>
              Add Nodes:
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRobot size={14} />}
              onClick={() => addNode('trigger')}
            >
              Trigger
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconGitBranch size={14} />}
              onClick={() => addNode('condition')}
            >
              Condition
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconBolt size={14} />}
              onClick={() => addNode('action')}
            >
              Action
            </Button>
          </Group>
        </Paper>

        {/* Canvas */}
        <Paper withBorder style={{ height: '600px', position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'trigger':
                    return '#228be6';
                  case 'condition':
                    return '#fab005';
                  case 'action':
                    return '#15aabf';
                  default:
                    return '#868e96';
                }
              }}
            />
          </ReactFlow>
        </Paper>

        {/* Selected Node Panel */}
        {selectedNode && (
          <Paper withBorder p="md" shadow="sm">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Node Properties</Text>
              <ActionIcon size="sm" onClick={() => setSelectedNode(null)}>
                <IconTrash size={14} />
              </ActionIcon>
            </Group>

            {selectedNode.type === 'trigger' && (
              <Stack gap="sm">
                <Select
                  label="Trigger Type"
                  data={[
                    { value: 'MANUAL', label: 'Manual Trigger' },
                    { value: 'CLIENT_CREATED', label: 'Client Created' },
                    { value: 'CLIENT_UPDATED', label: 'Client Updated' },
                    { value: 'CLIENT_STATUS_CHANGED', label: 'Client Status Changed' },
                    { value: 'CLIENT_INACTIVITY', label: 'Client Inactivity' },
                    { value: 'PIPELINE_STAGE_ENTRY', label: 'Pipeline Stage Entry' },
                    { value: 'PIPELINE_STAGE_EXIT', label: 'Pipeline Stage Exit' },
                    { value: 'TIME_IN_STAGE_THRESHOLD', label: 'Time in Stage Threshold' },
                    { value: 'DOCUMENT_UPLOADED', label: 'Document Uploaded' },
                    { value: 'DOCUMENT_STATUS_CHANGED', label: 'Document Status Changed' },
                    { value: 'DOCUMENT_DUE_DATE', label: 'Document Due Date' },
                    { value: 'DOCUMENT_EXPIRED', label: 'Document Expired' },
                    { value: 'TASK_CREATED', label: 'Task Created' },
                    { value: 'TASK_COMPLETED', label: 'Task Completed' },
                    { value: 'TASK_OVERDUE', label: 'Task Overdue' },
                    { value: 'TASK_DUE', label: 'Task Due' },
                    { value: 'TASK_ASSIGNED', label: 'Task Assigned' },
                    { value: 'NOTE_CREATED', label: 'Note Created' },
                    { value: 'NOTE_WITH_TAG', label: 'Note with Tag' },
                    { value: 'WEBHOOK', label: 'Webhook' },
                    { value: 'SCHEDULED', label: 'Scheduled' },
                  ]}
                  value={selectedNode.data.triggerType || ''}
                  onChange={(value) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, triggerType: value, config: {} } }
                          : n
                      )
                    );
                  }}
                />

                {selectedNode.data.triggerType && (
                  <TriggerConfigPanel
                    triggerType={selectedNode.data.triggerType}
                    config={selectedNode.data.config || {}}
                    onChange={(newConfig) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, config: newConfig } }
                            : n
                        )
                      );
                    }}
                  />
                )}
              </Stack>
            )}

            {selectedNode.type === 'condition' && (
              <Stack gap="sm">
                <ConditionConfigPanel
                  condition={selectedNode.data.condition || {}}
                  onChange={(newCondition) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, condition: newCondition } }
                          : n
                      )
                    );
                  }}
                />
              </Stack>
            )}

            {selectedNode.type === 'action' && (
              <Stack gap="sm">
                <Select
                  label="Action Type"
                  data={[
                    { value: 'SEND_EMAIL', label: 'Send Email' },
                    { value: 'SEND_SMS', label: 'Send SMS' },
                    { value: 'CREATE_TASK', label: 'Create Task' },
                    { value: 'COMPLETE_TASK', label: 'Complete Task' },
                    { value: 'ASSIGN_TASK', label: 'Assign Task' },
                    { value: 'UPDATE_CLIENT_STATUS', label: 'Update Client Status' },
                    { value: 'ADD_TAG', label: 'Add Tag' },
                    { value: 'REMOVE_TAG', label: 'Remove Tag' },
                    { value: 'ASSIGN_CLIENT', label: 'Assign Client' },
                    { value: 'REQUEST_DOCUMENT', label: 'Request Document' },
                    { value: 'CREATE_NOTE', label: 'Create Note' },
                    { value: 'SEND_NOTIFICATION', label: 'Send Notification' },
                    { value: 'CALL_WEBHOOK', label: 'Call Webhook' },
                    { value: 'WAIT', label: 'Wait' },
                    { value: 'BRANCH', label: 'Branch' },
                  ]}
                  value={selectedNode.data.actionType || ''}
                  onChange={(value) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, actionType: value, config: {} } }
                          : n
                      )
                    );
                  }}
                />

                {selectedNode.data.actionType && (
                  <ActionConfigPanel
                    actionType={selectedNode.data.actionType}
                    config={selectedNode.data.config || {}}
                    onChange={(newConfig) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, config: newConfig } }
                            : n
                        )
                      );
                    }}
                  />
                )}
              </Stack>
            )}
          </Paper>
        )}

        {/* Info Alert */}
        <Alert color="blue" icon={<IconSettings size={16} />}>
          <Text size="sm">
            <strong>Tip:</strong> Drag nodes to position them. Click and drag from
            the right handle of one node to the left handle of another to connect
            them. Use the mouse wheel or pinch to zoom. Click and drag the canvas
            to pan.
          </Text>
        </Alert>

        {/* Instructions */}
        {!nodes.length && (
          <Paper withBorder p="xl" style={{ textAlign: 'center' }}>
            <Stack gap="md" align="center">
              <IconRobot size={48} color="#228be6" style={{ opacity: 0.5 }} />
              <div>
                <Text size="lg" fw={600}>
                  Start Building Your Workflow
                </Text>
                <Text size="sm" c="dimmed">
                  Add a trigger node to begin, then add conditions and actions
                </Text>
              </div>
              <Button leftSection={<IconPlus size={16} />} onClick={() => addNode('trigger')}>
                Add Trigger Node
              </Button>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Test Workflow Modal */}
      {isEditing && id && (
        <TestWorkflowModal
          opened={testModalOpened}
          onClose={() => setTestModalOpened(false)}
          workflowId={id}
          workflowName={workflowName}
          triggerType={nodes.find((n) => n.type === 'trigger')?.data?.triggerType || 'MANUAL'}
          actions={nodes.filter((n) => n.type === 'action').map((n) => ({
            type: n.data.actionType,
            config: n.data.config || {},
          }))}
        />
      )}
    </Container>
  );
}
