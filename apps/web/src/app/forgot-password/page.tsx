"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "../../components/ui.module.css";
import { AlertBanner } from "../../components/FeedbackStates";
import { IconArrowLeft, IconCheckCircle, IconLock } from "../../components/Icons";
import { apiFetch } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch<{ message: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: trimmed }),
        },
      );

      setSubmittedMessage(
        response.message ||
          "If an active account is registered with that email address, a password reset link has been sent.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process password reset request right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.authCentered}>
      <section className={styles.authCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span className={styles.brandEmblem}>EC</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em" }}>
              EXAMCONNECT
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              Account Security &amp; Recovery
            </div>
          </div>
        </div>

        {submittedMessage ? (
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
                Check your email
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {submittedMessage}
              </p>
            </div>

            <AlertBanner tone="info">
              The reset link is single-use and expires in 20 minutes. If you do not
              see the message, check your spam folder or try again later.
            </AlertBanner>

            <div className={styles.stackMd} style={{ gap: 10, marginTop: 4 }}>
              <Link href="/" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}>
                <IconArrowLeft size={16} />
                Back to Sign In
              </Link>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnFull}`}
                onClick={() => {
                  setSubmittedMessage(null);
                  setEmail("");
                }}
              >
                Try another email address
              </button>
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
                Password Recovery
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Enter the email address associated with your ExamConnect account and we
                will send you a secure, time-limited link to reset your password.
              </p>
            </div>

            {error && <AlertBanner tone="error">{error}</AlertBanner>}

            <form className={styles.stackMd} onSubmit={handleSubmit} noValidate>
              <div className={styles.formGroup}>
                <label htmlFor="forgot-email" className={styles.label}>
                  Email Address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
                disabled={loading}
              >
                {loading ? "Sending reset link..." : "Send Password Reset Link"}
              </button>
            </form>

            <div style={{ textAlign: "center", paddingTop: 6 }}>
              <Link
                href="/"
                className={styles.linkBlue}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <IconArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
