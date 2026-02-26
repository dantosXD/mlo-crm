import fs from 'node:fs';
import path from 'node:path';
import {
  FlowRunRecord,
  IssueRecord,
  MissionSummary,
  NetworkRequestSample,
  NetworkSummary,
  ScreenPerfRecord,
} from './missionTypes';

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toJsonl(records: unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '');
}

export class MissionRecorder {
  readonly runId: string;
  readonly rootDir: string;
  readonly evidenceDir: string;
  readonly issueLogPath: string;
  readonly flowMetricsPath: string;
  readonly perfPath: string;
  readonly networkSummaryPath: string;
  readonly networkSamplesPath: string;
  readonly missionSummaryPath: string;
  readonly consoleLogPath: string;

  private issues: IssueRecord[] = [];
  private flows: FlowRunRecord[] = [];
  private perfRecords: ScreenPerfRecord[] = [];
  private networkSamples: NetworkRequestSample[] = [];
  private networkSummary: NetworkSummary | null = null;
  private consoleLines: string[] = [];

  constructor(runId: string, outputRoot = path.resolve('output/playwright/mlo-mission')) {
    this.runId = runId;
    this.rootDir = path.join(outputRoot, runId);
    this.evidenceDir = path.join(this.rootDir, 'evidence');

    ensureDir(this.rootDir);
    ensureDir(this.evidenceDir);

    this.issueLogPath = path.join(this.rootDir, 'issue-log.jsonl');
    this.flowMetricsPath = path.join(this.rootDir, 'flow-metrics.json');
    this.perfPath = path.join(this.rootDir, 'screen-performance.json');
    this.networkSummaryPath = path.join(this.rootDir, 'network-summary.json');
    this.networkSamplesPath = path.join(this.rootDir, 'network-samples.json');
    this.missionSummaryPath = path.join(this.rootDir, 'mission-summary.json');
    this.consoleLogPath = path.join(this.evidenceDir, 'console.log');
  }

  addIssue(issue: IssueRecord) {
    this.issues.push(issue);
    fs.appendFileSync(this.issueLogPath, `${JSON.stringify(issue)}\n`, 'utf-8');
  }

  addFlow(flow: FlowRunRecord) {
    this.flows.push(flow);
  }

  addScreenPerf(perf: ScreenPerfRecord) {
    this.perfRecords.push(perf);
  }

  setNetwork(summary: NetworkSummary, samples: NetworkRequestSample[]) {
    this.networkSummary = summary;
    this.networkSamples = samples;
  }

  addConsoleLine(line: string) {
    this.consoleLines.push(line);
  }

  saveMissionSummary(summary: MissionSummary) {
    fs.writeFileSync(this.missionSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  }

  flush() {
    fs.writeFileSync(this.flowMetricsPath, `${JSON.stringify(this.flows, null, 2)}\n`, 'utf-8');
    fs.writeFileSync(this.perfPath, `${JSON.stringify(this.perfRecords, null, 2)}\n`, 'utf-8');

    if (this.networkSummary) {
      fs.writeFileSync(this.networkSummaryPath, `${JSON.stringify(this.networkSummary, null, 2)}\n`, 'utf-8');
    }

    fs.writeFileSync(this.networkSamplesPath, `${JSON.stringify(this.networkSamples, null, 2)}\n`, 'utf-8');

    const consoleBody =
      this.consoleLines.length > 0
        ? `${this.consoleLines.join('\n')}\n`
        : '[mission] no console lines captured\n';
    fs.writeFileSync(this.consoleLogPath, consoleBody, 'utf-8');
  }

  getIssues(): IssueRecord[] {
    return [...this.issues];
  }

  getFlows(): FlowRunRecord[] {
    return [...this.flows];
  }

  static readIssueLog(issueLogPath: string): IssueRecord[] {
    if (!fs.existsSync(issueLogPath)) return [];
    const raw = fs.readFileSync(issueLogPath, 'utf-8').trim();
    if (!raw) return [];
    return raw.split('\n').map((line) => JSON.parse(line) as IssueRecord);
  }

  static writeJsonl(filePath: string, records: unknown[]) {
    fs.writeFileSync(filePath, toJsonl(records), 'utf-8');
  }
}
