# MLO Dashboard

A comprehensive CRM and loan origination system for Mortgage Loan Officers (MLOs) that manages the entire mortgage lending workflow from lead capture through loan closing.

## Features

- **Client Management**: CRUD operations with encrypted PII, hash-based fast search
- **Pipeline Management**: Kanban board with drag-and-drop status changes
- **Document Management**: Upload, track, request documents with automated reminders
- **Loan Scenario Planner**: Compare multiple loan options with visual comparisons
- **Quick Capture Bar**: Universal command interface (Ctrl+K) with natural language parsing
- **Customizable Dashboard**: Drag-and-drop widgets for personalized workspace
- **Notes & Tasks**: Connected notes and task management with templates
- **Analytics & Reporting**: Pipeline metrics, conversion rates, activity trends

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Mantine UI v7
- Zustand (state management)
- React Query (server state)
- React Router v6
- Vite (build tool)

### Backend
- Node.js 20+
- Express.js with TypeScript
- PostgreSQL 15+
- Prisma ORM
- JWT Authentication
- Socket.io (real-time)

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mlo-dash-new
   ```

2. **Run the setup script**
   ```bash
   ./init.sh
   ```
   This will:
   - Check prerequisites
   - Create a `.env` file with defaults
   - Install all dependencies
   - Set up the database

3. **Start development servers**
   ```bash
   npm run dev
   ```
   Or start servers separately:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev

   # Optional Terminal 3 - Worker
   cd backend && npm run worker
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - API Health Checks: http://localhost:3000/health/live and http://localhost:3000/health/ready

## Project Structure

```
mlo-dash-new/
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand state stores
│   │   ├── services/      # API service functions
│   │   ├── types/         # TypeScript type definitions
│   │   └── utils/         # Utility functions
│   ├── public/
│   └── package.json
│
├── backend/                # Express backend API
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Express middleware
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Business logic
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
│
├── app_spec.txt           # Complete application specification
├── init.sh                # Environment setup script
├── features.db            # Feature tracking database
└── README.md
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mlo_dashboard

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Encryption (for PII)
ENCRYPTION_KEY=your-32-byte-base64-key

# File Storage
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=mlo-documents

# Shared cache (required in production)
REDIS_URL=redis://localhost:6379

# Application
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3000
NODE_ENV=development
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

### Clients
- `GET /api/clients` - List all clients
- `GET /api/clients/:id` - Get client by ID
- `POST /api/clients` - Create new client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `GET /api/clients/search` - Search clients

### Notes, Tasks, Documents, Loan Scenarios
- Full CRUD operations for each entity
- See `app_spec.txt` for complete API documentation

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
npm run test:backend

# Run e2e tests
npm run test:e2e
```

### Code Quality
```bash
# Lint code
npm run lint

# CI lint gate (fails if warning budget regresses)
npm run lint:ci

# Format code
npm run format

# Type check
npm run typecheck
```

### Database Migrations
```bash
cd backend

# Generate migration
npx prisma migrate dev --name <migration-name>

# Apply migrations
npx prisma migrate deploy

# One-time migration from legacy SQLite data
npm run migrate:sqlite-to-postgres

# Reset database
npx prisma migrate reset
```

## Production Operations

- Deployment and rollback runbook: `docs/production-runbook.md`
- Backend API runs as a stateless service (`npm start`)
- Scheduled jobs run in dedicated worker process (`npm run worker`)
- Staging smoke check: `npm run ops:staging-smoke -- --base-url=https://<staging-host>`
- Restore integrity check: `DATABASE_URL=<restored-db-url> npm run ops:db:validate-integrity`
- Branch protection bootstrap: `GITHUB_TOKEN=<token> GITHUB_REPOSITORY=<owner>/<repo> npm run ops:configure-branch-protection`

## Security

- All PII (name, email, phone) is encrypted with AES-256
- SHA-256 hashes stored for fast search without decryption
- JWT authentication with refresh token rotation
- Role-based access control (RBAC)
- Audit logging for compliance

## Contributing

1. Check `features.db` for pending features to implement
2. Follow the coding standards in the existing codebase
3. Write tests for new functionality
4. Submit pull requests for review

## License

Proprietary - All rights reserved
