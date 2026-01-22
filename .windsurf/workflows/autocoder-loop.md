---
title: AutoCoder Feature Loop
description: Run the AutoCoder-style feature loop using MCP tools, tests, and iterative fixes.
---

## Step 1: Fetch next feature

Call `feature_get_next` (or `feature_claim_next` if using parallel mode) and read the feature details.

If you used `feature_get_next`, immediately call `feature_mark_in_progress`.

## Step 2: Implement

Make minimal code changes to implement the feature in this repo.

## Step 3: Test

Run relevant tests or lint commands from the terminal.

## Step 4: Update status

- If tests pass: call `feature_mark_passing`.
- If tests fail: fix and re-run tests, then call `feature_mark_failing` before re-testing.
- If blocked: call `feature_skip` (and optionally `feature_clear_in_progress`).

## Step 5: Repeat

Repeat until `feature_get_next` returns no pending features. If rate-limited, pause and wait for the user to type `continue`.

## Optional: Regression sweeps

After major changes, call `feature_get_for_regression` and re-verify those features.

## Optional: Dependency management (advanced)

Use `feature_add_dependency`, `feature_remove_dependency`, `feature_set_dependencies`, `feature_get_ready`, `feature_get_blocked`, or `feature_get_graph` to manage ordering in complex projects.
