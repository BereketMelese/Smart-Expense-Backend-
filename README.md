# Smart Expense + Habit Tracker Backend

Production-ready backend API for Smart Expense + Habit Tracker Dashboard.

## Stack

- Node.js + TypeScript
- Fastify
- PostgreSQL
- Prisma ORM
- JWT access token + refresh token
- Zod validation
- bcrypt password hashing
- Vitest tests
- Swagger docs

## Architecture Plan

1. HTTP API layer in Fastify route modules under src/routes.
2. Validation at route boundaries using Zod.
3. Authentication with short-lived access JWT and hashed refresh tokens persisted in PostgreSQL.
4. Prisma as database layer with user-scoped queries to prevent cross-user access.
5. Centralized error handling returning consistent shape: message, code, details.
6. Integration and unit tests via Vitest.

## Project Tree

.
├── Dockerfile
├── docker-compose.yml
├── prisma
│ ├── migrations
│ │ └── 20260401000000_init
│ │ └── migration.sql
│ ├── schema.prisma
│ └── seed.ts
├── src
│ ├── app.ts
│ ├── server.ts
│ ├── config
│ │ └── env.ts
│ ├── lib
│ │ ├── errors.ts
│ │ ├── hash.ts
│ │ ├── prisma.ts
│ │ └── validation.ts
│ ├── plugins
│ │ └── auth.ts
│ ├── routes
│ │ ├── auth.ts
│ │ ├── dashboard.ts
│ │ ├── expenses.ts
│ │ └── habits.ts
│ ├── services
│ │ └── auth.service.ts
│ └── types
│ └── fastify.d.ts
├── tests
│ ├── setup.ts
│ ├── integration
│ │ └── api.integration.test.ts
│ └── unit
│ └── auth.service.test.ts
├── .env.example
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vitest.config.mts

## Data Models

- User
- RefreshToken
- Expense
- Habit
- HabitCheckIn

Defined in prisma/schema.prisma.

## Environment Variables

Copy .env.example to .env and set values:

- DATABASE_URL
- TEST_DATABASE_URL
- PORT
- NODE_ENV
- APP_ORIGIN
- JWT_ACCESS_SECRET
- ACCESS_TOKEN_TTL
- REFRESH_TOKEN_TTL_DAYS
- BCRYPT_SALT_ROUNDS
- DEFAULT_START_BALANCE

## Scripts

- npm run dev
- npm run build
- npm run start
- npm run lint
- npm run test
- npm run prisma:generate
- npm run prisma:migrate
- npm run seed

## Run Instructions

1. Install dependencies:
   - npm install
2. Start PostgreSQL:
   - docker compose up -d
3. Apply migration:
   - npm run prisma:migrate -- --name init
4. Generate client:
   - npm run prisma:generate
5. Seed demo data:
   - npm run seed
6. Start API:
   - npm run dev

Server defaults to http://localhost:4000

Swagger UI: http://localhost:4000/docs

## Test Instructions

1. Ensure PostgreSQL is running.
2. Ensure TEST_DATABASE_URL points to a valid test database.
3. Apply migrations to test DB using DATABASE_URL override:
   - DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
4. Run tests:
   - npm run test

## API Endpoints

### Auth

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/forgot-password

### Expenses

- GET /api/expenses
- POST /api/expenses
- PUT /api/expenses/:id
- DELETE /api/expenses/:id

### Habits

- GET /api/habits
- POST /api/habits
- PUT /api/habits/:id
- DELETE /api/habits/:id
- POST /api/habits/:id/check-ins
- GET /api/habits/:id/check-ins

### Dashboard

- GET /api/dashboard/summary
- GET /api/dashboard/recent-transactions
- GET /api/dashboard/habit-progress

## Response Examples

### Login

POST /api/auth/login

Response:
{
"message": "Login successful",
"data": {
"user": {
"id": "clxxx",
"name": "Demo User",
"email": "demo@example.com",
"avatarUrl": "https://i.pravatar.cc/120?img=12",
"createdAt": "2026-04-01T00:00:00.000Z"
},
"accessToken": "...",
"refreshToken": "...",
"expiresIn": "15m"
}
}

### Me

GET /api/auth/me

Response:
{
"message": "Current user fetched",
"data": {
"id": "clxxx",
"name": "Demo User",
"email": "demo@example.com",
"avatarUrl": "https://i.pravatar.cc/120?img=12",
"createdAt": "2026-04-01T00:00:00.000Z"
}
}

### Dashboard Summary

GET /api/dashboard/summary

Response:
{
"message": "Dashboard summary fetched",
"data": {
"currentBalance": 4872.25,
"monthlySpend": 127.75,
"currentStreak": 2
}
}

### Recent Transactions

GET /api/dashboard/recent-transactions

Response:
{
"message": "Recent transactions fetched",
"data": [
{
"id": "clxxx",
"title": "Groceries",
"amount": 82.75,
"category": "Food",
"expenseDate": "2026-04-01T00:00:00.000Z",
"notes": "Weekly market"
}
]
}

### Habit Progress

GET /api/dashboard/habit-progress

Response:
{
"message": "Habit progress fetched",
"data": [
{
"habitId": "clxxx",
"habitName": "Workout",
"targetType": "DAILY",
"targetCount": 1,
"currentCount": 1,
"progressPercent": 100,
"color": "#0ea5e9"
}
]
}

## Consistent Error Shape

All API errors follow:
{
"message": "Validation failed",
"code": "VALIDATION_ERROR",
"details": {}
}

## Frontend Switch from Mock to Real API

In your React app env:

- VITE_AUTH_MODE=api
- VITE_API_BASE_URL=http://localhost:4000/api

Then replace mock auth service calls with HTTP calls to the endpoints above.
