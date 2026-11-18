"use client";

import React from "react";
import styles from "./ui.module.css";
import { IconAlert, IconCheckCircle, IconFileText, IconXCircle } from "./Icons";

export function AlertBanner({
  tone,
  children,
}: {
  tone: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "error"
      ? styles.alertError
      : tone === "success"
        ? styles.alertSuccess
        : tone === "warning"
          ? styles.alertWarning
          : styles.alertInfo;

  return (
    <div className={`${styles.alert} ${toneClass}`} role="alert">
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        {tone === "error" ? (
          <IconXCircle size={17} />
        ) : tone === "success" ? (
          <IconCheckCircle size={17} />
        ) : (
          <IconAlert size={17} />
        )}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.stackMd} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className={styles.skeleton}
          style={{ height: idx === 0 ? 110 : 140 }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        {icon ?? <IconFileText size={22} />}
      </div>
      <div className={styles.emptyTitle}>{title}</div>
      <p className={styles.emptyDesc}>{description}</p>
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
