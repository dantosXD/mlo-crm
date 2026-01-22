#!/bin/bash
# Get viewer token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@example.com","password":"password123"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "Viewer Token: ${TOKEN:0:50}..."
echo ""

# Test 1: GET clients (should work - Viewer can read)
echo "Test 1: GET /api/clients (should return 200 with data)"
curl -s -X GET "http://localhost:3000/api/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n" \
  | head -c 500
echo -e "\n"

# Get first client ID
CLIENT_ID=$(curl -s -X GET "http://localhost:3000/api/clients" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo "Test Client ID: $CLIENT_ID"
echo ""

# Test 2: GET single client (should work - Viewer can read)
echo "Test 2: GET /api/clients/{id} (should return 200)"
curl -s -X GET "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 3: PUT update client (should FAIL - Viewer cannot write)
echo "Test 3: PUT /api/clients/{id} (should return 403 Forbidden)"
curl -s -X PUT "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Update"}' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 4: POST create client (should FAIL - Viewer cannot write)
echo "Test 4: POST /api/clients (should return 403 Forbidden)"
curl -s -X POST "http://localhost:3000/api/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","email":"test@test.com","phone":"555-1234"}' \
  -w "\nHTTP Status: %{http_code}\n"
echo ""

# Test 5: DELETE client (should FAIL - Viewer cannot delete)
echo "Test 5: DELETE /api/clients/{id} (should return 403 Forbidden)"
curl -s -X DELETE "http://localhost:3000/api/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo ""
