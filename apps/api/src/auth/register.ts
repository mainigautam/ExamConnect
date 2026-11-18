import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { db } from "@examconnect/database";

import {
  createRateLimiter,
  validatePasswordStrength,
} from "../security.js";

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
});

export async function registerRoute(app: FastifyInstance) {
  const registerRateLimiter = createRateLimiter({
    keyPrefix: "auth:register",
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  app.post(
    "/auth/register",
    {
      preHandler: registerRateLimiter,
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: "Please provide a valid email and password.",
        });
      }

      const { email, password, firstName, lastName } = parsed.data;
      const strength = validatePasswordStrength(password);

      if (!strength.valid) {
        return reply.code(400).send({
          error: "WEAK_PASSWORD",
          message: strength.errors[0],
          errors: strength.errors,
        });
      }

      const normalizedEmail = email.toLowerCase();

      const existingUser = await db.orm.public.User
        .where({ email: normalizedEmail })
        .first();

      if (existingUser) {
        return reply.code(409).send({
          error: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });

      const now = Temporal.Now.instant();

      // Always register public signups strictly as STUDENT (never ADMIN)
      const user = await db.orm.public.User.create({
        email: normalizedEmail,
        passwordHash,
        role: "STUDENT",
        isActive: true,
        updatedAt: now,
      });

      if (firstName) {
        await db.orm.public.StudentProfile.create({
          userId: user.id,
          firstName,
          lastName: lastName || undefined,
          updatedAt: now,
        });
      }

      return reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    },
  );
}
