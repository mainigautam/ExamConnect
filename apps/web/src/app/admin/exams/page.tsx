"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../../../components/ui.module.css";
import { AdminGuardShell } from "../../../components/AdminGuardShell";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  AlertBanner,
  LoadingSkeleton,
} from "../../../components/FeedbackStates";
import { IconPlus, IconSearch } from "../../../components/Icons";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch } from "../../../lib/api";

type AdminExamRow = {
  id: number;
  name: string;
  conductingBody: string;
  examType: string | null;
  officialWebsite: string | null;
  isArchived: boolean;
  postCount: number;
  ruleCount: number;
  deadlineCount: number;
  eligibleStudentCount: number;
};

function AdminExamsContent() {
  const [exams, setExams] = useState<AdminExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [conductingBody, setConductingBody] = useState("");
  const [examType, setExamType] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<AdminExamRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function loadExams() {
    try {
      setLoading(true);
      const data = await apiFetch<{ exams: AdminExamRow[] }>("/admin/exams");
      setExams(data.exams ?? []);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to load exams.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExams();
  }, []);

  async function handleCreateExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    try {
      setCreating(true);
      await apiFetch("/admin/exams", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          conductingBody: conductingBody.trim(),
          examType: examType.trim() || undefined,
          officialWebsite: officialWebsite.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      setName("");
      setConductingBody("");
      setExamType("");
      setOfficialWebsite("");
      setDescription("");
      setShowCreate(false);
      setFeedback({
        tone: "success",
        text: "Examination created successfully. Open Configure to add posts, eligibility rules, and official sources.",
      });
      await loadExams();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to create exam.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function confirmArchiveToggle() {
    if (!archiveTarget) return;
    try {
      setArchiving(true);
      await apiFetch(`/admin/exams/${archiveTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !archiveTarget.isArchived }),
      });
      setFeedback({
        tone: "success",
        text: archiveTarget.isArchived
          ? `Restored "${archiveTarget.name}" to active catalogue.`
          : `Archived "${archiveTarget.name}". Existing records are preserved.`,
      });
      setArchiveTarget(null);
      await loadExams();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to update archive status.",
      });
    } finally {
      setArchiving(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exams;
    return exams.filter((e) =>
      `${e.name} ${e.conductingBody} ${e.examType ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [exams, search]);

  return (
    <div className={styles.stackLg}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Exam Management ({exams.length})</h1>
          <p className={styles.pageSubtitle}>
            Create, edit, configure, or archive government examinations without
            modifying source code.
          </p>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnBlue}`}
          onClick={() => setShowCreate((v) => !v)}
        >
          <IconPlus size={16} />
          {showCreate ? "Close Form" : "Add New Exam"}
        </button>
      </div>

      {feedback && <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>}

      {showCreate && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Create Government Examination</h2>
          </div>

          <form onSubmit={handleCreateExam} className={styles.stackMd}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ex-name">
                  Examination Name *
                </label>
                <input
                  id="ex-name"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SSC Combined Graduate Level Examination, 2026"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ex-body">
                  Conducting Authority *
                </label>
                <input
                  id="ex-body"
                  className={styles.input}
                  value={conductingBody}
                  onChange={(e) => setConductingBody(e.target.value)}
                  placeholder="e.g. Staff Selection Commission"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ex-type">
                  Exam Category / Level
                </label>
                <input
                  id="ex-type"
                  className={styles.input}
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  placeholder="e.g. Central Government — Graduate Level"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ex-url">
                  Official Website URL
                </label>
                <input
                  id="ex-url"
                  type="url"
                  className={styles.input}
                  value={officialWebsite}
                  onChange={(e) => setOfficialWebsite(e.target.value)}
                  placeholder="https://ssc.gov.in"
                />
              </div>

              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.label} htmlFor="ex-desc">
                  Description
                </label>
                <textarea
                  id="ex-desc"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Official overview of this recruitment examination..."
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create Examination"}
              </button>
            </div>
          </form>
        </section>
      )}

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
            placeholder="Search exams by name or authority..."
          />
        </div>
      </section>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Examination</th>
                <th>Authority</th>
                <th>Posts / Rules</th>
                <th>Qualified Students</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam) => (
                <tr key={exam.id}>
                  <td>#{exam.id}</td>
                  <td>
                    <strong>{exam.name}</strong>
                    {exam.examType && (
                      <div className={styles.fieldHint}>{exam.examType}</div>
                    )}
                  </td>
                  <td>{exam.conductingBody}</td>
                  <td>
                    {exam.postCount} post(s) • {exam.ruleCount} rule(s)
                  </td>
                  <td>{exam.eligibleStudentCount}</td>
                  <td>
                    <GenericBadge
                      label={exam.isArchived ? "Archived" : "Active"}
                      tone={exam.isArchived ? "neutral" : "success"}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                      >
                        Posts, Rules &amp; Dates
                      </Link>
                      <button
                        type="button"
                        className={`${styles.btn} ${
                          exam.isArchived
                            ? styles.btnSecondary
                            : styles.btnDangerOutline
                        } ${styles.btnSm}`}
                        onClick={() => setArchiveTarget(exam)}
                      >
                        {exam.isArchived ? "Restore" : "Archive"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        title={archiveTarget?.isArchived ? "Restore Examination" : "Archive Examination"}
        message={
          archiveTarget?.isArchived
            ? `Restore "${archiveTarget.name}" so it appears in the student dashboard again?`
            : `Archive "${archiveTarget?.name}"? It will be hidden from the student portal while preserving all database records.`
        }
        confirmLabel={archiveTarget?.isArchived ? "Restore" : "Archive Exam"}
        destructive={!archiveTarget?.isArchived}
        loading={archiving}
        onConfirm={confirmArchiveToggle}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

export default function AdminExamsPage() {
  return (
    <AdminGuardShell title="Manage Exams">
      {() => <AdminExamsContent />}
    </AdminGuardShell>
  );
}
