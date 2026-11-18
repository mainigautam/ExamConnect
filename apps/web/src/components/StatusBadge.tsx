"use client";

import styles from "./ui.module.css";
import { IconCheckCircle, IconClock, IconXCircle } from "./Icons";

export function EligibilityBadge({ eligible }: { eligible: boolean }) {
  return (
    <span
      className={`${styles.badge} ${
        eligible ? styles.badgeSuccess : styles.badgeDanger
      }`}
    >
      {eligible ? <IconCheckCircle size={13} /> : <IconXCircle size={13} />}
      {eligible ? "Eligible" : "Not Eligible"}
    </span>
  );
}

export function DeadlineStatusBadge({ status }: { status: string }) {
  const normalized = (status ?? "UNKNOWN").toUpperCase();

  switch (normalized) {
    case "OPEN":
      return (
        <span className={`${styles.badge} ${styles.badgeSuccess}`}>
          <IconClock size={12} />
          Application Open
        </span>
      );
    case "UPCOMING":
      return (
        <span className={`${styles.badge} ${styles.badgeInfo}`}>
          <IconClock size={12} />
          Upcoming
        </span>
      );
    case "NOTIFICATION_AWAITED":
      return (
        <span className={`${styles.badge} ${styles.badgeWarning}`}>
          <IconClock size={12} />
          Notification Awaited
        </span>
      );
    case "CLOSED":
      return (
        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
          Closed
        </span>
      );
    default:
      return (
        <span className={`${styles.badge} ${styles.badgeNeutral}`}>
          {status || "Status Unknown"}
        </span>
      );
  }
}

export function GenericBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? styles.badgeSuccess
      : tone === "danger"
        ? styles.badgeDanger
        : tone === "warning"
          ? styles.badgeWarning
          : tone === "info"
            ? styles.badgeInfo
            : styles.badgeNeutral;

  return <span className={`${styles.badge} ${toneClass}`}>{label}</span>;
}
