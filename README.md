# Secure LMS — Backend

An online learning platform for cybersecurity training, built so that the
security of the platform itself is part of the product: every sign-in,
role change and privileged action is recorded, sessions can be revoked
individually, and an admin dashboard reports on what the logs contain.

Courses, lessons and quizzes sit on top of that, along with peer-to-peer
video calls over WebRTC for live sessions.

The interface lives in
[cybersecurity_of_olp-frontend](https://github.com/MergenUchiha/cybersecurity_of_olp-frontend).

## Stack

| Area | Choice |
|---|---|
| Runtime | Node.js 20+, TypeScript 5 |
| Framework | NestJS 11 on Express |
| Database | SQLite through Prisma 6 |
| Auth | JWT access/refresh with passport-jwt, bcrypt, three roles |
| Realtime | socket.io — WebRTC signalling for video calls |
| Rate limiting | `@nestjs/throttler` |
| Docs | Swagger at `/api/docs`, behind a flag |

Dependencies are installed with [bun](https://bun.sh); every script runs under
npm.

## What is in it

**Security auditing.** Every sign-in attempt, password change, role change,
block and session revocation is written to a security-event log. Failed
sign-ins are counted twice over — per address and per account — and the
account locks before the address does, so one attacker cannot lock a whole
office out by hammering a single username.

**Sessions as first-class objects.** A row per session, revocable one at a
time or all at once for a user. Every request re-reads whether the user is
still active, still unblocked and whether their session survives; a revoked
session stops working immediately rather than when the token expires.

**Audit log.** A separate record of what changed — who published a course,
who enrolled, who changed a role — kept apart from the security events.

**Analytics.** Aggregates over both logs: failed sign-ins over time, events
by type and by role, blocking statistics.

**Video calls.** WebRTC signalling over socket.io. The socket authenticates
with the same JWT, rooms carry an invite list, and signalling is only relayed
between participants of the same room.

## Getting started

Requirements: Node.js 20 or newer and bun.

```bash
git clone https://github.com/MergenUchiha/cybersecurity_of_olp-backend.git
cd cybersecurity_of_olp-backend
bun install                    # dependencies only; the scripts below are npm

cp .env.example .env           # then fill in JWT_SECRET
npm run db:migrate
npm run db:seed                # demo users, courses, lessons and quizzes

npm run start:dev              # http://localhost:3000/api
```

### Production

```bash
npm run build
npx prisma migrate deploy
NODE_ENV=production npm run start:prod
```

## Configuration

Every variable is listed in [`.env.example`](.env.example) with a comment, and
the configuration is validated at startup — a missing or malformed value stops
the process with a message naming it.

| Variable | Notes |
|---|---|
| `JWT_SECRET` | Required, at least 32 characters. Generate with `openssl rand -hex 32`. There is deliberately no default: a fallback secret in a public repository lets anyone sign an admin token. |
| `DATABASE_URL` | The schema targets SQLite; a `postgresql://` URL will not migrate. |
| `CORS_ORIGINS` | Comma-separated allow-list, used by both the HTTP API and the video socket. Required in production; empty in development permits any localhost port. |
| `SWAGGER_ENABLED` | Publishes `/api/docs`. Off by default. |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Global rate limit. Sign-in attempts are counted separately from the security-event log. |

## Access model

Three roles: `STUDENT`, `TEACHER`, `ADMIN`. Every controller sits behind
`JwtAuthGuard`; the routes below name the role each one additionally requires.

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh` | public |
| POST | `/api/auth/request-password-reset`, `/api/auth/reset-password` | public |
| GET | `/api/auth/verify-email` | public |
| POST | `/api/auth/logout`, `/api/auth/change-password` | any |
| GET | `/api/auth/profile` | any |
| GET · PATCH | `/api/users/profile` | any |
| GET | `/api/users`, `/api/users/:id` | `ADMIN` |
| PATCH | `/api/users/:id/block`, `/unblock`, `/role`, `/toggle-active` | `ADMIN` |
| GET | `/api/courses`, `/api/courses/:id` | any |
| POST · PATCH · DELETE | `/api/courses`, `/api/courses/:id` | `TEACHER`, `ADMIN` |
| GET | `/api/lessons/course/:courseId`, `/api/lessons/:id` | any |
| POST · PATCH · DELETE | `/api/lessons/…` | `TEACHER`, `ADMIN` |
| GET | `/api/quizzes/:id`, `/api/quizzes/my-attempts/all` | any |
| POST | `/api/quizzes/:quizId/submit` | any |
| POST · PATCH · DELETE | `/api/quizzes/…` | `TEACHER`, `ADMIN` |
| GET | `/api/quizzes/:quizId/attempts` | `TEACHER`, `ADMIN` |
| POST · DELETE | `/api/enrollments/:courseId` | any |
| GET | `/api/enrollments/my-courses`, `/check/:courseId` | any |
| GET | `/api/enrollments/course/:courseId` | `TEACHER`, `ADMIN` |
| GET | `/api/sessions/my-sessions` | any |
| GET · PATCH | `/api/sessions`, `/api/sessions/:id/revoke` | `ADMIN` |
| GET | `/api/security-events`, `/api/audit-logs`, `/api/analytics/*` | `ADMIN` |

The video socket listens on `/video-socket` and expects the access token in
the socket.io handshake.

## Tokens

Access and refresh tokens are both JWTs signed with the same secret, and they
carry a `type` claim that says which is which — an access token is rejected at
`/auth/refresh` and a refresh token is rejected everywhere else. Each one also
carries the id of its session, which is how a refresh is resolved to a single
database row.

Refresh rotates: the presented session is revoked and a new one issued, with
the token stored as a bcrypt hash. Signing out revokes the session named in
the token.

## Scripts

| Script | What it does |
|---|---|
| `npm run start:dev` | Watch mode |
| `npm run start:prod` | Runs the compiled `dist/main` |
| `npm run build` | Compiles to `dist/` |
| `npm run lint` | ESLint with type-aware rules, autofixing |
| `npm run format` | Prettier |
| `npm run db:migrate` | Creates and applies a migration |
| `npm run db:seed` | Demo data |
| `npm run db:studio` | Opens Prisma Studio |
| `npm test` | Jest |

## Known limitations

- There are no automated tests.
- The schema stores enums as plain strings, because SQLite has none. Moving to
  PostgreSQL would let the database enforce them.
- Email is not sent anywhere: verification and password-reset tokens are
  created and stored, and delivery is left to be wired up.
- A role change takes effect when the current access token expires — the role
  travels inside the token, and only the account's active/blocked state and
  its session are re-read per request.
