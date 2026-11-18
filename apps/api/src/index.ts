import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";

import { db } from "@examconnect/database";

import { registerSecurityHeaders } from "./security.js";
import { registerRoute } from "./auth/register.js";
import { loginRoute } from "./auth/login.js";
import { logoutRoute } from "./auth/logout.js";
import { meRoute } from "./auth/me.js";
import { protectedRoute } from "./auth/protected.js";
import { forgotPasswordRoute } from "./auth/forgot-password.js";
import { resetPasswordRoute } from "./auth/reset-password.js";
import { changePasswordRoute } from "./auth/change-password.js";

import { studentRoute } from "./student.js";
import { eligibilityRoute } from "./eligibility/eligibility.js";
import { examRoute } from "./exams.js";
import { adminExamRoute } from "./admin-exams.js";
import { adminNotificationSourceRoute } from "./admin-notification-sources.js";
import { adminManagementRoute } from "./admin-management.js";
import { studentNotificationRoute } from "./student-notifications.js";

const app = Fastify({
  trustProxy: true,
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.newPassword",
      "req.body.currentPassword",
      "req.body.token",
    ],
  },
});

const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? (isProduction ? "0.0.0.0" : "127.0.0.1");

const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const appOrigin = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");

const devOrigins = isProduction
  ? []
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

const allowedOrigins = Array.from(
  new Set([
    ...devOrigins,
    ...(appOrigin ? [appOrigin] : []),
    ...configuredOrigins,
  ]),
);

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await app.register(cookie);
registerSecurityHeaders(app);

// Global error handler — never expose internal stack traces or DB credentials
app.setErrorHandler((error, request, reply) => {
  request.log.error(error, "Unhandled API error");

  const statusCode =
    typeof (error as { statusCode?: number }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;

  if (statusCode >= 500) {
    return reply.code(500).send({
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected server error occurred. Please try again later.",
    });
  }

  return reply.code(statusCode).send({
    error: "REQUEST_ERROR",
    message: error instanceof Error ? error.message : "Request failed.",
  });
});

// Basic API health check
app.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
});

// Database health check
app.get("/health/db", async (_request, reply) => {
  try {
    await db.orm.public.User.first();
    return {
      status: "ok",
      service: "database",
    };
  } catch (error) {
    app.log.error(error, "Database health check failed");
    return reply.code(503).send({
      status: "error",
      service: "database",
      message: "Database connection unavailable.",
    });
  }
});

// Authentication routes
await registerRoute(app);
await loginRoute(app);
await logoutRoute(app);
await meRoute(app);
await forgotPasswordRoute(app);
await resetPasswordRoute(app);
await changePasswordRoute(app);

// Student routes
await studentRoute(app);
await studentNotificationRoute(app);

// Eligibility routes
await eligibilityRoute(app);

// Exam read routes
await examRoute(app);

// Protected routes
await protectedRoute(app);

// Admin routes
await adminExamRoute(app);
await adminNotificationSourceRoute(app);
await adminManagementRoute(app);

const shutdown = async () => {
  try {
    await db.close();
    await app.close();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({
  port,
  host,
});
