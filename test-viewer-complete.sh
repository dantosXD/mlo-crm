#!/bin/bash

echo "=== FEATURE #19: Viewer Role Cannot Edit Clients ==="
echo ""

# Get admin token first
echo "Step 1: Login as admin to create test client"
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "Admin Token: ${ADMIN_TOKEN:0:50}..."
echo ""

# Create test client
echo "Step 2: Create test client 'VIEWER_TEST_CLIENT_19'"
CLIENT_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/clients" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"VIEWER_TEST_CLIENT_19","email":"viewer19@test.com","phone":"555-0019"}')

CLIENT_ID=$(echo $CLIENT_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Created client ID: $CLIENT_ID"
echo ""

# Get viewer token
echo "Step 3: Login as Viewer role"
VIEWER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@example.com","password":"password123"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "Viewer Token: ${VIEWER_TOKEN:0:50}..."
echo ""

# Test GET (should work)
echo "Test 1: GET /api/clients (Viewer can READ - should return 200)"
curl -s -X GET "http://localhost:3000/api/clients" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test GET single client (should fail - viewer has no clients)
echo "Test 2: GET /api/clients/$CLIENT_ID (Viewer accessing another user's client - may return 403 or 404)"
curl -s -X GET "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test PUT (should fail with 403)
echo "Test 3: PUT /api/clients/$CLIENT_ID (Viewer cannot WRITE - should return 403 Forbidden)"
curl -s -X PUT "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"HACKED_NAME"}' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test POST (should fail with 403)
echo "Test 4: POST /api/clients (Viewer cannot CREATE - should return 403 Forbidden)"
curl -s -X POST "http://localhost:3000/api/clients" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"VIEWER_HACK_ATTEMPT","email":"hacker@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test DELETE (should fail with 403)
echo "Test 5: DELETE /api/clients/$CLIENT_ID (Viewer cannot DELETE - should return 403 Forbidden)"
curl -s -X DELETE "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Cleanup
echo "Step 4: Cleanup - Delete test client"
curl -s -X DELETE "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

echo "=== TEST COMPLETE ==="
