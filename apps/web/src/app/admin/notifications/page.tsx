"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../../../components/ui.module.css";
import { AdminGuardShell } from "../../../components/AdminGuardShell";
import { AlertBanner, LoadingSkeleton } from "../../../components/FeedbackStates";
import { IconBell } from "../../../components/Icons";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch, formatDateTime } from "../../../lib/api";
import type { StudentNotification } from "../../../lib/types";

function AdminNotificationsContent() {
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function loadNotifications() {
    try {
      setLoading(true);
      const data = await apiFetch<{
        notifications: StudentNotification[];
        total: number;
      }>("/admin/notifications");
      setNotifications(data.notifications ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to load notifications.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function handleBroadcast(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      setSending(true);
      const data = await apiFetch<{ sentCount: number }>(
        "/admin/notifications/broadcast",
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            message: message.trim(),
            type: "ANNOUNCEMENT",
          }),
        },
      );
      setTitle("");
      setMessage("");
      setFeedback({
        tone: "success",
        text: `Announcement delivered to ${data.sentCount} active student(s).`,
      });
      await loadNotifications();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to send broadcast.",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleRunReminders() {
    setFeedback(null);
    try {
      setRunningReminders(true);
      const data = await apiFetch<{ createdCount: number }>(
        "/admin/notifications/run-reminders",
        { method: "POST" },
      );
      setFeedback({
        tone: "success",
        text: `Deadline reminder job completed: ${data.createdCount} new alert(s) created (duplicates skipped, expired cycles ignored).`,
      });
      await loadNotifications();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to run reminder job.",
      });
    } finally {
      setRunningReminders(false);
    }
  }

  return (
    <div className={styles.stackLg}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Notification &amp; Reminder Management</h1>
          <p className={styles.pageSubtitle}>
            Broadcast verified examination announcements and trigger 7-day / 3-day /
            1-day closing reminder checks.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleRunReminders}
          disabled={runningReminders}
        >
          <IconBell size={15} />
          {runningReminders ? "Running checks..." : "Run Deadline Reminders Now"}
        </button>
      </div>

      {feedback && <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Broadcast Announcement to All Students</h2>
        </div>

        <form onSubmit={handleBroadcast} className={styles.stackMd}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Announcement Title *</label>
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SSC CGL 2026 Official Notice Released"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Message *</label>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide verified notice details and next steps..."
              required
            />
          </div>
          <div>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnBlue}`}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            Recent Notifications Log ({total} total)
          </h2>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User ID</th>
                  <th>Type</th>
                  <th>Title &amp; Message</th>
                  <th>Read</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>#{n.id}</td>
                    <td>#{n.userId}</td>
                    <td>
                      <GenericBadge label={n.type} tone="info" />
                    </td>
                    <td>
                      <strong>{n.title}</strong>
                      <div className={styles.fieldHint}>{n.message}</div>
                    </td>
                    <td>{n.isRead ? "Read" : "Unread"}</td>
                    <td>{formatDateTime(n.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminNotificationsPage() {
  return (
    <AdminGuardShell title="Broadcast & Alerts">
      {() => <AdminNotificationsContent />}
    </AdminGuardShell>
  );
}
