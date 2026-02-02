#!/bin/bash

# Feature #289 Test Script - Notification and Note Actions
# Tests CREATE_NOTE, SEND_NOTIFICATION, and LOG_ACTIVITY workflow actions

API_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FEATURE #289: NOTIFICATION & NOTE ACTIONS${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get a valid token by logging in
echo -e "${BLUE}Getting authentication token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testadmin@test.com","password":"test123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo $LOGIN_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Got token${NC}"
echo -e "${GREEN}✅ User ID: $USER_ID${NC}\n"

# Test 1: Create test client
echo -e "${BLUE}Test 1: Creating test client...${NC}"
CLIENT_RESPONSE=$(curl -s -X POST "$API_URL/api/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Notification Test Client","email":"notifytest@test.com","phone":"555-0202","status":"ACTIVE"}')

CLIENT_ID=$(echo $CLIENT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}❌ Failed to create client${NC}"
  echo "Response: $CLIENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Client created: $CLIENT_ID${NC}\n"

# Test 2: CREATE_NOTE action
echo -e "${BLUE}Test 2: CREATE_NOTE action...${NC}"
NOTE_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"CREATE_NOTE\",\"config\":{\"text\":\"Workflow note for {{client_name}} - Status: {{client_status}}\",\"tags\":[\"workflow\",\"auto-generated\"],\"isPinned\":false},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $NOTE_RESPONSE"

if echo "$NOTE_RESPONSE" | grep -q '"success":true'; then
  NOTE_ID=$(echo $NOTE_RESPONSE | grep -o '"noteId":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}✅ TEST 2 PASSED: Note created (ID: $NOTE_ID)${NC}\n"
else
  echo -e "${RED}❌ TEST 2 FAILED: Could not create note${NC}\n"
fi

# Test 3: CREATE_NOTE with template (if templates exist)
echo -e "${BLUE}Test 3: CREATE_NOTE with direct text (no template)...${NC}"
NOTE2_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"CREATE_NOTE\",\"config\":{\"text\":\"Important note about loan application\",\"tags\":[\"important\"],\"isPinned\":true},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $NOTE2_RESPONSE"

if echo "$NOTE2_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 3 PASSED: Note created with pinned flag${NC}\n"
else
  echo -e "${RED}❌ TEST 3 FAILED: Could not create pinned note${NC}\n"
fi

# Test 4: SEND_NOTIFICATION action
echo -e "${BLUE}Test 4: SEND_NOTIFICATION action...${NC}"
NOTIF_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"SEND_NOTIFICATION\",\"config\":{\"title\":\"Workflow Alert\",\"message\":\"Client {{client_name}} status changed to {{client_status}}\",\"priority\":\"HIGH\",\"link\":\"/clients/$CLIENT_ID\"},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $NOTIF_RESPONSE"

if echo "$NOTIF_RESPONSE" | grep -q '"success":true'; then
  NOTIF_COUNT=$(echo $NOTIF_RESPONSE | grep -o '"recipientIds":\[[^]]*\]' | grep -o '","' | wc -l)
  echo -e "${GREEN}✅ TEST 4 PASSED: Notification sent to $((NOTIF_COUNT + 1)) recipient(s)${NC}\n"
else
  echo -e "${RED}❌ TEST 4 FAILED: Could not send notification${NC}\n"
fi

# Test 5: SEND_NOTIFICATION to specific role
echo -e "${BLUE}Test 5: SEND_NOTIFICATION to MLO role...${NC}"
NOTIF2_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"SEND_NOTIFICATION\",\"config\":{\"title\":\"Task Assigned\",\"message\":\"New task for client {{client_name}}\",\"toRole\":\"MLO\",\"priority\":\"MEDIUM\"},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $NOTIF2_RESPONSE"

if echo "$NOTIF2_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 5 PASSED: Notification sent to MLO role${NC}\n"
else
  echo -e "${RED}❌ TEST 5 FAILED: Could not send role-based notification${NC}\n"
fi

# Test 6: LOG_ACTIVITY action
echo -e "${BLUE}Test 6: LOG_ACTIVITY action...${NC}"
ACTIVITY_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"LOG_ACTIVITY\",\"config\":{\"type\":\"WORKFLOW_EXECUTED\",\"description\":\"Workflow action completed for {{client_name}}\",\"metadata\":{\"workflowName\":\"Test Workflow\",\"actionCount\":5}},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $ACTIVITY_RESPONSE"

if echo "$ACTIVITY_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 6 PASSED: Activity logged successfully${NC}\n"
else
  echo -e "${RED}❌ TEST 6 FAILED: Could not log activity${NC}\n"
fi

# Test 7: Verify notes were created
echo -e "${BLUE}Test 7: Verifying notes...${NC}"
NOTES_RESPONSE=$(curl -s -X GET "$API_URL/api/notes?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN")

NOTE_COUNT=$(echo "$NOTES_RESPONSE" | grep -o '"text":"[^"]*"' | wc -l)
echo "Found $NOTE_COUNT note(s) for client"

if [ "$NOTE_COUNT" -ge 2 ]; then
  echo -e "${GREEN}✅ TEST 7 PASSED: Notes verified in database${NC}\n"
else
  echo -e "${RED}❌ TEST 7 FAILED: Expected at least 2 notes${NC}\n"
fi

# Test 8: Verify activities were logged
echo -e "${BLUE}Test 8: Verifying activities...${NC}"
ACTIVITIES_RESPONSE=$(curl -s -X GET "$API_URL/api/activities?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Recent activities for client:"
echo "$ACTIVITIES_RESPONSE" | grep -o '"type":"[^"]*"' | head -5
echo "$ACTIVITIES_RESPONSE" | grep -o '"description":"[^"]*"' | head -5

# Cleanup
echo -e "${BLUE}Cleaning up...${NC}"
curl -s -X DELETE "$API_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "${GREEN}✅ Cleanup complete${NC}\n"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TESTS COMPLETED${NC}"
echo -e "${BLUE}========================================${NC}"
