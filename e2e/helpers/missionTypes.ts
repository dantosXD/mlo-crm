export type MissionPass = 'PASS_A' | 'PASS_B' | 'PASS_C';

export type IssueCategory =
  | 'Bug'
  | 'UX friction'
  | 'Performance'
  | 'Copy & clarity'
  | 'Accessibility'
  | 'Reliability';

export type IssueSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface IssueEnvironment {
  device: string;
  os: string;
  browser: string;
  appVersion: string;
  role: string;
  build: string;
  networkProfile: string;
  url: string;
}

export interface IssueEvidence {
  screenshots: string[];
  video?: string;
  logs?: string[];
  harFile?: string;
  traceFile?: string;
  timestamps: string[];
}

export interface IssueScoring {
  frequency: number;
  pain: number;
  risk: number;
  effort: number;
  priorityScore: number;
}

export interface IssueRecord {
  id: string;
  runId: string;
  pass: MissionPass;
  flowId: string;
  issueTitle: string;
  category: IssueCategory;
  environment: IssueEnvironment;
  stepsToReproduce: string[];
  expected: string;
  actual: string;
  impact: string;
  severity: IssueSeverity;
  evidence: IssueEvidence;
  suggestedFix: string;
  extraNotes: string;
  scoring: IssueScoring;
  createdAt: string;
}

export interface FlowRunRecord {
  runId: string;
  pass: MissionPass;
  flowId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  stepCount: number;
  retries: number;
  backtracks: number;
  failedRequests: number;
  frictionPoints: string[];
  suggestedShortcuts: string[];
  status: 'PASS' | 'FAIL';
}

export interface ScreenPerfRecord {
  runId: string;
  pass: MissionPass;
  flowId: string;
  screen: string;
  url: string;
  capturedAt: string;
  ttfbMs: number | null;
  domInteractiveMs: number | null;
  domContentLoadedMs: number | null;
  loadEventMs: number | null;
  firstPaintMs: number | null;
  firstContentfulPaintMs: number | null;
}

export interface NetworkRequestSample {
  url: string;
  method: string;
  status: number | null;
  ok: boolean;
  requestBytes: number;
  responseBytes: number;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  screen: string;
}

export interface NetworkSummary {
  totalRequests: number;
  failedRequests: number;
  apiCalls: number;
  callsByScreen: Array<{ screen: string; calls: number }>;
  largestPayloads: Array<{ url: string; responseBytes: number; screen: string }>;
  failedEndpoints: Array<{ url: string; status: number | null; count: number }>;
}

export interface MissionSummary {
  runId: string;
  startedAt: string;
  endedAt: string;
  environment: {
    baseUrl: string;
    apiBaseUrl: string;
    browser: string;
    os: string;
  };
  issueCounts: Record<IssueSeverity, number>;
  openP0P1Count: number;
  releaseGate: 'PASS' | 'FAIL';
  top10IssueIds: string[];
  quickWinIssueIds: string[];
  notes: string[];
}

export interface FlowDefinition {
  id: string;
  pass: MissionPass;
  title: string;
  description: string;
}

