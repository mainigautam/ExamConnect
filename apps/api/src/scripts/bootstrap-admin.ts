import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";
import { validatePasswordStrength } from "../security.js";

/**
 * Secure one-time CLI script to bootstrap or promote an ADMIN user.
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD="StrongPassword1!" pnpm --filter @examconnect/api exec tsx src/scripts/bootstrap-admin.ts
 *
 * Or to promote an existing account without changing its password:
 *   ADMIN_EMAIL=existing@example.com pnpm --filter @examconnect/api exec tsx src/scripts/bootstrap-admin.ts
 */
async function main() {
  const emailRaw = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!emailRaw || !emailRaw.includes("@")) {
    console.error("ERROR: Set ADMIN_EMAIL environment variable to a valid email address.");
    process.exit(1);
  }

  const email = emailRaw.toLowerCase();
  const now = Temporal.Now.instant();

  const existing = await db.orm.public.User.where({ email }).first();

  if (existing) {
    const updatePayload: {
      role: string;
      isActive: boolean;
      updatedAt: Temporal.Instant;
      passwordHash?: string;
    } = {
      role: "ADMIN",
      isActive: true,
      updatedAt: now,
    };

    if (password) {
      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        console.error("ERROR: Weak ADMIN_PASSWORD:", strength.errors.join(" "));
        process.exit(1);
      }
      updatePayload.passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });
    }

    await db.orm.public.User.where({ id: existing.id }).update(updatePayload);
    console.log(`Promoted existing user (id=${existing.id}, email=${email}) to ADMIN role.`);
  } else {
    if (!password) {
      console.error(
        "ERROR: User does not exist yet. Provide ADMIN_PASSWORD to create a new ADMIN user.",
      );
      process.exit(1);
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      console.error("ERROR: Weak ADMIN_PASSWORD:", strength.errors.join(" "));
      process.exit(1);
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const user = await db.orm.public.User.create({
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      updatedAt: now,
    });

    console.log(`Created new ADMIN user (id=${user.id}, email=${email}).`);
  }

  await db.close();
}

main().catch(async (error) => {
  console.error("Bootstrap admin failed:", error);
  try {
    await db.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
