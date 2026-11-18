"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import styles from "../../../components/ui.module.css";
import { AppShell } from "../../../components/AppShell";
import { AlertBanner, LoadingSkeleton } from "../../../components/FeedbackStates";
import { IconEye, IconEyeOff, IconLock, IconShield } from "../../../components/Icons";
import {
  evaluatePasswordChecks,
  PasswordStrength,
} from "../../../components/PasswordStrength";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";

export default function AccountSettingsPage() {
  const { user, checking } = useAuthGuard();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const strength = evaluatePasswordChecks(newPassword);
    if (!strength.requiredMet) {
      setFeedback({
        tone: "error",
        text: "New password must be at least 8 characters and include uppercase, lowercase, and a number.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        tone: "error",
        text: "New password and confirmation password do not match.",
      });
      return;
    }

    try {
      setSaving(true);
      const data = await apiFetch<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({
        tone: "success",
        text:
          data.message ||
          "Password updated successfully. All other active sessions were signed out.",
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        text:
          err instanceof Error ? err.message : "Unable to update password.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (checking || !user) {
    return (
      <main className={styles.authCentered}>
        <section className={styles.authCard}>
          <LoadingSkeleton rows={2} />
        </section>
      </main>
    );
  }

  return (
    <AppShell user={user} title="Account Settings">
      <div className={styles.pageHeader}>
        <div>
          <h1>Account Settings &amp; Security</h1>
          <p className={styles.pageSubtitle}>
            Review your account details and update your password securely.
          </p>
        </div>
      </div>

      <div className={styles.stackLg}>
        {/* Account Overview */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Account Overview</h2>
              <p className={styles.cardSubtitle}>
                Authenticated session details and role access level.
              </p>
            </div>
            <GenericBadge label={user.role} tone="info" />
          </div>

          <div className={styles.gridTwo}>
            <div className={styles.postBox}>
              <span className={styles.kpiLabel}>Registered Email</span>
              <strong style={{ fontSize: 15 }}>{user.email}</strong>
            </div>
            <div className={styles.postBox}>
              <span className={styles.kpiLabel}>Session Protection</span>
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                <IconShield size={15} />
                HttpOnly session cookie + Argon2id password hashing
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/student/profile"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            >
              Edit Profile &amp; Education
            </Link>
            <Link
              href="/forgot-password"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            >
              Password Recovery Page
            </Link>
          </div>
        </section>

        {/* Change Password */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconLock size={18} />
                Change Password
              </h2>
              <p className={styles.cardSubtitle}>
                Changing your password rotates your current session and automatically
                revokes all other active sessions across devices.
              </p>
            </div>
          </div>

          {feedback && (
            <div style={{ marginBottom: 16 }}>
              <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            className={styles.stackMd}
            style={{ maxWidth: 480 }}
          >
            <div className={styles.formGroup}>
              <label htmlFor="cur-pass" className={styles.label}>
                Current Password
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="cur-pass"
                  type={showCurrent ? "text" : "password"}
                  className={styles.input}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label="Toggle current password visibility"
                >
                  {showCurrent ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="chg-new-pass" className={styles.label}>
                New Password
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="chg-new-pass"
                  type={showNew ? "text" : "password"}
                  className={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowNew((v) => !v)}
                  aria-label="Toggle new password visibility"
                >
                  {showNew ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="chg-conf-pass" className={styles.label}>
                Confirm New Password
              </label>
              <input
                id="chg-conf-pass"
                type={showNew ? "text" : "password"}
                className={styles.input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={saving}
              >
                {saving ? "Updating password..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
