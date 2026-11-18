import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import { hashResetToken } from "./forgot-password.js";
import { sessionCookieName } from "./session.js";
import {
  createRateLimiter,
  validatePasswordStrength,
} from "../security.js";

const validateTokenQuerySchema = z.object({
  token: z.string().trim().min(32).max(256),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32).max(256),
  newPassword: z.string().min(8).max(128),
});

export async function resetPasswordRoute(app: FastifyInstance) {
  const validateRateLimiter = createRateLimiter({
    keyPrefix: "auth:reset-validate",
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  const resetRateLimiter = createRateLimiter({
    keyPrefix: "auth:reset-password",
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  /*
   * GET /auth/reset-password/validate?token=...
   * Validates a reset token before the user fills out the new password form.
   * Never returns user email or account details.
   */
  app.get(
    "/auth/reset-password/validate",
    {
      preHandler: validateRateLimiter,
    },
    async (request, reply) => {
      const parsed = validateTokenQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send({
          valid: false,
          error: "INVALID_TOKEN",
          message: "This password reset link is invalid.",
        });
      }

      const tokenHash = hashResetToken(parsed.data.token);
      const resetToken = await db.orm.public.PasswordResetToken
        .where({ tokenHash })
        .first();

      if (!resetToken) {
        return reply.code(400).send({
          valid: false,
          error: "INVALID_TOKEN",
          message: "This password reset link is invalid or has already been replaced.",
        });
      }

      if (resetToken.usedAt !== null) {
        return reply.code(400).send({
          valid: false,
          error: "TOKEN_USED",
          message: "This password reset link has already been used. Please request a new one.",
        });
      }

      const now = Temporal.Now.instant();
      const expiresAt = Temporal.Instant.from(resetToken.expiresAt.toString());

      if (Temporal.Instant.compare(expiresAt, now) <= 0) {
        return reply.code(400).send({
          valid: false,
          error: "TOKEN_EXPIRED",
          message: "This password reset link has expired. Please request a new one.",
        });
      }

      return reply.code(200).send({
        valid: true,
      });
    },
  );

  /*
   * POST /auth/reset-password
   * Completes password reset using a valid, unexpired, single-use token.
   */
  app.post(
    "/auth/reset-password",
    {
      preHandler: resetRateLimiter,
    },
    async (request, reply) => {
      const parsed = resetPasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "A valid reset token and new password are required.",
        });
      }

      const { token, newPassword } = parsed.data;
      const strength = validatePasswordStrength(newPassword);

      if (!strength.valid) {
        return reply.code(400).send({
          error: "WEAK_PASSWORD",
          message: strength.errors[0],
          errors: strength.errors,
        });
      }

      const tokenHash = hashResetToken(token);
      const resetToken = await db.orm.public.PasswordResetToken
        .where({ tokenHash })
        .first();

      if (!resetToken) {
        return reply.code(400).send({
          error: "INVALID_TOKEN",
          message: "This password reset link is invalid.",
        });
      }

      if (resetToken.usedAt !== null) {
        return reply.code(400).send({
          error: "TOKEN_USED",
          message: "This password reset link has already been used. Please request a new one.",
        });
      }

      const now = Temporal.Now.instant();
      const expiresAt = Temporal.Instant.from(resetToken.expiresAt.toString());

      if (Temporal.Instant.compare(expiresAt, now) <= 0) {
        return reply.code(400).send({
          error: "TOKEN_EXPIRED",
          message: "This password reset link has expired. Please request a new one.",
        });
      }

      const user = await db.orm.public.User
        .where({
          id: resetToken.userId,
          isActive: true,
        })
        .first();

      if (!user) {
        return reply.code(400).send({
          error: "ACCOUNT_INACTIVE",
          message: "This account is no longer active.",
        });
      }

      // Hash new password with Argon2id
      const passwordHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
      });

      // Mark token as single-use immediately
      await db.orm.public.PasswordResetToken
        .where({ id: resetToken.id })
        .update({
          usedAt: now,
        });

      // Update user password
      await db.orm.public.User
        .where({ id: user.id })
        .update({
          passwordHash,
          updatedAt: now,
        });

      // Revoke ALL existing active sessions for this user
      const sessions = await db.orm.public.Session
        .where({ userId: user.id })
        .all();

      for (const session of sessions) {
        await db.orm.public.Session
          .where({ id: session.id })
          .delete();
      }

      // Clear any active session cookie on the requester
      reply.clearCookie(sessionCookieName, {
        path: "/",
      });

      // Record a security notification in the student's notification inbox
      try {
        await db.orm.public.StudentNotification.create({
          userId: user.id,
          type: "SECURITY_ALERT",
          title: "Password Reset Completed",
          message:
            "Your account password was reset and all previous active sessions were signed out.",
        });
      } catch (notifyError) {
        app.log.warn(notifyError, "Failed to record password reset security notification");
      }

      return reply.code(200).send({
        success: true,
        message:
          "Your password has been reset successfully. All previous sessions have been signed out. You can now sign in with your new password.",
      });
    },
  );
}
