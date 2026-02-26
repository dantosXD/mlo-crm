import { IssueRecord, IssueSeverity, IssueScoring } from './missionTypes';

const severityWeight: Record<IssueSeverity, number> = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
};

export function computePriorityScore(input: {
  frequency: number;
  pain: number;
  risk: number;
  effort: number;
}): number {
  return input.frequency + input.pain + input.risk - input.effort;
}

export function withComputedScoring(
  scoring: Omit<IssueScoring, 'priorityScore'>
): IssueScoring {
  return {
    ...scoring,
    priorityScore: computePriorityScore(scoring),
  };
}

export function sortIssuesByPriority(issues: IssueRecord[]): IssueRecord[] {
  return [...issues].sort((a, b) => {
    if (b.scoring.priorityScore !== a.scoring.priorityScore) {
      return b.scoring.priorityScore - a.scoring.priorityScore;
    }

    const severityDelta = severityWeight[b.severity] - severityWeight[a.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (a.scoring.effort !== b.scoring.effort) {
      return a.scoring.effort - b.scoring.effort;
    }

    return a.issueTitle.localeCompare(b.issueTitle);
  });
}

export function selectQuickWins(issues: IssueRecord[], limit = 3): IssueRecord[] {
  const ranked = sortIssuesByPriority(issues).filter((issue) => issue.scoring.effort <= 2);
  return ranked.slice(0, limit);
}

