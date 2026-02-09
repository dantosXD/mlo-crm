#!/usr/bin/env node

const DEFAULT_REQUIRED_CHECKS = [
  'CI / validate',
  'Dependency Audit / audit',
];

function readArg(flag) {
  const valueArg = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!valueArg) {
    return null;
  }
  return valueArg.slice(flag.length + 1);
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseRequiredChecks(rawChecks) {
  if (!rawChecks) {
    return DEFAULT_REQUIRED_CHECKS;
  }
  return rawChecks
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function main() {
  const dryRun = hasFlag('--dry-run');

  const repository = readArg('--repo') || process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes('/')) {
    throw new Error('Missing repository. Use --repo=<owner/repo> or set GITHUB_REPOSITORY.');
  }

  const branch = readArg('--branch') || 'main';
  const requiredChecks = parseRequiredChecks(readArg('--checks'));

  const payload = {
    required_status_checks: {
      strict: true,
      contexts: requiredChecks,
    },
    enforce_admins: true,
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      required_approving_review_count: 1,
      require_last_push_approval: false,
    },
    required_conversation_resolution: true,
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_linear_history: true,
    lock_branch: false,
    allow_fork_syncing: false,
  };

  if (dryRun) {
    console.log(JSON.stringify({ repository, branch, payload }, null, 2));
    return;
  }

  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!githubToken) {
    throw new Error('Missing GITHUB_TOKEN (or GH_TOKEN) for GitHub API authentication.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/branches/${branch}/protection`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to configure branch protection (${response.status} ${response.statusText}): ${body}`
    );
  }

  console.log(`Branch protection configured for ${repository}@${branch}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
