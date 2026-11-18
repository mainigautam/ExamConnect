"use client";

import { useEffect, useState } from "react";
import styles from "../../../components/ui.module.css";
import { AdminGuardShell } from "../../../components/AdminGuardShell";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { AlertBanner, LoadingSkeleton } from "../../../components/FeedbackStates";
import { IconSearch } from "../../../components/Icons";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch, formatDate } from "../../../lib/api";

type StudentRow = {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  category: string | null;
  state: string | null;
  educationCount: number;
  profileCompletion: number;
};

function AdminStudentsContent() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<StudentRow | null>(null);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function loadStudents(nextPage = page, nextSearch = search) {
    try {
      setLoading(true);
      const data = await apiFetch<{
        students: StudentRow[];
        pagination: { page: number; totalPages: number; total: number };
      }>(
        `/admin/students?page=${nextPage}&limit=20&search=${encodeURIComponent(
          nextSearch,
        )}`,
      );
      setStudents(data.students ?? []);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to load users.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents(1, search);
  }, [search]);

  async function confirmStatusChange() {
    if (!target) return;
    try {
      setUpdating(true);
      await apiFetch(`/admin/students/${target.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      setFeedback({
        tone: "success",
        text: `User ${target.email} is now ${
          target.isActive ? "inactive (sessions revoked)" : "active"
        }.`,
      });
      setTarget(null);
      await loadStudents(page, search);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to update account.",
      });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className={styles.stackLg}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Student &amp; Account Management ({total})</h1>
          <p className={styles.pageSubtitle}>
            Inspect registered student profile completeness, education records, and
            account active status.
          </p>
        </div>
      </div>

      {feedback && <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>}

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
            placeholder="Search by email, name, or category..."
          />
        </div>
      </section>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Category / State</th>
                  <th>Education</th>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td>
                      <strong>{s.email}</strong>
                      {(s.firstName || s.lastName) && (
                        <div className={styles.fieldHint}>
                          {[s.firstName, s.lastName].filter(Boolean).join(" ")}
                        </div>
                      )}
                    </td>
                    <td>
                      <GenericBadge
                        label={s.role}
                        tone={s.role === "ADMIN" ? "info" : "neutral"}
                      />
                    </td>
                    <td>
                      {[s.category ?? "—", s.state ?? "—"].join(" • ")}
                    </td>
                    <td>{s.educationCount} record(s)</td>
                    <td>{s.profileCompletion}%</td>
                    <td>
                      <GenericBadge
                        label={s.isActive ? "Active" : "Suspended"}
                        tone={s.isActive ? "success" : "danger"}
                      />
                    </td>
                    <td>{formatDate(s.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btn} ${
                          s.isActive
                            ? styles.btnDangerOutline
                            : styles.btnSecondary
                        } ${styles.btnSm}`}
                        onClick={() => setTarget(s)}
                      >
                        {s.isActive ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className={styles.fieldHint}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                disabled={page <= 1}
                onClick={() => loadStudents(page - 1, search)}
              >
                Previous
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                disabled={page >= totalPages}
                onClick={() => loadStudents(page + 1, search)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={target !== null}
        title={target?.isActive ? "Suspend User Account" : "Reactivate User Account"}
        message={
          target?.isActive
            ? `Suspend ${target.email}? All active sessions for this user will be immediately revoked.`
            : `Reactivate ${target?.email} so they can sign in again?`
        }
        confirmLabel={target?.isActive ? "Suspend Account" : "Activate Account"}
        destructive={Boolean(target?.isActive)}
        loading={updating}
        onConfirm={confirmStatusChange}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <AdminGuardShell title="Student Management">
      {() => <AdminStudentsContent />}
    </AdminGuardShell>
  );
}
