import { FlowDefinition } from './missionTypes';

export const passAFlows: FlowDefinition[] = [
  {
    id: 'pass-a-cold-start-onboarding',
    pass: 'PASS_A',
    title: 'Cold start onboarding and first action',
    description: 'Login, orient on dashboard, discover next action, and create first client from empty state.',
  },
  {
    id: 'pass-a-empty-states-and-wrong-actions',
    pass: 'PASS_A',
    title: 'Empty states, terminology, and wrong actions',
    description: 'Visit empty modules and intentionally submit invalid forms to verify recovery and clarity.',
  },
];

export const passBFlows: FlowDefinition[] = [
  {
    id: 'pass-b-client-lifecycle',
    pass: 'PASS_B',
    title: 'Client lifecycle',
    description: 'Create, edit, update status, and update tags.',
  },
  {
    id: 'pass-b-pipeline-status-move',
    pass: 'PASS_B',
    title: 'Pipeline move',
    description: 'Move status in pipeline and verify downstream details.',
  },
  {
    id: 'pass-b-client-ops-note-task-call',
    pass: 'PASS_B',
    title: 'Client operations',
    description: 'Add note, add task, log call, and confirm activity timeline.',
  },
  {
    id: 'pass-b-documents-request-and-status',
    pass: 'PASS_B',
    title: 'Document workflow',
    description: 'Request a document and verify request appears in client context.',
  },
  {
    id: 'pass-b-communications-compose-save-send',
    pass: 'PASS_B',
    title: 'Communications compose/save/send',
    description: 'Compose a communication, save draft, send, and verify list.',
  },
  {
    id: 'pass-b-search-filter-drilldown',
    pass: 'PASS_B',
    title: 'Search/filter/drill-down',
    description: 'Run search and filtering on clients, tasks, notes, and communications.',
  },
  {
    id: 'pass-b-notifications-action',
    pass: 'PASS_B',
    title: 'Notifications action loop',
    description: 'Open notifications, navigate via item link, and confirm action completion.',
  },
  {
    id: 'pass-b-role-clarity',
    pass: 'PASS_B',
    title: 'Role clarity',
    description: 'Verify allowed and blocked actions for admin/mlo/viewer.',
  },
];

export const passCFlows: FlowDefinition[] = [
  {
    id: 'pass-c-large-data-10x-100x',
    pass: 'PASS_C',
    title: 'Large datasets',
    description: 'Exercise high-volume list rendering, filtering, and search.',
  },
  {
    id: 'pass-c-session-recovery',
    pass: 'PASS_C',
    title: 'Long session and recovery',
    description: 'Inactivity timeout, tab switching, and session renewal behavior.',
  },
  {
    id: 'pass-c-network-throttle-offline',
    pass: 'PASS_C',
    title: 'Network stress',
    description: 'Slow network and offline recovery handling.',
  },
  {
    id: 'pass-c-rapid-actions-and-concurrency',
    pass: 'PASS_C',
    title: 'Rapid actions and concurrency',
    description: 'Double submit, rapid navigation, and two-tab editing.',
  },
  {
    id: 'pass-c-bulk-and-accessibility-basics',
    pass: 'PASS_C',
    title: 'Bulk actions and accessibility basics',
    description: 'Bulk interactions, keyboard-only checks, and zoom/contrast spot checks.',
  },
];

export const allMissionFlows: FlowDefinition[] = [
  ...passAFlows,
  ...passBFlows,
  ...passCFlows,
];

