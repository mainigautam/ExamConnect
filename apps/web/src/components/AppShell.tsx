"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import styles from "./ui.module.css";
import {
  IconActivity,
  IconBell,
  IconBookmark,
  IconBuilding,
  IconCalendar,
  IconCheckCircle,
  IconDashboard,
  IconFileText,
  IconLogOut,
  IconMenu,
  IconSettings,
  IconShield,
  IconUser,
  IconUsers,
  IconX,
  IconXCircle,
} from "./Icons";
import { apiFetch } from "../lib/api";
import type { LoggedInUser } from "../lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

export function AppShell({
  user,
  title,
  onLogout,
  children,
}: {
  user: LoggedInUser;
  title: string;
  onLogout?: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function fetchUnread() {
      try {
        const data = await apiFetch<{ unreadCount?: number; notifications?: Array<{ isRead: boolean }> }>(
          "/student/notifications",
        );
        if (!active) return;
        const count =
          typeof data.unreadCount === "number"
            ? data.unreadCount
            : (data.notifications ?? []).filter((n) => !n.isRead).length;
        setUnreadCount(count);
      } catch {
        // Silent fail on badge polling
      }
    }
    void fetchUnread();
    return () => {
      active = false;
    };
  }, [pathname]);

  async function handleSignOut() {
    if (onLogout) {
      await onLogout();
      return;
    }
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  const studentNav: NavItem[] = [
    { href: "/", label: "Dashboard", icon: <IconDashboard size={17} /> },
    {
      href: "/student/eligible-exams",
      label: "Eligible Exams",
      icon: <IconCheckCircle size={17} />,
    },
    {
      href: "/student/ineligible-exams",
      label: "Ineligible Exams",
      icon: <IconXCircle size={17} />,
    },
    {
      href: "/student/deadlines",
      label: "Deadlines",
      icon: <IconCalendar size={17} />,
    },
    {
      href: "/student/saved",
      label: "Saved Exams",
      icon: <IconBookmark size={17} />,
    },
    {
      href: "/student/notifications",
      label: "Notifications",
      icon: <IconBell size={17} />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  const accountNav: NavItem[] = [
    {
      href: "/student/profile",
      label: "Profile & Education",
      icon: <IconUser size={17} />,
    },
    {
      href: "/student/settings",
      label: "Account Settings",
      icon: <IconSettings size={17} />,
    },
  ];

  const adminNav: NavItem[] =
    user.role === "ADMIN"
      ? [
          { href: "/admin", label: "Admin Overview", icon: <IconShield size={17} /> },
          {
            href: "/admin/exams",
            label: "Manage Exams",
            icon: <IconBuilding size={17} />,
          },
          {
            href: "/admin/sources",
            label: "Official Sources",
            icon: <IconFileText size={17} />,
          },
          {
            href: "/admin/students",
            label: "Students",
            icon: <IconUsers size={17} />,
          },
          {
            href: "/admin/notifications",
            label: "Broadcast & Alerts",
            icon: <IconBell size={17} />,
          },
          {
            href: "/admin/health",
            label: "Verification & Health",
            icon: <IconActivity size={17} />,
          },
        ]
      : [];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={styles.shell}>
      {drawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}
        aria-label="Primary navigation"
      >
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.brandMark} onClick={() => setDrawerOpen(false)}>
            <span className={styles.brandEmblem}>EC</span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>EXAMCONNECT</span>
              <span className={styles.brandSub}>Govt. Exam Platform</span>
            </span>
          </Link>

          <button
            type="button"
            className={styles.closeDrawerBtn}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
          >
            <IconX size={20} />
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <div className={styles.navSectionLabel}>Student Portal</div>
            {studentNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${
                  isActive(item.href) ? styles.navItemActive : ""
                }`}
                onClick={() => setDrawerOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </Link>
            ))}
          </div>

          <div className={styles.navSection}>
            <div className={styles.navSectionLabel}>Account</div>
            {accountNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${
                  isActive(item.href) ? styles.navItemActive : ""
                }`}
                onClick={() => setDrawerOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {adminNav.length > 0 && (
            <div className={styles.navSection}>
              <div className={styles.navSectionLabel}>Administration</div>
              {adminNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${
                    isActive(item.href) ? styles.navItemActive : ""
                  }`}
                  onClick={() => setDrawerOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userChip}>
            <span className={styles.userChipEmail} title={user.email}>
              {user.email}
            </span>
            <span className={styles.userChipRole}>{user.role}</span>
          </div>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={handleSignOut}
          >
            <IconLogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className={styles.mainColumn}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <IconMenu size={20} />
            </button>
            <div className={styles.pageTitle}>{title}</div>
          </div>

          <div className={styles.topbarRight}>
            <Link
              href="/student/notifications"
              className={styles.iconLinkBtn}
              aria-label="Notifications"
              title="Notifications"
            >
              <IconBell size={18} />
              {unreadCount > 0 && <span className={styles.iconDot} />}
            </Link>
            <Link
              href="/student/profile"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
            >
              <IconUser size={15} />
              <span>Profile</span>
            </Link>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
