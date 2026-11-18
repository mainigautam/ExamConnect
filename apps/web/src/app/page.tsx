"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import styles from "../components/ui.module.css";
import { AppShell } from "../components/AppShell";
import { ExamCard } from "../components/ExamCard";
import {
  AlertBanner,
  EmptyState,
  LoadingSkeleton,
} from "../components/FeedbackStates";
import {
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconSearch,
  IconShield,
  IconUser,
} from "../components/Icons";
import {
  evaluatePasswordChecks,
  PasswordStrength,
} from "../components/PasswordStrength";
import { apiFetch, groupExamResults } from "../lib/api";
import type {
  ExamResult,
  LoggedInUser,
  ProfileCompletion,
} from "../lib/types";

export default function HomePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<LoggedInUser | null>(null);

  // Auth form state
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Dashboard state
  const [results, setResults] = useState<ExamResult[]>([]);
  const [profileMissing, setProfileMissing] = useState(false);
  const [profileCompletion, setProfileCompletion] =
    useState<ProfileCompletion | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [bookmarkingId, setBookmarkingId] = useState<number | null>(null);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [authorityFilter, setAuthorityFilter] = useState("ALL");
  const [qualificationFilter, setQualificationFilter] = useState("ALL");
  const [eligibilityFilter, setEligibilityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"deadline" | "name">("deadline");

  async function loadDashboardData() {
    try {
      setLoadingDashboard(true);
      setDashboardError(null);
      setProfileMissing(false);

      const [profileRes, eligibilityRes] = await Promise.allSettled([
        apiFetch<{ profileCompletion?: ProfileCompletion }>("/student/profile"),
        apiFetch<{ results: ExamResult[] }>("/student/eligible-exams"),
      ]);

      if (profileRes.status === "fulfilled") {
        setProfileCompletion(profileRes.value.profileCompletion ?? null);
      } else {
        setProfileCompletion({
          percentage: 0,
          missingFields: ["Profile details", "Education records"],
        });
      }

      if (eligibilityRes.status === "fulfilled") {
        setResults(eligibilityRes.value.results ?? []);
      } else {
        const err = eligibilityRes.reason;
        if (err && typeof err === "object" && "status" in err && err.status === 404) {
          setProfileMissing(true);
          setResults([]);
        } else if (err && typeof err === "object" && "status" in err && err.status === 401) {
          setUser(null);
          setResults([]);
        } else {
          setDashboardError(
            err instanceof Error
              ? err.message
              : "Unable to load examination eligibility data.",
          );
        }
      }
    } finally {
      setLoadingDashboard(false);
    }
  }

  useEffect(() => {
    async function checkSession() {
      try {
        const data = await apiFetch<{ user: LoggedInUser }>("/auth/me");
        setUser(data.user);
        await loadDashboardData();
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    }
    void checkSession();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    try {
      setAuthLoading(true);
      const data = await apiFetch<{ user: LoggedInUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setUser(data.user);
      setPassword("");
      await loadDashboardData();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Invalid email or password.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const strength = evaluatePasswordChecks(password);
    if (!strength.requiredMet) {
      setAuthError(
        "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
      );
      return;
    }

    try {
      setAuthLoading(true);
      await apiFetch<{ user: LoggedInUser }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });

      setAuthSuccess("Account created successfully. You can now sign in.");
      setAuthTab("login");
      setPassword("");
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Unable to create account.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setResults([]);
      setProfileCompletion(null);
    }
  }

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
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : "Failed to update saved exam.",
      );
    } finally {
      setBookmarkingId(null);
    }
  }

  const groupedExams = useMemo(() => groupExamResults(results), [results]);

  const authorities = useMemo(
    () =>
      Array.from(new Set(groupedExams.map((g) => g.exam.conductingBody))).sort(),
    [groupedExams],
  );

  const metrics = useMemo(() => {
    const total = groupedExams.length;
    const eligible = groupedExams.filter((g) => g.eligible).length;
    const ineligible = total - eligible;
    const open = groupedExams.filter((g) => g.primaryStatus === "OPEN").length;
    const upcoming = groupedExams.filter(
      (g) =>
        g.primaryStatus === "UPCOMING" ||
        g.primaryStatus === "NOTIFICATION_AWAITED",
    ).length;
    const closed = groupedExams.filter(
      (g) => g.primaryStatus === "CLOSED",
    ).length;

    return { total, eligible, ineligible, open, upcoming, closed };
  }, [groupedExams]);

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = groupedExams.filter((g) => {
      if (q) {
        const haystack = [
          g.exam.name,
          g.exam.conductingBody,
          g.exam.examType ?? "",
          ...g.posts.map((p) => p.post?.name ?? ""),
          ...g.posts.map((p) => p.post?.department ?? ""),
          ...g.posts.map((p) => p.post?.qualification ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      if (
        authorityFilter !== "ALL" &&
        g.exam.conductingBody !== authorityFilter
      ) {
        return false;
      }

      if (eligibilityFilter === "ELIGIBLE" && !g.eligible) return false;
      if (eligibilityFilter === "INELIGIBLE" && g.eligible) return false;

      if (statusFilter !== "ALL" && g.primaryStatus !== statusFilter) {
        return false;
      }

      if (qualificationFilter !== "ALL") {
        const qualBlob = [
          g.exam.examType ?? "",
          ...g.posts.map((p) => p.post?.qualification ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (
          qualificationFilter === "10TH" &&
          !/(10th|matric|class 10)/i.test(qualBlob)
        ) {
          return false;
        }
        if (
          qualificationFilter === "12TH" &&
          !/(12th|10\+2|class 12|higher secondary|senior secondary)/i.test(
            qualBlob,
          )
        ) {
          return false;
        }
        if (
          qualificationFilter === "GRADUATE" &&
          !/(bachelor|graduate|graduation|degree)/i.test(qualBlob)
        ) {
          return false;
        }
        if (
          qualificationFilter === "POSTGRADUATE" &&
          !/(master|m\.?sc|post ?graduate)/i.test(qualBlob)
        ) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name") {
        return a.exam.name.localeCompare(b.exam.name);
      }
      // Sort OPEN exams first, then by earliest deadline
      const statusWeight = (s: string) =>
        s === "OPEN" ? 0 : s === "UPCOMING" ? 1 : s === "NOTIFICATION_AWAITED" ? 2 : 3;
      const diffStatus = statusWeight(a.primaryStatus) - statusWeight(b.primaryStatus);
      if (diffStatus !== 0) return diffStatus;

      if (a.earliestEndTimestamp && b.earliestEndTimestamp) {
        return a.earliestEndTimestamp - b.earliestEndTimestamp;
      }
      if (a.earliestEndTimestamp) return -1;
      if (b.earliestEndTimestamp) return 1;
      return a.exam.name.localeCompare(b.exam.name);
    });
  }, [
    groupedExams,
    searchQuery,
    authorityFilter,
    qualificationFilter,
    eligibilityFilter,
    statusFilter,
    sortBy,
  ]);

  if (!authChecked) {
    return (
      <main className={styles.authCentered}>
        <section className={styles.authCard}>
          <LoadingSkeleton rows={2} />
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.authLayout}>
        <section className={styles.authHero}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={styles.brandEmblem}>EC</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.14em" }}>
                EXAMCONNECT
              </div>
              <div style={{ fontSize: 12, color: "#93a7c8" }}>
                Government Exam Eligibility &amp; Recruitment Platform
              </div>
            </div>
          </div>

          <div>
            <h1 className={styles.authHeroTitle}>
              Verified eligibility intelligence for Indian government exams.
            </h1>
            <p className={styles.authHeroSubtitle}>
              Match your education records, date of birth, and reservation category
              against official UPSC, SSC, Banking, and Railway recruitment notices —
              with transparent rule-by-rule explanations.
            </p>

            <ul className={styles.authFeatureList}>
              <li className={styles.authFeatureItem}>
                <span className={styles.authFeatureIcon}>
                  <IconCheckCircle size={18} />
                </span>
                <span>
                  Exact cutoff-date age checks with official category-wise limits
                </span>
              </li>
              <li className={styles.authFeatureItem}>
                <span className={styles.authFeatureIcon}>
                  <IconCheckCircle size={18} />
                </span>
                <span>
                  Post-level qualification verification across multiple degrees &amp;
                  Class 12 streams
                </span>
              </li>
              <li className={styles.authFeatureItem}>
                <span className={styles.authFeatureIcon}>
                  <IconShield size={18} />
                </span>
                <span>
                  Direct links to official recruitment notifications and verified
                  application deadlines
                </span>
              </li>
            </ul>
          </div>

          <div style={{ fontSize: 12.5, color: "#8ba1c4" }}>
            ExamConnect Student &amp; Administration Portal
          </div>
        </section>

        <section className={styles.authPanel}>
          <div className={styles.authCard}>
            <div className={styles.authTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={authTab === "login"}
                className={`${styles.authTab} ${
                  authTab === "login" ? styles.authTabActive : ""
                }`}
                onClick={() => {
                  setAuthTab("login");
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authTab === "register"}
                className={`${styles.authTab} ${
                  authTab === "register" ? styles.authTabActive : ""
                }`}
                onClick={() => {
                  setAuthTab("register");
                  setAuthError(null);
                  setAuthSuccess(null);
                }}
              >
                Create Account
              </button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                {authTab === "login"
                  ? "Sign in to ExamConnect"
                  : "Create your student account"}
              </h2>
              <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
                {authTab === "login"
                  ? "Enter your registered email and password to view your eligible exams."
                  : "Register as a student to track your profile and government exam eligibility."}
              </p>
            </div>

            <div className={styles.stackMd}>
              {authSuccess && <AlertBanner tone="success">{authSuccess}</AlertBanner>}
              {authError && <AlertBanner tone="error">{authError}</AlertBanner>}

              {authTab === "login" ? (
                <form className={styles.stackMd} onSubmit={handleLogin}>
                  <div className={styles.formGroup}>
                    <label htmlFor="login-email" className={styles.label}>
                      Email Address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <label htmlFor="login-password" className={styles.label}>
                        Password
                      </label>
                      <Link href="/forgot-password" className={styles.linkBlue}>
                        Forgot password?
                      </Link>
                    </div>
                    <div className={styles.passwordWrap}>
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <IconEyeOff size={17} />
                        ) : (
                          <IconEye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
                    disabled={authLoading}
                  >
                    {authLoading ? "Signing in..." : "Sign In"}
                  </button>
                </form>
              ) : (
                <form className={styles.stackMd} onSubmit={handleRegister}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="reg-first" className={styles.label}>
                        First Name
                      </label>
                      <input
                        id="reg-first"
                        type="text"
                        className={styles.input}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="reg-last" className={styles.label}>
                        Last Name
                      </label>
                      <input
                        id="reg-last"
                        type="text"
                        className={styles.input}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="reg-email" className={styles.label}>
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="reg-password" className={styles.label}>
                      Password
                    </label>
                    <div className={styles.passwordWrap}>
                      <input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <IconEyeOff size={17} />
                        ) : (
                          <IconEye size={17} />
                        )}
                      </button>
                    </div>
                    <PasswordStrength password={password} />
                  </div>

                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.btnBlue} ${styles.btnFull}`}
                    disabled={authLoading}
                  >
                    {authLoading ? "Creating account..." : "Create Student Account"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <AppShell user={user} title="Student Dashboard" onLogout={handleLogout}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Government Exam Eligibility Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Live eligibility evaluation based on your date of birth, category, and
            verified education records.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            href="/student/profile"
            className={`${styles.btn} ${styles.btnSecondary}`}
          >
            <IconUser size={16} />
            Update Profile &amp; Education
          </Link>
        </div>
      </div>

      {profileCompletion && profileCompletion.percentage < 100 && (
        <div style={{ marginBottom: 20 }}>
          <AlertBanner tone="warning">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                width: "100%",
              }}
            >
              <strong>
                Profile completion: {profileCompletion.percentage}%
              </strong>
              <span>
                Missing: {profileCompletion.missingFields.join(", ")}. Complete your
                profile for accurate age and qualification matching.{" "}
                <Link href="/student/profile" className={styles.linkBlue}>
                  Complete Profile
                </Link>
              </span>
            </div>
          </AlertBanner>
        </div>
      )}

      {/* KPI Metrics Grid */}
      <section className={styles.kpiGrid} aria-label="Dashboard summary metrics">
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Exams</span>
          <span className={styles.kpiValue}>{metrics.total}</span>
          <span className={styles.kpiHint}>Active catalogue</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Eligible</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueSuccess}`}>
            {metrics.eligible}
          </span>
          <span className={styles.kpiHint}>1+ qualifying post</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Not Eligible</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueDanger}`}>
            {metrics.ineligible}
          </span>
          <span className={styles.kpiHint}>Check exact reasons</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Open Now</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueBlue}`}>
            {metrics.open}
          </span>
          <span className={styles.kpiHint}>Accepting applications</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Upcoming / Awaited</span>
          <span className={styles.kpiValue}>{metrics.upcoming}</span>
          <span className={styles.kpiHint}>Scheduled / awaited</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Closed</span>
          <span className={styles.kpiValue}>{metrics.closed}</span>
          <span className={styles.kpiHint}>Cycle closed</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Profile</span>
          <span className={styles.kpiValue}>
            {profileCompletion ? `${profileCompletion.percentage}%` : "—"}
          </span>
          <div className={styles.progressBar} style={{ marginTop: 4 }}>
            <div
              className={styles.progressFill}
              style={{ width: `${profileCompletion?.percentage ?? 0}%` }}
            />
          </div>
        </div>
      </section>

      {dashboardError && (
        <div style={{ marginBottom: 18 }}>
          <AlertBanner tone="error">{dashboardError}</AlertBanner>
        </div>
      )}

      {profileMissing ? (
        <EmptyState
          title="Complete your student profile first"
          description="Add your date of birth, category, and education records so ExamConnect can automatically calculate your eligibility across all government exams."
          icon={<IconUser size={24} />}
          action={
            <Link
              href="/student/profile"
              className={`${styles.btn} ${styles.btnBlue}`}
            >
              Create Student Profile
            </Link>
          }
        />
      ) : (
        <>
          {/* Search & Filters */}
          <section className={styles.filterBar} aria-label="Filter examinations">
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>
                <IconSearch size={16} />
              </span>
              <input
                type="search"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exam, post, authority, or qualification..."
              />
            </div>

            <select
              className={styles.selectInput}
              value={authorityFilter}
              onChange={(e) => setAuthorityFilter(e.target.value)}
              aria-label="Filter by conducting authority"
            >
              <option value="ALL">All Authorities</option>
              {authorities.map((auth) => (
                <option key={auth} value={auth}>
                  {auth}
                </option>
              ))}
            </select>

            <select
              className={styles.selectInput}
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value)}
              aria-label="Filter by qualification level"
            >
              <option value="ALL">All Qualifications</option>
              <option value="10TH">Class 10 / Matriculation</option>
              <option value="12TH">Class 12 / 10+2</option>
              <option value="GRADUATE">Bachelor&apos;s / Graduate</option>
              <option value="POSTGRADUATE">Master&apos;s / Post Graduate</option>
            </select>

            <select
              className={styles.selectInput}
              value={eligibilityFilter}
              onChange={(e) => setEligibilityFilter(e.target.value)}
              aria-label="Filter by eligibility"
            >
              <option value="ALL">All Eligibility</option>
              <option value="ELIGIBLE">Eligible Only</option>
              <option value="INELIGIBLE">Not Eligible Only</option>
            </select>

            <select
              className={styles.selectInput}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by application status"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Application Open</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="NOTIFICATION_AWAITED">Notification Awaited</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              className={styles.selectInput}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "deadline" | "name")}
              aria-label="Sort examinations"
            >
              <option value="deadline">Sort: Last Date / Status</option>
              <option value="name">Sort: Exam Name (A–Z)</option>
            </select>
          </section>

          {loadingDashboard ? (
            <LoadingSkeleton rows={4} />
          ) : filteredExams.length === 0 ? (
            <EmptyState
              title="No matching examinations found"
              description="Try clearing your search or adjusting the authority, qualification, or status filters."
              action={
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => {
                    setSearchQuery("");
                    setAuthorityFilter("ALL");
                    setQualificationFilter("ALL");
                    setEligibilityFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                >
                  Reset Filters
                </button>
              }
            />
          ) : (
            <div className={styles.stackMd}>
              {filteredExams.map((grouped) => (
                <ExamCard
                  key={grouped.exam.id}
                  grouped={grouped}
                  onToggleSave={handleToggleSave}
                  savingBookmark={bookmarkingId === grouped.exam.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
