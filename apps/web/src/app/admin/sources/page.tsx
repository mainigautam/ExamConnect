"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../../../components/ui.module.css";
import { AdminGuardShell } from "../../../components/AdminGuardShell";
import { AlertBanner, LoadingSkeleton } from "../../../components/FeedbackStates";
import { IconCheckCircle, IconExternalLink, IconPlus } from "../../../components/Icons";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch, formatDate } from "../../../lib/api";

type SourceRow = {
  id: number;
  organization: string;
  notificationTitle: string;
  notificationDate: string | null;
  officialUrl: string;
  notificationIdentifier: string | null;
  dateImported: string;
  lastVerifiedAt: string | null;
};

function AdminSourcesContent() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const [organization, setOrganization] = useState("");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");
  const [notificationIdentifier, setNotificationIdentifier] = useState("");
  const [notificationDate, setNotificationDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSources() {
    try {
      setLoading(true);
      const data = await apiFetch<{ notificationSources: SourceRow[] }>(
        "/admin/notification-sources",
      );
      setSources(data.notificationSources ?? []);
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to load sources.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSources();
  }, []);

  async function handleCreateSource(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    try {
      setSaving(true);
      await apiFetch("/admin/notification-sources", {
        method: "POST",
        body: JSON.stringify({
          organization: organization.trim(),
          notificationTitle: notificationTitle.trim(),
          officialUrl: officialUrl.trim(),
          notificationIdentifier: notificationIdentifier.trim() || undefined,
          notificationDate: notificationDate
            ? `${notificationDate}T00:00:00.000Z`
            : undefined,
          lastVerifiedAt: new Date().toISOString(),
        }),
      });
      setOrganization("");
      setNotificationTitle("");
      setOfficialUrl("");
      setNotificationIdentifier("");
      setNotificationDate("");
      setFeedback({
        tone: "success",
        text: "Official notification source saved and marked verified.",
      });
      await loadSources();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to add source.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify(id: number) {
    try {
      await apiFetch(`/admin/notification-sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ markVerified: true }),
      });
      setFeedback({
        tone: "success",
        text: `Source #${id} verified with current timestamp.`,
      });
      await loadSources();
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Failed to verify source.",
      });
    }
  }

  return (
    <div className={styles.stackLg}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Official Notification Sources ({sources.length})</h1>
          <p className={styles.pageSubtitle}>
            Register and verify official government recruitment PDFs and portals
            (ssc.gov.in, upsc.gov.in, ibps.in, sbi.co.in, RRB portals).
          </p>
        </div>
      </div>

      {feedback && <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Register Official Notification Source</h2>
        </div>

        <form onSubmit={handleCreateSource} className={styles.stackMd}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Recruiting Organization *</label>
              <input
                className={styles.input}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Staff Selection Commission"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Notification Title *</label>
              <input
                className={styles.input}
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="e.g. Notice of Combined Graduate Level Examination, 2026"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Official PDF / Portal URL *</label>
              <input
                type="url"
                className={styles.input}
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                placeholder="https://ssc.gov.in/..."
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Notice Reference / Identifier</label>
              <input
                className={styles.input}
                value={notificationIdentifier}
                onChange={(e) => setNotificationIdentifier(e.target.value)}
                placeholder="e.g. F.No. HQ-PPII03/1/2026"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Publication Date</label>
              <input
                type="date"
                className={styles.input}
                value={notificationDate}
                onChange={(e) => setNotificationDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnBlue}`}
              disabled={saving}
            >
              <IconPlus size={15} />
              {saving ? "Saving..." : "Save Official Source"}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Organization</th>
                <th>Notification Title</th>
                <th>Published</th>
                <th>Verification</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.id}>
                  <td>#{src.id}</td>
                  <td>{src.organization}</td>
                  <td>
                    <strong>{src.notificationTitle}</strong>
                    {src.notificationIdentifier && (
                      <div className={styles.fieldHint}>
                        Ref: {src.notificationIdentifier}
                      </div>
                    )}
                  </td>
                  <td>{formatDate(src.notificationDate)}</td>
                  <td>
                    {src.lastVerifiedAt ? (
                      <GenericBadge
                        label={`Verified ${formatDate(src.lastVerifiedAt)}`}
                        tone="success"
                      />
                    ) : (
                      <GenericBadge label="Unverified" tone="warning" />
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a
                        href={src.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                      >
                        Open
                        <IconExternalLink size={13} />
                      </a>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
                        onClick={() => handleVerify(src.id)}
                      >
                        <IconCheckCircle size={13} />
                        Verify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminSourcesPage() {
  return (
    <AdminGuardShell title="Official Notification Sources">
      {() => <AdminSourcesContent />}
    </AdminGuardShell>
  );
}
