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
import { IconSearch, IconXCircle } from "../../../components/Icons";
import { apiFetch, groupExamResults } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import type { ExamResult } from "../../../lib/types";

export default function IneligibleExamsPage() {
  const { user, checking } = useAuthGuard();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
            err instanceof Error
              ? err.message
              : "Unable to load examination results.",
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

  const ineligibleExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupExamResults(results).filter((g) => {
      if (g.eligible) return false;
      if (!q) return true;
      return `${g.exam.name} ${g.exam.conductingBody} ${g.posts
        .map((p) => p.post?.name ?? "")
        .join(" ")}`
        .toLowerCase()
        .includes(q);
    });
  }, [results, search]);

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
    <AppShell user={user} title="Ineligible Exams">
      <div className={styles.pageHeader}>
        <div>
          <h1>Ineligible Examinations ({ineligibleExams.length})</h1>
          <p className={styles.pageSubtitle}>
            Examinations you do not currently qualify for, along with the exact
            failed age, stream, or qualification criteria.
          </p>
        </div>
        <Link
          href="/student/profile"
          className={`${styles.btn} ${styles.btnSecondary}`}
        >
          Review Profile &amp; Education
        </Link>
      </div>

      <section className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ineligible exams..."
          />
        </div>
      </section>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <AlertBanner tone="error">{error}</AlertBanner>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : ineligibleExams.length === 0 ? (
        <EmptyState
          title="No ineligible exams found"
          description="You qualify for all currently evaluated examinations matching your filter."
          icon={<IconXCircle size={22} />}
        />
      ) : (
        <div className={styles.stackMd}>
          {ineligibleExams.map((grouped) => (
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
