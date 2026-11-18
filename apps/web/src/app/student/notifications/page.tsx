"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../../../components/ui.module.css";
import { AppShell } from "../../../components/AppShell";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  AlertBanner,
  EmptyState,
  LoadingSkeleton,
} from "../../../components/FeedbackStates";
import {
  IconBell,
  IconCheckCircle,
  IconTrash,
} from "../../../components/Icons";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch, formatDateTime } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import type { StudentNotification } from "../../../lib/types";

function notificationTypeTone(type: string) {
  if (type.startsWith("DEADLINE")) return "warning" as const;
  if (type === "SECURITY_ALERT") return "danger" as const;
  if (type === "NEW_ELIGIBLE_EXAM") return "success" as const;
  return "info" as const;
}

export default function NotificationsPage() {
  const { user, checking } = useAuthGuard();
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [markingAll, setMarkingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentNotification | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  async function loadNotifications() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{ notifications: StudentNotification[] }>(
        "/student/notifications",
      );
      setNotifications(data.notifications ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) void loadNotifications();
  }, [user]);

  async function handleMarkRead(id: number) {
    try {
      await apiFetch(`/student/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to mark notification as read.",
      );
    }
  }

  async function handleMarkAllRead() {
    try {
      setMarkingAll(true);
      await apiFetch("/student/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to mark all as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiFetch(`/student/notifications/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setNotifications((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete notification.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const visible = useMemo(
    () =>
      filter === "UNREAD"
        ? notifications.filter((n) => !n.isRead)
        : notifications,
    [notifications, filter],
  );

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
    <AppShell user={user} title="Notifications">
      <div className={styles.pageHeader}>
        <div>
          <h1>Notifications &amp; Deadline Alerts</h1>
          <p className={styles.pageSubtitle}>
            Eligibility updates, new government exam releases, security alerts, and
            7-day / 3-day / 1-day application closing reminders.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
          >
            <IconCheckCircle size={15} />
            {markingAll ? "Marking..." : `Mark All Read (${unreadCount})`}
          </button>
        </div>
      </div>

      <section className={styles.filterBar}>
        <button
          type="button"
          className={`${styles.btn} ${
            filter === "ALL" ? styles.btnPrimary : styles.btnSecondary
          } ${styles.btnSm}`}
          onClick={() => setFilter("ALL")}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          className={`${styles.btn} ${
            filter === "UNREAD" ? styles.btnPrimary : styles.btnSecondary
          } ${styles.btnSm}`}
          onClick={() => setFilter("UNREAD")}
        >
          Unread ({unreadCount})
        </button>
      </section>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <AlertBanner tone="error">{error}</AlertBanner>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={
            filter === "UNREAD"
              ? "All caught up"
              : "No notifications yet"
          }
          description={
            filter === "UNREAD"
              ? "You have no unread notifications."
              : "Alerts for eligible exams, rule changes, and upcoming application deadlines will appear here."
          }
          icon={<IconBell size={22} />}
        />
      ) : (
        <div className={styles.stackMd}>
          {visible.map((item) => (
            <article
              key={item.id}
              className={styles.card}
              style={{
                borderLeft: item.isRead
                  ? "3px solid var(--border-subtle)"
                  : "4px solid var(--blue-600)",
                background: item.isRead ? "var(--bg-surface)" : "#fbfdff",
              }}
            >
              <div className={styles.postHeader}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <GenericBadge
                      label={item.type.replace(/_/g, " ")}
                      tone={notificationTypeTone(item.type)}
                    />
                    {!item.isRead && (
                      <GenericBadge label="Unread" tone="info" />
                    )}
                    <span className={styles.fieldHint}>
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <h2 className={styles.cardTitle} style={{ fontSize: 16 }}>
                    {item.title}
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    {item.message}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {item.examId && (
                    <Link
                      href={`/student/exam/${item.examId}`}
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                    >
                      View Exam
                    </Link>
                  )}
                  {!item.isRead && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      onClick={() => handleMarkRead(item.id)}
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDangerOutline} ${styles.btnSm}`}
                    onClick={() => setDeleteTarget(item)}
                    aria-label="Delete notification"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Notification"
        message="Remove this notification from your inbox? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
