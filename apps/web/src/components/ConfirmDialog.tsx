"use client";

import styles from "./ui.module.css";
import { IconAlert } from "./Icons";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className={styles.modalCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              color: destructive ? "var(--rose-600)" : "var(--blue-600)",
              display: "inline-flex",
            }}
          >
            <IconAlert size={20} />
          </span>
          <h2 id="confirm-dialog-title" className={styles.cardTitle}>
            {title}
          </h2>
        </div>

        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {message}
        </p>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${
              destructive ? styles.btnDanger : styles.btnPrimary
            }`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
