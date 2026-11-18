# ExamConnect REST API Documentation

Base URL (local development): `http://localhost:4000`
Authentication: HttpOnly session cookie (`examconnect_session`) with `credentials: "include"`.

---

## 1. Health Checks

- `GET /health` — API service liveness (`{ status: "ok", service: "api" }`)
- `GET /health/db` — Database connectivity check (`200 ok` or `503 error`)

---

## 2. Authentication & Account Security

All auth mutation routes enforce sliding-window rate limiting (`429 RATE_LIMITED`).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Register a new `STUDENT` account (enforces strong password; never assigns `ADMIN`) |
| `POST` | `/auth/login` | Public | Authenticate with email + Argon2id password; sets HttpOnly session cookie |
| `POST` | `/auth/logout` | Cookie | Deletes session record and clears cookie |
| `GET` | `/auth/me` | Required | Returns current authenticated `{ user: { id, email, role } }` |
| `POST` | `/auth/forgot-password` | Public | Generates single-use 256-bit reset token (20-min expiry, SHA-256 hashed in DB) and emails reset link. Returns generic `200` regardless of whether account exists to prevent email enumeration |
| `GET` | `/auth/reset-password/validate?token=...` | Public | Validates reset token existence, single-use status, and expiry without disclosing user data |
| `POST` | `/auth/reset-password` | Public | Resets password via valid token, hashes with Argon2id, marks token used, and revokes all existing sessions |
| `POST` | `/auth/change-password` | Required | Changes password after verifying `currentPassword`; rotates current session and revokes all other sessions |

---

## 3. Student Profile, Education, Eligibility, Bookmarks & Notifications

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/student/profile` | Returns profile, email, and `profileCompletion` (`percentage`, `missingFields`) |
| `PUT` | `/student/profile` | Create or update student personal profile (accepts `YYYY-MM-DD` or ISO datetime for `dateOfBirth`) |
| `GET` | `/student/education` | List all education records for the student |
| `POST` | `/student/education` | Add an education record (additive — never deletes existing records) |
| `PUT` | `/student/education/:id` | Update a specific education record owned by the student |
| `DELETE` | `/student/education/:id` | Delete a specific education record owned by the student |
| `GET` | `/student/eligible-exams` | Batch-evaluates all active exams and posts with rule-by-rule explanations, deadlines, sources, and bookmark status |
| `GET` | `/student/exams/:examId/eligibility` | Evaluates a single examination with detailed exam-level vs post-level rule evaluations |
| `GET` | `/student/saved-exams` | List bookmarked exams |
| `POST` | `/student/saved-exams/:examId` | Bookmark an exam (idempotent) |
| `DELETE` | `/student/saved-exams/:examId` | Remove exam bookmark |
| `GET` | `/student/notifications` | List student notifications (newest first) + `unreadCount` |
| `PATCH` | `/student/notifications/:id/read` | Mark one notification as read |
| `PATCH` | `/student/notifications/read-all` | Mark all unread notifications as read |
| `DELETE` | `/student/notifications/:id` | Delete one notification owned by the student |

---

## 4. Public Exam Catalogue

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/exams` | List exams |
| `GET` | `/exams/:id` | Get exam by ID |
| `GET` | `/exams/:id/posts` | List posts under an exam |
| `GET` | `/exams/:id/eligibility-rules` | List eligibility rules for an exam |
| `GET` | `/exams/:id/deadlines` | List application deadlines for an exam |

---

## 5. Administration APIs (Requires `ADMIN` Role)

Every `/admin/*` endpoint enforces `[requireAuth, requireRole("ADMIN")]` on the backend (`401` if unauthenticated, `403` for non-admin users).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/dashboard` | Platform KPIs and per-exam qualified student counts |
| `GET` | `/admin/exams` | All exams (including archived) with post/rule/deadline/student metrics |
| `GET` | `/admin/exams/:examId` | Full exam config (posts, rules + versions, deadlines, sources) |
| `POST` | `/admin/exams` | Create a new exam |
| `PATCH` | `/admin/exams/:examId` | Update exam metadata or archive/restore (`isArchived`) |
| `POST` | `/admin/exams/:examId/posts` | Create a post under an exam |
| `PATCH` | `/admin/posts/:postId` | Edit a post |
| `DELETE` | `/admin/posts/:postId` | Delete a post and its post-scoped rules/deadlines |
| `POST` | `/admin/exams/:examId/eligibility-rules` | Create exam/post rule + version (`logicGroup`, `logicOperator`, `notificationSourceId`, effective dates) |
| `PATCH` | `/admin/eligibility-rule-versions/:versionId` | Update rule version status (`ACTIVE`/`INACTIVE`), expression, dates, or source |
| `PATCH` | `/admin/eligibility-rule-versions/:versionId/source` | Attach an official notification source to a rule version |
| `POST` | `/admin/exams/:examId/deadlines` | Create an application deadline |
| `PATCH` | `/admin/deadlines/:deadlineId` | Update deadline status (`OPEN`/`UPCOMING`/`CLOSED`/`NOTIFICATION_AWAITED`) or dates |
| `DELETE` | `/admin/deadlines/:deadlineId` | Delete a deadline |
| `GET` | `/admin/notification-sources` | List all notification sources |
| `POST` | `/admin/notification-sources` | Register a new official notification source |
| `PATCH` | `/admin/notification-sources/:id` | Edit or verify a notification source (`markVerified: true`) |
| `GET` | `/admin/students` | Paginated student/user directory (never returns `passwordHash`) |
| `PATCH` | `/admin/students/:id/status` | Activate or suspend a user account (revokes sessions on suspend) |
| `GET` | `/admin/notifications` | View recent platform notifications |
| `POST` | `/admin/notifications/broadcast` | Broadcast an announcement to all active students |
| `POST` | `/admin/notifications/run-reminders` | Trigger 7d/3d/1d deadline reminder check immediately |
| `GET` | `/admin/system-health` | DB health, SMTP/Redis readiness, unverified source audit, table counts |
