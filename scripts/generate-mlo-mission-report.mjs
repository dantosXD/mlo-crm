#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = value && !value.startsWith('--') ? value : 'true';
    if (value && !value.startsWith('--')) i += 1;
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function computePriorityScore(issue) {
  const score = issue?.scoring;
  if (score && typeof score.priorityScore === 'number') return score.priorityScore;
  const frequency = Number(score?.frequency || 0);
  const pain = Number(score?.pain || 0);
  const risk = Number(score?.risk || 0);
  const effort = Number(score?.effort || 0);
  return frequency + pain + risk - effort;
}

function severityRank(severity) {
  if (severity === 'P0') return 4;
  if (severity === 'P1') return 3;
  if (severity === 'P2') return 2;
  return 1;
}

function sortIssues(issues) {
  return [...issues].sort((a, b) => {
    const scoreDelta = computePriorityScore(b) - computePriorityScore(a);
    if (scoreDelta !== 0) return scoreDelta;
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    const effortA = Number(a?.scoring?.effort || 0);
    const effortB = Number(b?.scoring?.effort || 0);
    return effortA - effortB;
  });
}

function issueToMarkdown(issue, index) {
  const scoring = issue.scoring || {};
  const evidence = issue.evidence || {};
  const steps = Array.isArray(issue.stepsToReproduce) ? issue.stepsToReproduce : [];
  const screenshots = Array.isArray(evidence.screenshots) ? evidence.screenshots : [];
  const logs = Array.isArray(evidence.logs) ? evidence.logs : [];

  return [
    `### ${index + 1}. ${issue.issueTitle}`,
    `- Issue Title: ${issue.issueTitle}`,
    `- Category: ${issue.category}`,
    `- Severity: ${issue.severity}`,
    `- Priority Score: ${computePriorityScore(issue)} (F:${scoring.frequency || 0}, P:${scoring.pain || 0}, R:${scoring.risk || 0}, E:${scoring.effort || 0})`,
    `- Flow: ${issue.flowId} (${issue.pass})`,
    `- Environment: ${issue.environment?.device || 'unknown'} | ${issue.environment?.os || 'unknown'} | ${issue.environment?.browser || 'unknown'} | role=${issue.environment?.role || 'unknown'}`,
    `- Steps to reproduce:`,
    ...steps.map((step, stepIndex) => `  ${stepIndex + 1}. ${step}`),
    `- Expected vs Actual: ${issue.expected} | ${issue.actual}`,
    `- Impact: ${issue.impact}`,
    `- Suggested fix: ${issue.suggestedFix}`,
    `- Evidence:`,
    ...screenshots.map((file) => `  - Screenshot: \`${file}\``),
    ...(evidence.video ? [`  - Video: \`${evidence.video}\``] : []),
    ...(evidence.harFile ? [`  - HAR: \`${evidence.harFile}\``] : []),
    ...(evidence.traceFile ? [`  - Trace: \`${evidence.traceFile}\``] : []),
    ...logs.map((file) => `  - Log: \`${file}\``),
    `- Extra notes: ${issue.extraNotes || 'N/A'}`,
    '',
  ].join('\n');
}

function performanceSummary(screenPerf) {
  const sortable = [...screenPerf].filter((item) => typeof item.loadEventMs === 'number');
  const topSlow = sortable.sort((a, b) => (b.loadEventMs || 0) - (a.loadEventMs || 0)).slice(0, 5);
  return topSlow;
}

