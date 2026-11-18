import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import { requireAuth } from "./guards.js";
import {
  createSession,
  hashSessionToken,
  sessionCookieName,
} from "./session.js";
import {
  createRateLimiter,
  getSessionCookieOptions,
  validatePasswordStrength,
} from "../security.js";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export async function changePasswordRoute(app: FastifyInstance) {
  const rateLimiter = createRateLimiter({
    keyPrefix: "auth:change-password",
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  app.post(
    "/auth/change-password",
    {
      preHandler: [rateLimiter, requireAuth],
    },
    async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Current password and new password are required.",
        });
      }

      const { currentPassword, newPassword } = parsed.data;

      if (currentPassword === newPassword) {
        return reply.code(400).send({
          error: "SAME_PASSWORD",
          message: "New password must be different from your current password.",
        });
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        return reply.code(400).send({
          error: "WEAK_PASSWORD",
          message: strength.errors[0],
          errors: strength.errors,
        });
      }

      const user = await db.orm.public.User
        .where({
          id: request.authUser!.id,
          isActive: true,
        })
        .first();

      if (!user || !user.passwordHash) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
          message: "Unable to verify current credentials.",
        });
      }

      const matches = await argon2.verify(user.passwordHash, currentPassword);
      if (!matches) {
        return reply.code(400).send({
          error: "INVALID_CURRENT_PASSWORD",
          message: "Current password is incorrect.",
        });
      }

      const now = Temporal.Now.instant();
      const passwordHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
      });

      await db.orm.public.User
        .where({ id: user.id })
        .update({
          passwordHash,
          updatedAt: now,
        });

      // Revoke all existing sessions (including other devices), then rotate current session
      const currentRawToken = request.cookies[sessionCookieName];
      const currentHash = currentRawToken ? hashSessionToken(currentRawToken) : null;

      const sessions = await db.orm.public.Session
        .where({ userId: user.id })
        .all();

      for (const session of sessions) {
        if (!currentHash || session.tokenHash !== currentHash) {
          await db.orm.public.Session.where({ id: session.id }).delete();
        }
      }

      // Rotate current session cookie for best security practice
      if (currentHash) {
        const oldCurrent = sessions.find((s) => s.tokenHash === currentHash);
        if (oldCurrent) {
          await db.orm.public.Session.where({ id: oldCurrent.id }).delete();
        }
      }

      const freshSession = await createSession(user.id);
      reply.setCookie(
        sessionCookieName,
        freshSession.rawToken,
        getSessionCookieOptions(),
      );

      try {
        await db.orm.public.StudentNotification.create({
          userId: user.id,
          type: "SECURITY_ALERT",
          title: "Password Changed",
          message:
            "Your account password was changed successfully. All other active sessions have been signed out.",
        });
      } catch (notifyError) {
        app.log.warn(notifyError, "Failed to record password change notification");
      }

      return reply.code(200).send({
        success: true,
        message: "Password updated successfully.",
      });
    },
  );
}
