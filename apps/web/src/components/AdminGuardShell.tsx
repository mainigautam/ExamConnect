"use client";

import React from "react";
import Link from "next/link";
import styles from "./ui.module.css";
import { AppShell } from "./AppShell";
import { EmptyState, LoadingSkeleton } from "./FeedbackStates";
import { IconShield } from "./Icons";
import { useAuthGuard } from "../lib/useAuthGuard";
import type { LoggedInUser } from "../lib/types";

export function AdminGuardShell({
  title,
  children,
}: {
  title: string;
  children: (user: LoggedInUser) => React.ReactNode;
}) {
  const { user, checking, forbidden } = useAuthGuard("ADMIN");

  if (checking || !user) {
    return (
      <main className={styles.authCentered}>
        <section className={styles.authCard}>
          <LoadingSkeleton rows={2} />
        </section>
      </main>
    );
  }

  if (forbidden) {
    return (
      <AppShell user={user} title="Access Denied">
        <EmptyState
          title="Administrator access required"
          description="Your account does not have ADMIN permissions. Administrative tools are restricted to authorized platform administrators."
          icon={<IconShield size={24} />}
          action={
            <Link href="/" className={`${styles.btn} ${styles.btnPrimary}`}>
              Return to Student Dashboard
            </Link>
          }
        />
      </AppShell>
    );
  }

  return <AppShell user={user} title={title}>{children(user)}</AppShell>;
}
