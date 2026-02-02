#!/bin/bash

# Test script for Communication Templates UI
# This script creates test templates and tests the UI

API_URL="http://localhost:3000/api"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Communication Templates UI Test ===${NC}\n"

# Get admin token
echo -e "${YELLOW}1. Getting admin token...${NC}"
ADMIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mlo.com","password":"admin123"}')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Failed to get admin token"
  exit 1
fi

echo -e "${GREEN}✓ Got admin token${NC}\n"

# Create test templates
echo -e "${YELLOW}2. Creating test communication templates...${NC}"

# Template 1: Welcome Email
curl -s -X POST "$API_URL/communication-templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Client Welcome",
    "type": "EMAIL",
    "category": "WELCOME",
    "subject": "Welcome to Our Mortgage Team!",
    "body": "Dear {{client_name}},\n\nWelcome to our mortgage team! We are excited to work with you on your journey to homeownership.\n\nYour loan officer {{loan_officer_name}} will be your primary point of contact.\n\nBest regards,\nThe Mortgage Team",
    "placeholders": ["{{client_name}}", "{{loan_officer_name}}"],
    "isActive": true
  }' > /dev/null

echo -e "${GREEN}✓ Created welcome email template${NC}"

# Template 2: Document Request SMS
curl -s -X POST "$API_URL/communication-templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Document Request - Pay Stubs",
    "type": "SMS",
    "category": "DOCUMENT_REQUEST",
    "subject": null,
    "body": "Hi {{client_name}}, please upload your last 2 pay stubs to your portal by {{due_date}}. Thanks!",
    "placeholders": ["{{client_name}}", "{{due_date}}"],
    "isActive": true
  }' > /dev/null

echo -e "${GREEN}✓ Created document request SMS template${NC}"

# Template 3: Status Update Email
curl -s -X POST "$API_URL/communication-templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pre-Approval Approved",
    "type": "EMAIL",
    "category": "STATUS_UPDATE",
    "subject": "Great News! Your Pre-Approval is Approved",
    "body": "Dear {{client_name}},\n\nGreat news! Your pre-approval has been approved for {{loan_amount}}.\n\nNext steps:\n1. Start house hunting\n2. Submit any offers you find\n3. We will help with the formal application\n\nCongratulations!\n{{loan_officer_name}}",
    "placeholders": ["{{client_name}}", "{{loan_amount}}", "{{loan_officer_name}}"],
    "isActive": true
  }' > /dev/null

echo -e "${GREEN}✓ Created status update email template${NC}"

# Template 4: Inactive template
curl -s -X POST "$API_URL/communication-templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Old Welcome Letter",
    "type": "LETTER",
    "category": "WELCOME",
    "subject": "Welcome Letter (Old Version)",
    "body": "This is an old version of the welcome letter template.",
    "placeholders": [],
    "isActive": false
  }' > /dev/null

echo -e "${GREEN}✓ Created inactive letter template${NC}\n"

# Fetch templates to verify
echo -e "${YELLOW}3. Fetching templates to verify...${NC}"
curl -s "$API_URL/communication-templates" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | head -100

echo -e "\n\n${GREEN}=== Test templates created successfully ===${NC}"
echo -e "${BLUE}Navigate to http://localhost:5173/communication-templates to view the UI${NC}"
