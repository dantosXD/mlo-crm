# Regression Report - 2026-02-03

## Environment
- Date: 2026-02-05 (latest rerun)
- Commit: 781ed2593fd47863b190fcba3cfc31b0d0f76db0
- Frontend: http://localhost:5173 (active Vite instance)
- Backend: http://localhost:3000 (health OK)
- Database: backend/prisma/dev.db (existing data)
- Browser automation: Chrome DevTools (MCP) + Playwright test runner

## Production-Blocking Issues

### 0) Client Details Crash (Critical)
- Severity: CRITICAL
- Area: Clients -> Client Details
- Steps:
  1. Login as Admin
  2. Navigate directly to any client details page
- Expected: Client details render with tabs and content.
- Actual: Blank page; console error `ReferenceError` due to missing handlers (e.g., `fetchTasks`, `handleAssignPackage`, `cancelDeleteDocument`).
- Impact: Client Details unusable.
- Status: Resolved on 2026-02-04 (restored missing handlers + helpers; page renders successfully).

### 1) Communications Compose Client List Empty (High)
- Severity: HIGH
- Area: Communications
- Steps:
  1. Login as Admin
  2. Go to Communications -> Compose
  3. Open Client dropdown
- Expected: Existing clients appear in dropdown.
- Actual: Dropdown opens but shows no client options (empty listbox).
- Impact: Cannot compose/send communications.
- Status: Resolved on 2026-02-04 (client list populates and options render).

### 2) Client Data Appears Base64-Encoded (High)
- Severity: HIGH
- Area: Clients (List + Detail)
- Steps:
  1. Login as Admin
  2. Go to Clients list
  3. Open any client details
- Expected: Human-readable name/email/phone.
- Actual: Values appear base64-encoded (e.g., UGFnaW5hdGlvbiBUZXN0IENsaWVudCAxMDU=).
- Impact: Users cannot read client info; core CRM usability issue.
- Status: Resolved on 2026-02-04 (clients list/detail render decoded values).

## Additional Observations
- Client Details page renders successfully for Admin (no crash observed).
- Template creation succeeded for Admin (new template visible in list).
- Viewer read-only banner shown; Compose button hidden; direct /communications/compose shows Access Denied.
- Workflows Run Now now sends requests with CSRF token; backend responds with explicit errors for inactive workflows or missing client context (e.g., “Workflow is not active”, “Client not found”). UI shows error notification as expected.
- Viewer dashboard pending tasks issue addressed by scoping tasks to client ownership in `backend/src/routes/taskRoutes.ts` (re-check confirmed: pending tasks now 0 for viewer with no clients).
- Client Details activity timeline updates immediately after document upload and task creation.

## Test Coverage Checklist

### Authentication
- Admin login: PASS
- MLO login: PASS
- Viewer login: PASS
- Logout: PASS

### Dashboard
- Admin: PASS (preferences load/save not revalidated)
- MLO: PASS
- Viewer: PASS (read-only banner visible)

### Clients
- Admin: list/search/filter visible; client details PASS
- Viewer: add client button hidden NOT TESTED

### Pipeline
- Admin: board view loads PASS
- Admin: table view loads PASS (decoded names/emails/phones)

### Notes
- Notes hub loads PASS

### Documents
- Documents hub loads PASS
- Client Details: upload/download/delete PASS

### Templates
- List loads PASS
- Create template PASS (new template appears)
- Edit/delete not validated (Time)

### Communications
- List loads PASS
- Compose PASS (client dropdown populated)
- Viewer compose access PASS (Access Denied)
- Client Details compose: Send Now creates SENT communication PASS

### Calculator
- Calculate flow PASS

### Analytics
- Dashboard and tables load PASS

### Workflows
- List loads PASS
- View executions loads PASS (empty state)
- Run Now clicked (UI shows success/error; backend may return error if workflow inactive or missing client context).

### Settings
- Profile view loads PASS

### Admin
- Admin user list loads PASS (Admin)
- MLO access to /admin: Access Denied PASS

## Artifacts
- Playwright artifacts: `test-results/regression-desktop-regression-smoke-chromium/*` (screenshots/video/trace).

## Summary
- Client Details crash fixed; regression now passes.
- Prior issues (compose client list, base64 client data) are resolved.
- Run Now now returns explicit error/success feedback in UI.

## Post-Fix Validation (2026-02-03)
- Chrome DevTools regression run completed for targeted flows.

## Follow-up Validation (2026-02-04)
- Communications Compose client dropdown populated (Admin, MLO).
- Clients list/detail show decoded names/emails/phones.
- Dashboard recent clients now decoded.
- Pipeline board/table now show decoded client names/emails/phones.
- Client Details renders without runtime errors (missing handler fixes verified).
- Playwright regression: `e2e/regression.spec.ts` PASS.

## Follow-up Validation (2026-02-05)
- Client Details: document upload/download/delete PASS (CSRF added for XHR upload).
- Client Details: loan scenario delete PASS (modal confirmation replaces browser confirm).
- Client Details: activity timeline updates for document upload and task creation.
- Client Details: communications Send Now creates SENT item in list.
