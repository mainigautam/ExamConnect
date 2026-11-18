"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../../components/ui.module.css";
import { AdminGuardShell } from "../../components/AdminGuardShell";
import { AlertBanner, LoadingSkeleton } from "../../components/FeedbackStates";
import { GenericBadge } from "../../components/StatusBadge";
import { apiFetch } from "../../lib/api";

type AdminDashboardResponse = {
  metrics: {
    totalExams: number;
    activeExams: number;
    archivedExams: number;
    totalPosts: number;
    totalRules: number;
    totalStudents: number;
    completedProfiles: number;
    totalSources: number;
    verifiedSources: number;
    unverifiedSources: number;
    openDeadlines: number;
    upcomingDeadlines: number;
    closedDeadlines: number;
    totalNotifications: number;
  };
  examSummaries: Array<{
    id: number;
    name: string;
    conductingBody: string;
    examType: string | null;
    isArchived: boolean;
    postCount: number;
    ruleCount: number;
    eligibleStudentCount: number;
  }>;
};

function AdminDashboardContent() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await apiFetch<AdminDashboardResponse>("/admin/dashboard");
        if (active) setData(res);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load admin overview.",
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
  }, []);

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <AlertBanner tone="error">{error}</AlertBanner>;
  if (!data) return null;

  const { metrics, examSummaries } = data;

  return (
    <div className={styles.stackLg}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Administration Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Manage government examinations, verified official sources, category-wise
            eligibility rules, deadlines, and student qualification metrics.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/admin/exams"
            className={`${styles.btn} ${styles.btnBlue}`}
          >
            Manage Exams
          </Link>
          <Link
            href="/admin/sources"
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            Official Sources
          </Link>
        </div>
      </div>

      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Exams</span>
          <span className={styles.kpiValue}>{metrics.activeExams}</span>
          <span className={styles.kpiHint}>{metrics.archivedExams} archived</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Posts</span>
          <span className={styles.kpiValue}>{metrics.totalPosts}</span>
          <span className={styles.kpiHint}>{metrics.totalRules} eligibility rules</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Students</span>
          <span className={styles.kpiValue}>{metrics.totalStudents}</span>
          <span className={styles.kpiHint}>
            {metrics.completedProfiles} profiles created
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Open Windows</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueSuccess}`}>
            {metrics.openDeadlines}
          </span>
          <span className={styles.kpiHint}>
            {metrics.upcomingDeadlines} upcoming • {metrics.closedDeadlines} closed
          </span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Verified Sources</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueBlue}`}>
            {metrics.verifiedSources}/{metrics.totalSources}
          </span>
          <span className={styles.kpiHint}>
            {metrics.unverifiedSources} pending verification
          </span>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              Exam Qualification Reach &amp; Configuration
            </h2>
            <p className={styles.cardSubtitle}>
              Real-time count of registered students currently qualifying for each
              examination.
            </p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Examination</th>
                <th>Authority</th>
                <th>Posts</th>
                <th>Rules</th>
                <th>Qualified Students</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {examSummaries.map((exam) => (
                <tr key={exam.id}>
                  <td>
                    <strong>{exam.name}</strong>
                    {exam.examType && (
                      <div className={styles.fieldHint}>{exam.examType}</div>
                    )}
                  </td>
                  <td>{exam.conductingBody}</td>
                  <td>{exam.postCount}</td>
                  <td>{exam.ruleCount}</td>
                  <td>
                    <GenericBadge
                      label={`${exam.eligibleStudentCount} student(s)`}
                      tone={exam.eligibleStudentCount > 0 ? "success" : "neutral"}
                    />
                  </td>
                  <td>
                    <GenericBadge
                      label={exam.isArchived ? "Archived" : "Active"}
                      tone={exam.isArchived ? "neutral" : "info"}
                    />
                  </td>
                  <td>
                    <Link
                      href={`/admin/exams/${exam.id}`}
                      className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                    >
                      Configure
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminGuardShell title="Admin Dashboard">
      {() => <AdminDashboardContent />}
    </AdminGuardShell>
  );
}
