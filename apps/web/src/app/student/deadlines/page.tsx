"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../../../components/ui.module.css";
import { AppShell } from "../../../components/AppShell";
import {
  AlertBanner,
  EmptyState,
  LoadingSkeleton,
} from "../../../components/FeedbackStates";
import { IconCalendar, IconExternalLink } from "../../../components/Icons";
import {
  DeadlineStatusBadge,
  EligibilityBadge,
} from "../../../components/StatusBadge";
import {
  apiFetch,
  daysUntil,
  formatDate,
  groupExamResults,
} from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import type { ExamResult } from "../../../lib/types";

export default function DeadlinesPage() {
  const { user, checking } = useAuthGuard();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await apiFetch<{ results: ExamResult[] }>(
          "/student/eligible-exams",
        );
        if (active) setResults(data.results ?? []);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load deadlines.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  const deadlineRows = useMemo(() => {
    const grouped = groupExamResults(results);
    const items = grouped.flatMap((g) =>
      g.deadlines.map((d) => ({
        exam: g.exam,
        eligible: g.eligible,
        deadline: d,
        daysLeft: daysUntil(d.applicationEnd),
      })),
    );

    const filtered = items.filter(
      (item) => statusFilter === "ALL" || item.deadline.status === statusFilter,
    );

    return filtered.sort((a, b) => {
      const weight = (s: string) =>
        s === "OPEN"
          ? 0
          : s === "UPCOMING"
            ? 1
            : s === "NOTIFICATION_AWAITED"
              ? 2
              : 3;
      const wDiff = weight(a.deadline.status) - weight(b.deadline.status);
      if (wDiff !== 0) return wDiff;
      const aTime = a.deadline.applicationEnd
        ? new Date(a.deadline.applicationEnd).getTime()
        : Infinity;
      const bTime = b.deadline.applicationEnd
        ? new Date(b.deadline.applicationEnd).getTime()
        : Infinity;
      return aTime - bTime;
    });
  }, [results, statusFilter]);

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
    <AppShell user={user} title="Application Deadlines">
      <div className={styles.pageHeader}>
        <div>
          <h1>Application Deadlines &amp; Exam Calendar</h1>
          <p className={styles.pageSubtitle}>
            Track verified opening dates, closing dates, and announced exam schedules.
            Expired cycles are accurately marked as Closed.
          </p>
        </div>
      </div>

      <section className={styles.filterBar}>
        <select
          className={styles.selectInput}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by deadline status"
        >
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Application Open</option>
          <option value="UPCOMING">Upcoming</option>
          <option value="NOTIFICATION_AWAITED">Notification Awaited</option>
          <option value="CLOSED">Closed</option>
        </select>
      </section>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <AlertBanner tone="error">{error}</AlertBanner>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : deadlineRows.length === 0 ? (
        <EmptyState
          title="No application deadlines match this filter"
          description="Check back once new official recruitment notifications are published or select All Statuses."
          icon={<IconCalendar size={22} />}
        />
      ) : (
        <div className={styles.stackMd}>
          {deadlineRows.map(({ exam, eligible, deadline, daysLeft }) => (
            <article key={`${exam.id}-${deadline.id}`} className={styles.card}>
              <div className={styles.examCardTop}>
                <div>
                  <div className={styles.examAuthority}>
                    {exam.conductingBody}
                  </div>
                  <h2 className={styles.cardTitle} style={{ fontSize: 18 }}>
                    {exam.name}
                  </h2>
                  <div className={styles.examMetaRow}>
                    <DeadlineStatusBadge status={deadline.status} />
                    <EligibilityBadge eligible={eligible} />
                    {deadline.status === "OPEN" &&
                      daysLeft !== null &&
                      daysLeft >= 0 && (
                        <span
                          className={`${styles.badge} ${
                            daysLeft <= 3 ? styles.badgeDanger : styles.badgeWarning
                          }`}
                        >
                          {daysLeft === 0
                            ? "Closes today"
                            : `${daysLeft} day(s) remaining`}
                        </span>
                      )}
                  </div>
                </div>

                <div className={styles.examTopActions}>
                  <Link
                    href={`/student/exam/${exam.id}`}
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  >
                    Exam Details
                  </Link>
                  {deadline.applicationUrl && deadline.status === "OPEN" && (
                    <a
                      href={deadline.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
                    >
                      Apply Now
                      <IconExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              <div className={styles.deadlineMeta} style={{ marginTop: 14 }}>
                <span>
                  Opening Date: <strong>{formatDate(deadline.applicationStart)}</strong>
                </span>
                <span>
                  Closing Date: <strong>{formatDate(deadline.applicationEnd)}</strong>
                </span>
                <span>
                  Examination Date: <strong>{formatDate(deadline.examDate)}</strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
