"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../../../components/ui.module.css";
import { AppShell } from "../../../components/AppShell";
import { ExamCard } from "../../../components/ExamCard";
import {
  AlertBanner,
  EmptyState,
  LoadingSkeleton,
} from "../../../components/FeedbackStates";
import { IconBookmark } from "../../../components/Icons";
import { apiFetch, groupExamResults } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import type { ExamResult } from "../../../lib/types";

export default function SavedExamsPage() {
  const { user, checking } = useAuthGuard();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkingId, setBookmarkingId] = useState<number | null>(null);

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
            err instanceof Error ? err.message : "Unable to load saved exams.",
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

  async function handleToggleSave(examId: number, currentlySaved: boolean) {
    try {
      setBookmarkingId(examId);
      await apiFetch(`/student/saved-exams/${examId}`, {
        method: currentlySaved ? "DELETE" : "POST",
      });
      setResults((prev) =>
        prev.map((item) =>
          item.exam.id === examId ? { ...item, saved: !currentlySaved } : item,
        ),
      );
    } finally {
      setBookmarkingId(null);
    }
  }

  const savedExams = useMemo(
    () => groupExamResults(results).filter((g) => g.saved),
    [results],
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
    <AppShell user={user} title="Saved Exams">
      <div className={styles.pageHeader}>
        <div>
          <h1>Saved &amp; Bookmarked Exams ({savedExams.length})</h1>
          <p className={styles.pageSubtitle}>
            Keep track of priority government examinations you want to monitor closely.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <AlertBanner tone="error">{error}</AlertBanner>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : savedExams.length === 0 ? (
        <EmptyState
          title="No bookmarked exams yet"
          description="Click the Save button on any examination card in your dashboard to pin it here."
          icon={<IconBookmark size={22} />}
          action={
            <Link href="/" className={`${styles.btn} ${styles.btnPrimary}`}>
              Browse Examinations
            </Link>
          }
        />
      ) : (
        <div className={styles.stackMd}>
          {savedExams.map((grouped) => (
            <ExamCard
              key={grouped.exam.id}
              grouped={grouped}
              onToggleSave={handleToggleSave}
              savingBookmark={bookmarkingId === grouped.exam.id}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
