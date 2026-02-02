#!/bin/bash

# Feature #288 Test Script - Document Actions
# Tests UPDATE_DOCUMENT_STATUS and REQUEST_DOCUMENT workflow actions

API_URL="http://localhost:3000"

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

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FEATURE #288: DOCUMENT ACTIONS TEST${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Create test client
echo -e "${BLUE}Test 1: Creating test client...${NC}"
CLIENT_RESPONSE=$(curl -s -X POST "$API_URL/api/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Document Action Test","email":"docaction@test.com","phone":"555-0001","status":"ACTIVE"}')

CLIENT_ID=$(echo $CLIENT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo -e "${RED}❌ Failed to create client${NC}"
  echo "Response: $CLIENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Client created: $CLIENT_ID${NC}\n"

# Test 2: Create a test document
echo -e "${BLUE}Test 2: Creating test document...${NC}"
DOC_RESPONSE=$(curl -s -X POST "$API_URL/api/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"name\":\"Test Document\",\"fileName\":\"test.pdf\",\"filePath\":\"/test/test.pdf\",\"fileSize\":1234,\"mimeType\":\"application/pdf\",\"status\":\"UPLOADED\",\"category\":\"INCOME\"}")

DOC_ID=$(echo $DOC_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$DOC_ID" ]; then
  echo -e "${RED}❌ Failed to create document${NC}"
  echo "Response: $DOC_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Document created: $DOC_ID${NC}\n"

# Test 3: UPDATE_DOCUMENT_STATUS - Update specific document
echo -e "${BLUE}Test 3: UPDATE_DOCUMENT_STATUS (specific document)...${NC}"
UPDATE_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"UPDATE_DOCUMENT_STATUS\",\"config\":{\"status\":\"UNDER_REVIEW\",\"documentId\":\"$DOC_ID\"},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $UPDATE_RESPONSE"

if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 3 PASSED: Document status updated${NC}\n"
else
  echo -e "${RED}❌ TEST 3 FAILED: Could not update document status${NC}\n"
fi

# Test 4: REQUEST_DOCUMENT
echo -e "${BLUE}Test 4: REQUEST_DOCUMENT action...${NC}"
REQUEST_RESPONSE=$(curl -s -X POST "$API_URL/api/workflows/test-action" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"actionType\":\"REQUEST_DOCUMENT\",\"config\":{\"category\":\"INCOME\",\"name\":\"Pay Stubs\",\"dueDays\":7,\"message\":\"Please provide recent pay stubs\"},\"context\":{\"clientId\":\"$CLIENT_ID\",\"triggerType\":\"MANUAL\",\"triggerData\":{},\"userId\":\"$USER_ID\"}}")

echo "Response: $REQUEST_RESPONSE"

if echo "$REQUEST_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ TEST 4 PASSED: Document requested successfully${NC}\n"
else
  echo -e "${RED}❌ TEST 4 FAILED: Could not request document${NC}\n"
fi

# Test 5: Verify documents were created
echo -e "${BLUE}Test 5: Verifying documents...${NC}"
DOCS_RESPONSE=$(curl -s -X GET "$API_URL/api/documents?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Documents for client:"
echo "$DOCS_RESPONSE" | grep -o '"status":"[^"]*"' | head -5
echo "$DOCS_RESPONSE" | grep -o '"name":"[^"]*"' | head -5

# Cleanup
echo -e "${BLUE}Cleaning up...${NC}"
curl -s -X DELETE "$API_URL/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" > /dev/null

echo -e "${GREEN}✅ Cleanup complete${NC}\n"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TESTS COMPLETED${NC}"
echo -e "${BLUE}========================================${NC}"
