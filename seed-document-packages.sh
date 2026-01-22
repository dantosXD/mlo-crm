#!/bin/bash

# Seed standard document packages
# This script calls the seed endpoint to create standard packages

echo "Seeding standard document packages..."

# Login as admin to get token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get access token"
  exit 1
fi

echo "Got access token, seeding packages..."

# Seed packages
SEED_RESPONSE=$(curl -s -X POST http://localhost:3000/api/document-packages/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN")

echo "Response: $SEED_RESPONSE"

echo "Done!"
