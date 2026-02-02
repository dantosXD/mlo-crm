#!/bin/bash

# Feature #290 Test Script - Flow Control Actions
# Tests WAIT, BRANCH, and PARALLEL workflow actions

API_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FEATURE #290: FLOW CONTROL ACTIONS${NC}"
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
  -d '{"name":"Flow Control Test Client","email":"flowtest@test.com","phone":"555-0303","status":"ACTIVE"}')

CLIENT_ID=$(echo $CLIENT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}❌ Failed to create client${NC}"
  echo "Response: $CLIENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Client created: $CLIENT_ID${NC}\n"

# Test 2: WAIT action with minutes
echo -e "${BLUE}Test 2: WAIT action (minutes)...${NC}"
WAIT_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"WAIT\",\"config\":{\"delayMinutes\":5},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $WAIT_RESPONSE"

if echo "$WAIT_RESPONSE" | grep -q '"success":true'; then
  DELAY_MINS=$(echo $WAIT_RESPONSE | grep -o '"delayMinutes":[0-9]*' | cut -d':' -f2)
  echo -e "${GREEN}✅ TEST 2 PASSED: Wait scheduled for $DELAY_MINS minutes${NC}\n"
else
  echo -e "${RED}❌ TEST 2 FAILED: Could not schedule wait${NC}\n"
fi

# Test 3: WAIT action with hours
echo -e "${BLUE}Test 3: WAIT action (hours)...${NC}"
WAIT2_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"WAIT\",\"config\":{\"delayHours\":2},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $WAIT2_RESPONSE"

if echo "$WAIT2_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 3 PASSED: Wait scheduled for 2 hours${NC}\n"
else
  echo -e "${RED}❌ TEST 3 FAILED: Could not schedule wait${NC}\n"
fi

# Test 4: BRANCH action - condition is true
echo -e "${BLUE}Test 4: BRANCH action (condition TRUE)...${NC}"
BRANCH_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"BRANCH\",\"config\":{\"variable\":\"client.status\",\"operator\":\"equals\",\"value\":\"ACTIVE\",\"trueActions\":[{\"type\":\"CREATE_NOTE\",\"config\":{\"text\":\"Branch was TRUE\"}}],\"falseActions\":[{\"type\":\"CREATE_NOTE\",\"config\":{\"text\":\"Branch was FALSE\"}}]},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $BRANCH_RESPONSE"

if echo "$BRANCH_RESPONSE" | grep -q '"success":true'; then
  CONDITION_RESULT=$(echo $BRANCH_RESPONSE | grep -o '"conditionResult":true' | cut -d':' -f2)
  if [ "$CONDITION_RESULT" = "true" ]; then
    echo -e "${GREEN}✅ TEST 4 PASSED: Branch evaluated to TRUE${NC}\n"
  else
    echo -e "${RED}❌ TEST 4 FAILED: Branch should have evaluated to TRUE${NC}\n"
  fi
else
  echo -e "${RED}❌ TEST 4 FAILED: Could not evaluate branch${NC}\n"
fi

# Test 5: BRANCH action - condition is false
echo -e "${BLUE}Test 5: BRANCH action (condition FALSE)...${NC}"
BRANCH2_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"BRANCH\",\"config\":{\"variable\":\"client.status\",\"operator\":\"equals\",\"value\":\"INACTIVE\",\"trueActions\":[{\"type\":\"CREATE_NOTE\",\"config\":{\"text\":\"Branch was TRUE\"}}],\"falseActions\":[{\"type\":\"CREATE_NOTE\",\"config\":{\"text\":\"Branch was FALSE\"}}]},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $BRANCH2_RESPONSE"

if echo "$BRANCH2_RESPONSE" | grep -q '"success":true'; then
  CONDITION_RESULT=$(echo $BRANCH2_RESPONSE | grep -o '"conditionResult":false' | cut -d':' -f2)
  if [ "$CONDITION_RESULT" = "false" ]; then
    echo -e "${GREEN}✅ TEST 5 PASSED: Branch evaluated to FALSE${NC}\n"
  else
    echo -e "${RED}❌ TEST 5 FAILED: Branch should have evaluated to FALSE${NC}\n"
  fi
else
  echo -e "${RED}❌ TEST 5 FAILED: Could not evaluate branch${NC}\n"
fi

# Test 6: BRANCH with contains operator
echo -e "${BLUE}Test 6: BRANCH action (contains operator)...${NC}"
# Add a tag to the client first
curl -s -X PATCH "$API_URL/api/clients/$CLIENT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tags":["vip","referral"]}' > /dev/null

BRANCH3_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"BRANCH\",\"config\":{\"variable\":\"client.tags\",\"operator\":\"contains\",\"value\":\"vip\"},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $BRANCH3_RESPONSE"

if echo "$BRANCH3_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 6 PASSED: Branch with contains operator${NC}\n"
else
  echo -e "${RED}❌ TEST 6 FAILED: Contains operator failed${NC}\n"
fi

# Test 7: PARALLEL action
echo -e "${BLUE}Test 7: PARALLEL action...${NC}"
PARALLEL_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"PARALLEL\",\"config\":{\"actions\":[{\"type\":\"CREATE_NOTE\",\"config\":{\"text\":\"Parallel task 1\"}},{\"type\":\"LOG_ACTIVITY\",\"config\":{\"description\":\"Parallel task 2\"}},{\"type\":\"SEND_NOTIFICATION\",\"config\":{\"message\":\"Parallel task 3\"}}],\"continueOnError\":true},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $PARALLEL_RESPONSE"

if echo "$PARALLEL_RESPONSE" | grep -q '"success":true'; then
  ACTION_COUNT=$(echo $PARALLEL_RESPONSE | grep -o '"actionCount":[0-9]*' | cut -d':' -f2)
  echo -e "${GREEN}✅ TEST 7 PASSED: Parallel execution for $ACTION_COUNT actions${NC}\n"
else
  echo -e "${RED}❌ TEST 7 FAILED: Could not execute parallel actions${NC}\n"
fi

# Test 8: Verify flow control activities were logged
echo -e "${BLUE}Test 8: Verifying flow control activities...${NC}"
ACTIVITIES_RESPONSE=$(curl -s -X GET "$API_URL/api/activities?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Recent flow control activities:"
echo "$ACTIVITIES_RESPONSE" | grep -o '"type":"WORKFLOW_[^"]*"' | head -10

FLOW_ACTIVITY_COUNT=$(echo "$ACTIVITIES_RESPONSE" | grep -o '"type":"WORKFLOW_WAIT"\|"type":"WORKFLOW_BRANCH"\|"type":"WORKFLOW_PARALLEL"' | wc -l)

if [ "$FLOW_ACTIVITY_COUNT" -ge 5 ]; then
  echo -e "${GREEN}✅ TEST 8 PASSED: Flow control activities logged ($FLOW_ACTIVITY_COUNT found)${NC}\n"
else
  echo -e "${RED}❌ TEST 8 FAILED: Expected at least 5 flow control activities, found $FLOW_ACTIVITY_COUNT${NC}\n"
fi

# Cleanup
echo -e "${BLUE}Cleaning up...${NC}"
curl -s -X DELETE "$API_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "${GREEN}✅ Cleanup complete${NC}\n"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TESTS COMPLETED${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "\n${BLUE}NOTE:${NC} WAIT, BRANCH, and PARALLEL actions are validated for structure and logic."
echo -e "In production, these would integrate with a job queue for actual delayed/parallel execution."
