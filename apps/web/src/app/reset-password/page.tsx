"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../../components/ui.module.css";
import { AlertBanner, LoadingSkeleton } from "../../components/FeedbackStates";
import {
  IconArrowLeft,
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconLock,
  IconXCircle,
} from "../../components/Icons";
import {
  evaluatePasswordChecks,
  PasswordStrength,
} from "../../components/PasswordStrength";
import { apiFetch } from "../../lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    let active = true;

    async function validateToken() {
      if (!token) {
        setValidating(false);
        setTokenValid(false);
        setTokenError(
          "No reset token was provided in this URL. Please request a new password reset link.",
        );
        return;
      }

      try {
        setValidating(true);
        await apiFetch<{ valid: boolean }>(
          `/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
        );
        if (!active) return;
        setTokenValid(true);
        setTokenError(null);
      } catch (err) {
        if (!active) return;
        setTokenValid(false);
        setTokenError(
          err instanceof Error
            ? err.message
            : "This password reset link is invalid or has expired.",
        );
      } finally {
        if (active) setValidating(false);
      }
    }

    void validateToken();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const strength = evaluatePasswordChecks(newPassword);
    if (!strength.requiredMet) {
      setSubmitError(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError("New password and confirmation password do not match.");
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch<{ success: boolean; message: string }>(
        "/auth/reset-password",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            newPassword,
          }),
        },
      );
      setResetDone(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Unable to reset password. The link may have expired.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.authCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <span className={styles.brandEmblem}>EC</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em" }}>
            EXAMCONNECT
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Secure Password Reset
          </div>
        </div>
      </div>

      {validating ? (
        <div className={styles.stackMd}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Verifying your password reset link...
          </p>
          <LoadingSkeleton rows={2} />
        </div>
      ) : resetDone ? (
        <div className={styles.stackMd}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--emerald-50)",
              color: "var(--emerald-700)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconCheckCircle size={24} />
          </div>

          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
              Password updated successfully
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Your password has been securely updated and all previous active sessions
              have been revoked. You can now sign in with your new password.
            </p>
          </div>

          <Link
            href="/"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
          >
            Return to Sign In
          </Link>
        </div>
      ) : !tokenValid ? (
        <div className={styles.stackMd}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--rose-50)",
              color: "var(--rose-700)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconXCircle size={24} />
          </div>

          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
              Reset link invalid or expired
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {tokenError}
            </p>
          </div>

          <div className={styles.stackMd} style={{ gap: 10 }}>
            <Link
              href="/forgot-password"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
            >
              Request a New Reset Link
            </Link>
            <Link
              href="/"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnFull}`}
            >
              <IconArrowLeft size={15} />
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.stackMd}>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--blue-600)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              <IconLock size={14} />
              Set New Password
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
              Create a new password
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Choose a strong password for your ExamConnect account. Completing this
              reset will sign out all existing sessions.
            </p>
          </div>

          {submitError && <AlertBanner tone="error">{submitError}</AlertBanner>}

          <form className={styles.stackMd} onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label htmlFor="new-password" className={styles.label}>
                New Password
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowNewPassword((v) => !v)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirm-password" className={styles.label}>
                Confirm New Password
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
              disabled={submitting}
            >
              {submitting ? "Updating password..." : "Reset Password"}
            </button>
          </form>

          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <Link href="/" className={styles.linkBlue}>
              Back to Sign In
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className={styles.authCentered}>
      <Suspense
        fallback={
          <section className={styles.authCard}>
            <LoadingSkeleton rows={2} />
          </section>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </main>
  );
}