function formatDateInput(value) {
  if (value) return value;
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function main() {
  const args = parseArgs(process.argv);
  const runDir = args.runDir;
  const outDir = args.out || path.resolve('docs/qa');
  const date = formatDateInput(args.date);

  if (!runDir) {
    throw new Error('Missing --runDir');
  }

  ensureDir(outDir);

  const issueLog = readJsonl(path.join(runDir, 'issue-log.jsonl'));
  const flowMetrics = readJson(path.join(runDir, 'flow-metrics.json'), []);
  const screenPerf = readJson(path.join(runDir, 'screen-performance.json'), []);
  const networkSummary = readJson(path.join(runDir, 'network-summary.json'), {});
  const missionSummary = readJson(path.join(runDir, 'mission-summary.json'), null);

  const rankedIssues = sortIssues(issueLog);
  const top10 = rankedIssues.slice(0, 10);
  const quickWins = rankedIssues.filter((issue) => Number(issue?.scoring?.effort || 0) <= 2).slice(0, 3);
  const bigBets = rankedIssues.filter((issue) => Number(issue?.scoring?.effort || 0) >= 4).slice(0, 10);

  const openP0P1 = rankedIssues.filter((issue) => issue.severity === 'P0' || issue.severity === 'P1').length;
  const gate = openP0P1 > 0 ? 'FAIL' : 'PASS';

  const topSlowScreens = performanceSummary(screenPerf);

  const reportPath = path.join(outDir, `mlo-mission-report-${date}.md`);
  const top10Path = path.join(outDir, `mlo-mission-top10-${date}.md`);
  const flowMapPath = path.join(outDir, `mlo-mission-flow-maps-${date}.md`);
  const perfPath = path.join(outDir, `mlo-mission-performance-${date}.md`);
  const betsPath = path.join(outDir, `mlo-mission-quickwins-vs-bigbets-${date}.md`);

  const reportLines = [
    '# MLO Mission Report',
    '',
    `- Date: ${date}`,
    `- Run directory: \`${runDir}\``,
    `- Release gate (P0/P1): **${gate}**`,
    `- Open P0/P1 issues: ${openP0P1}`,
    `- Total issues logged: ${rankedIssues.length}`,
    `- Total flows executed: ${flowMetrics.length}`,
    '',
    '## Mission Summary',
    '',
    missionSummary ? `\`\`\`json\n${JSON.stringify(missionSummary, null, 2)}\n\`\`\`` : 'No mission-summary.json found.',
    '',
    '## Full Issue Log',
    '',
    ...(rankedIssues.length
      ? rankedIssues.map((issue, index) => issueToMarkdown(issue, index))
      : ['No issues were logged.']),
  ];
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');

  const top10Lines = [
    '# Top 10 Ship-Now Improvements',
    '',
    `- Date: ${date}`,
    `- Source run: \`${runDir}\``,
    '',
    '| Rank | Issue | Category | Severity | Priority Score | Effort | Suggested Fix |',
    '|---|---|---|---|---:|---:|---|',
    ...top10.map((issue, index) => {
      const score = computePriorityScore(issue);
      const effort = Number(issue?.scoring?.effort || 0);
      return `| ${index + 1} | ${issue.issueTitle} | ${issue.category} | ${issue.severity} | ${score} | ${effort} | ${issue.suggestedFix} |`;
    }),
    '',
  ];
  fs.writeFileSync(top10Path, top10Lines.join('\n'), 'utf-8');

  const flowLines = [
    '# Mission Flow Maps',
    '',
    `- Date: ${date}`,
    `- Source run: \`${runDir}\``,
    '',
    '| Flow ID | Pass | Status | Duration (ms) | Steps | Retries | Backtracks | Failed Requests | Friction Points |',
    '|---|---|---|---:|---:|---:|---:|---:|---|',
    ...flowMetrics.map((flow) => {
      const friction = Array.isArray(flow.frictionPoints) ? flow.frictionPoints.join('; ') : '';
      return `| ${flow.flowId} | ${flow.pass} | ${flow.status} | ${flow.durationMs} | ${flow.stepCount} | ${flow.retries} | ${flow.backtracks} | ${flow.failedRequests} | ${friction || '-'} |`;
    }),
    '',
  ];
  fs.writeFileSync(flowMapPath, flowLines.join('\n'), 'utf-8');

  const perfLines = [
    '# Mission Performance Findings',
    '',
    `- Date: ${date}`,
    `- Source run: \`${runDir}\``,
    '',
    '## Network Summary',
    '',
    '```json',
    JSON.stringify(networkSummary, null, 2),
    '```',
    '',
    '## Top 5 Slow Screens',
    '',
    '| Screen | Load (ms) | DOM Content Loaded (ms) | TTFB (ms) | URL |',
    '|---|---:|---:|---:|---|',
    ...topSlowScreens.map((item) => `| ${item.screen} | ${item.loadEventMs ?? '-'} | ${item.domContentLoadedMs ?? '-'} | ${item.ttfbMs ?? '-'} | ${item.url} |`),
    '',
  ];
  fs.writeFileSync(perfPath, perfLines.join('\n'), 'utf-8');

  const betsLines = [
    '# Quick Wins vs Big Bets',
    '',
    `- Date: ${date}`,
    `- Source run: \`${runDir}\``,
    '',
    '## Quick Wins',
    '',
    '| Issue | Category | Severity | Priority Score | Effort |',
    '|---|---|---|---:|---:|',
    ...quickWins.map((issue) => `| ${issue.issueTitle} | ${issue.category} | ${issue.severity} | ${computePriorityScore(issue)} | ${Number(issue?.scoring?.effort || 0)} |`),
    '',
    '## Big Bets',
    '',
    '| Issue | Category | Severity | Priority Score | Effort |',
    '|---|---|---|---:|---:|',
    ...bigBets.map((issue) => `| ${issue.issueTitle} | ${issue.category} | ${issue.severity} | ${computePriorityScore(issue)} | ${Number(issue?.scoring?.effort || 0)} |`),
    '',
  ];
  fs.writeFileSync(betsPath, betsLines.join('\n'), 'utf-8');

  console.log(`[report] Generated: ${reportPath}`);
  console.log(`[report] Generated: ${top10Path}`);
  console.log(`[report] Generated: ${flowMapPath}`);
  console.log(`[report] Generated: ${perfPath}`);
  console.log(`[report] Generated: ${betsPath}`);
}

try {
  main();
} catch (error) {
  console.error('[report] Failed:', error);
  process.exit(1);
}
