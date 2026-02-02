#!/bin/bash

# Feature #256: Communication Status Management API Test
echo "=== Feature #256: Communication Status Management API ==="
echo ""

# Step 1: Login
echo "Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Get CSRF token
echo "Step 2: Getting CSRF token..."
CSRF_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/clients?limit=1" \
  -H "Authorization: Bearer $TOKEN" -i)

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | grep -i "x-csrf-token:" | awk '{print $2}' | tr -d '\r')

if [ -z "$CSRF_TOKEN" ]; then
  echo "❌ Failed to get CSRF token"
  echo "Response: $CSRF_RESPONSE"
  exit 1
fi

echo "✅ CSRF token obtained: ${CSRF_TOKEN:0:20}..."
echo ""

# Step 3: Get a client
echo "Step 3: Getting a client..."
CLIENTS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/clients?limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN")

CLIENT_ID=$(echo $CLIENTS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  echo "❌ No clients found"
  echo "Response: $CLIENTS_RESPONSE"
  exit 1
fi

echo "✅ Using client: ${CLIENT_ID:0:8}..."
echo ""

# Step 4: Create DRAFT communication
echo "Step 3: Creating DRAFT communication..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/communications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"type\": \"EMAIL\",
    \"subject\": \"Feature 256 Test\",
    \"body\": \"Testing communication status management\"
  }")

COMM_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
COMM_STATUS=$(echo $CREATE_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ -z "$COMM_ID" ]; then
  echo "❌ Failed to create communication"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo "✅ Created communication: ${COMM_ID:0:8}..."
echo "   Status: $COMM_STATUS"
echo ""

# Step 5: Test PATCH /status - DRAFT to READY
echo "Step 4: Testing PATCH /status (DRAFT -> READY)..."
STATUS_RESPONSE=$(curl -s -X PATCH "http://localhost:3000/api/communications/$COMM_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}')

NEW_STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$NEW_STATUS" != "READY" ]; then
  echo "❌ Failed to update status to READY"
  echo "Response: $STATUS_RESPONSE"
  exit 1
fi

echo "✅ Status updated to READY"
echo "   New status: $NEW_STATUS"
echo ""

# Step 6: Test invalid transition (READY -> DRAFT)
echo "Step 5: Testing invalid transition (READY -> DRAFT)..."
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "http://localhost:3000/api/communications/$COMM_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"DRAFT"}')

INVALID_STATUS=$(echo "$INVALID_RESPONSE" | tail -1)

if [ "$INVALID_STATUS" != "400" ]; then
  echo "❌ Should have rejected backward transition"
  echo "Status code: $INVALID_STATUS"
  exit 1
fi

echo "✅ Backward transition correctly rejected (400 Bad Request)"
echo ""

# Step 7: Test POST /send - mark as sent
echo "Step 6: Testing POST /send endpoint..."
SEND_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/communications/$COMM_ID/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"test":"data"}}')

SEND_STATUS=$(echo $SEND_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
SENT_AT=$(echo $SEND_RESPONSE | grep -o '"sentAt":"[^"]*"' | cut -d'"' -f4)

if [ "$SEND_STATUS" != "SENT" ]; then
  echo "❌ Failed to send communication"
  echo "Response: $SEND_RESPONSE"
  exit 1
fi

echo "✅ Communication sent successfully"
echo "   Status: $SEND_STATUS"
echo "   Sent at: $SENT_AT"
echo ""

# Step 8: Test that SENT cannot change
echo "Step 7: Testing that SENT cannot transition..."
SENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "http://localhost:3000/api/communications/$COMM_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"READY"}')

SENT_STATUS_CODE=$(echo "$SENT_RESPONSE" | tail -1)

if [ "$SENT_STATUS_CODE" != "400" ]; then
  echo "❌ Should have rejected transition from SENT"
  echo "Status code: $SENT_STATUS_CODE"
  exit 1
fi

echo "✅ Transition from SENT correctly rejected (400 Bad Request)"
echo ""

# Step 9: Test transition to FAILED
echo "Step 8: Testing transition to FAILED..."
CREATE_RESPONSE2=$(curl -s -X POST http://localhost:3000/api/communications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"type\": \"EMAIL\",
    \"subject\": \"Test 2\",
    \"body\": \"Will be failed\"
  }")

COMM_ID2=$(echo $CREATE_RESPONSE2 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

FAIL_RESPONSE=$(curl -s -X PATCH "http://localhost:3000/api/communications/$COMM_ID2/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"FAILED"}')

FAIL_STATUS=$(echo $FAIL_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$FAIL_STATUS" != "FAILED" ]; then
  echo "❌ Failed to mark as FAILED"
  echo "Response: $FAIL_RESPONSE"
  exit 1
fi

echo "✅ Communication marked as FAILED"
echo "   Status: $FAIL_STATUS"
echo ""

echo "=== All Tests Passed! ✅ ==="
echo ""
echo "Summary:"
echo "✅ PATCH /api/communications/:id/status working"
echo "✅ POST /api/communications/:id/send working"
echo "✅ Status transitions validated"
echo "✅ Backward transitions prevented"
echo "✅ SENT state is immutable"
echo ""
