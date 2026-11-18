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
import { IconCheckCircle, IconSearch } from "../../../components/Icons";
import { apiFetch, groupExamResults } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import type { ExamResult } from "../../../lib/types";

export default function EligibleExamsPage() {
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
              : "Unable to load eligible exams.",
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

  const eligibleExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groupExamResults(results).filter((g) => {
      if (!g.eligible) return false;
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
    <AppShell user={user} title="Eligible Exams">
      <div className={styles.pageHeader}>
        <div>
          <h1>Eligible Examinations ({eligibleExams.length})</h1>
          <p className={styles.pageSubtitle}>
            Examinations where you meet all active age, category, and qualification
            criteria for at least one post. All posts under each exam are shown for
            full transparency.
          </p>
        </div>
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
            placeholder="Filter eligible exams by name, authority, or post..."
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
      ) : eligibleExams.length === 0 ? (
        <EmptyState
          title="No eligible examinations matched yet"
          description="Make sure your date of birth, category, Class 12 stream, and degree records are filled in your student profile."
          icon={<IconCheckCircle size={22} />}
          action={
            <Link
              href="/student/profile"
              className={`${styles.btn} ${styles.btnBlue}`}
            >
              Update Student Profile
            </Link>
          }
        />
      ) : (
        <div className={styles.stackMd}>
          {eligibleExams.map((grouped) => (
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
