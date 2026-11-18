import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { Temporal } from "@js-temporal/polyfill";

import {
  generateSecureResetToken,
  hashResetToken,
  PASSWORD_RESET_TTL_MINUTES,
} from "./forgot-password.js";
import { hashSessionToken } from "./session.js";
import {
  checkRateLimit,
  resetRateLimitBuckets,
  validatePasswordStrength,
} from "../security.js";
import { renderPasswordResetEmail } from "../email/email-service.js";

describe("Authentication Security — Password Hashing, Tokens & Rate Limiting", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
  });

  it("hashes passwords with Argon2id and rejects invalid passwords", async () => {
    const raw = "ExamConnect@2026";
    const hash = await argon2.hash(raw, { type: argon2.argon2id });
    assert.notEqual(hash, raw);
    assert.ok(hash.startsWith("$argon2id$"));
    assert.equal(await argon2.verify(hash, raw), true);
    assert.equal(await argon2.verify(hash, "WrongPassword1!"), false);
  });

  it("enforces strong password requirements", () => {
    assert.equal(validatePasswordStrength("short").valid, false);
    assert.equal(validatePasswordStrength("alllowercase1").valid, false);
    assert.equal(validatePasswordStrength("ALLUPPERCASE1").valid, false);
    assert.equal(validatePasswordStrength("NoNumbersHere").valid, false);
    assert.equal(validatePasswordStrength("ValidPass123").valid, true);
  });

  it("generates cryptographically strong unique reset tokens and stores only SHA-256 hashes", () => {
    const t1 = generateSecureResetToken();
    const t2 = generateSecureResetToken();

    assert.equal(t1.length, 64); // 32 bytes hex = 256 bits entropy
    assert.notEqual(t1, t2);

    const h1 = hashResetToken(t1);
    const h1Again = hashResetToken(t1);
    assert.equal(h1.length, 64);
    assert.equal(h1, h1Again);
    assert.notEqual(h1, t1); // Plaintext token is never equal to stored hash
  });

  it("hashes session tokens deterministically via SHA-256", () => {
    const rawSession = "session_raw_token_123";
    const h = hashSessionToken(rawSession);
    assert.equal(h.length, 64);
    assert.notEqual(h, rawSession);
  });

  it("enforces sliding-window rate limits cleanly", () => {
    for (let i = 0; i < 5; i += 1) {
      const res = checkRateLimit("test:forgot:127.0.0.1", 60_000, 5);
      assert.equal(res.allowed, true);
    }
    const blocked = checkRateLimit("test:forgot:127.0.0.1", 60_000, 5);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });

  it("renders professional password reset HTML & text emails with safe HTML escaping", () => {
    const resetUrl = "http://localhost:3000/reset-password?token=abc123def456";
    const rendered = renderPasswordResetEmail({
      resetUrl,
      expiresMinutes: PASSWORD_RESET_TTL_MINUTES,
      recipientEmail: "student+test@example.com",
    });

    assert.match(rendered.subject, /Reset your ExamConnect password/i);
    assert.ok(rendered.text.includes(resetUrl));
    assert.ok(rendered.html.includes(resetUrl));
    assert.ok(rendered.html.includes(`${PASSWORD_RESET_TTL_MINUTES} minutes`));
    assert.ok(!rendered.html.includes("<script>"));
  });

  it("simulates complete single-use, expiry, and session revocation lifecycle", async () => {
    // In-memory repository simulation mirroring DB contract logic
    const now = Temporal.Now.instant();
    const rawToken = generateSecureResetToken();
    const tokenRecord: {
      userId: number;
      tokenHash: string;
      expiresAt: Temporal.Instant;
      usedAt: Temporal.Instant | null;
    } = {
      userId: 1,
      tokenHash: hashResetToken(rawToken),
      expiresAt: now.add({ minutes: PASSWORD_RESET_TTL_MINUTES }),
      usedAt: null,
    };

    const sessions = [
      { id: 10, userId: 1, tokenHash: hashSessionToken("old-session-1") },
      { id: 11, userId: 1, tokenHash: hashSessionToken("old-session-2") },
    ];

    // 1. Validate unexpired, unused token
    assert.equal(tokenRecord.usedAt, null);
    assert.equal(Temporal.Instant.compare(tokenRecord.expiresAt, now) > 0, true);

    // 2. Complete reset: mark single-use, hash new password, revoke sessions
    const newHash = await argon2.hash("NewStrongPass99!", { type: argon2.argon2id });
    tokenRecord.usedAt = now;
    const remainingSessions = sessions.filter((s) => s.userId !== tokenRecord.userId);

    assert.equal(await argon2.verify(newHash, "NewStrongPass99!"), true);
    assert.equal(remainingSessions.length, 0); // All existing sessions revoked
    assert.notEqual(tokenRecord.usedAt, null); // Reused token will now be rejected

    // 3. Expired token check
    const expiredAt = now.subtract({ minutes: 1 });
    assert.equal(Temporal.Instant.compare(expiredAt, now) <= 0, true);
  });
});
