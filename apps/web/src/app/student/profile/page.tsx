"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../../../components/ui.module.css";
import { AppShell } from "../../../components/AppShell";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import {
  AlertBanner,
  EmptyState,
  LoadingSkeleton,
} from "../../../components/FeedbackStates";
import { IconEdit, IconPlus, IconTrash } from "../../../components/Icons";
import { GenericBadge } from "../../../components/StatusBadge";
import { apiFetch } from "../../../lib/api";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import type {
  EducationRecord,
  ProfileCompletion,
  StudentProfile,
} from "../../../lib/types";

type ProfileForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  state: string;
  category: string;
};

type EducationForm = {
  qualification: string;
  courseName: string;
  institutionName: string;
  boardOrUniversity: string;
  passingYear: string;
  percentage: string;
  stream: string;
};

const emptyEducation: EducationForm = {
  qualification: "",
  courseName: "",
  institutionName: "",
  boardOrUniversity: "",
  passingYear: "",
  percentage: "",
  stream: "",
};

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Chandigarh",
  "Puducherry",
];

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function StudentProfilePage() {
  const { user, checking } = useAuthGuard();

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    state: "",
    category: "",
  });
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [educationList, setEducationList] = useState<EducationRecord[]>([]);
  const [eduForm, setEduForm] = useState<EducationForm>(emptyEducation);
  const [editingEduId, setEditingEduId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EducationRecord | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEdu, setSavingEdu] = useState(false);
  const [deletingEdu, setDeletingEdu] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function loadAll() {
    try {
      setLoading(true);
      const [profileRes, eduRes] = await Promise.allSettled([
        apiFetch<{
          profile: StudentProfile;
          profileCompletion?: ProfileCompletion;
        }>("/student/profile"),
        apiFetch<{ education: EducationRecord[] }>("/student/education"),
      ]);

      if (profileRes.status === "fulfilled") {
        const p = profileRes.value.profile;
        setProfileForm({
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          dateOfBirth: toDateInputValue(p.dateOfBirth),
          gender: p.gender ?? "",
          state: p.state ?? "",
          category: p.category ?? "",
        });
        setCompletion(profileRes.value.profileCompletion ?? null);
      }

      if (eduRes.status === "fulfilled") {
        setEducationList(eduRes.value.education ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      void loadAll();
    }
  }, [user]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!profileForm.firstName.trim()) {
      setFeedback({ tone: "error", text: "First name is required." });
      return;
    }

    try {
      setSavingProfile(true);
      const payload = {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim() || undefined,
        dateOfBirth: profileForm.dateOfBirth
          ? `${profileForm.dateOfBirth}T00:00:00.000Z`
          : undefined,
        gender: profileForm.gender || undefined,
        state: profileForm.state || undefined,
        category: profileForm.category || undefined,
      };

      const data = await apiFetch<{
        profile: StudentProfile;
        profileCompletion?: ProfileCompletion;
      }>("/student/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setCompletion(data.profileCompletion ?? null);
      setFeedback({
        tone: "success",
        text: "Personal profile saved successfully. Your exam eligibility has been updated.",
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Unable to save profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveEducation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!eduForm.qualification.trim()) {
      setFeedback({ tone: "error", text: "Qualification is required." });
      return;
    }

    const passingYearNum = eduForm.passingYear.trim()
      ? Number(eduForm.passingYear)
      : undefined;
    const percentageNum = eduForm.percentage.trim()
      ? Number(eduForm.percentage)
      : undefined;

    if (
      passingYearNum !== undefined &&
      (!Number.isInteger(passingYearNum) ||
        passingYearNum < 1950 ||
        passingYearNum > 2035)
    ) {
      setFeedback({
        tone: "error",
        text: "Passing year must be a valid four-digit year.",
      });
      return;
    }

    if (
      percentageNum !== undefined &&
      (Number.isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100)
    ) {
      setFeedback({
        tone: "error",
        text: "Percentage must be between 0 and 100.",
      });
      return;
    }

    const payload = {
      qualification: eduForm.qualification.trim(),
      courseName: eduForm.courseName.trim() || undefined,
      institutionName: eduForm.institutionName.trim() || undefined,
      boardOrUniversity: eduForm.boardOrUniversity.trim() || undefined,
      passingYear: passingYearNum,
      percentage: percentageNum,
      stream: eduForm.stream.trim() || undefined,
    };

    try {
      setSavingEdu(true);

      if (editingEduId !== null) {
        await apiFetch(`/student/education/${editingEduId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setFeedback({
          tone: "success",
          text: "Education record updated successfully.",
        });
      } else {
        await apiFetch("/student/education", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setFeedback({
          tone: "success",
          text: "New education record added without modifying your existing records.",
        });
      }

      setEduForm(emptyEducation);
      setEditingEduId(null);
      await loadAll();
    } catch (err) {
      setFeedback({
        tone: "error",
        text:
          err instanceof Error
            ? err.message
            : "Unable to save education record.",
      });
    } finally {
      setSavingEdu(false);
    }
  }

  function startEditEducation(record: EducationRecord) {
    setEditingEduId(record.id);
    setEduForm({
      qualification: record.qualification ?? "",
      courseName: record.courseName ?? "",
      institutionName: record.institutionName ?? "",
      boardOrUniversity: record.boardOrUniversity ?? "",
      passingYear:
        record.passingYear !== null && record.passingYear !== undefined
          ? String(record.passingYear)
          : "",
      percentage:
        record.percentage !== null && record.percentage !== undefined
          ? String(record.percentage)
          : "",
      stream: record.stream ?? "",
    });
    setFeedback(null);
  }

  async function confirmDeleteEducation() {
    if (!deleteTarget) return;
    try {
      setDeletingEdu(true);
      await apiFetch(`/student/education/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      if (editingEduId === deleteTarget.id) {
        setEditingEduId(null);
        setEduForm(emptyEducation);
      }
      setFeedback({
        tone: "success",
        text: "Education record deleted successfully.",
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        tone: "error",
        text:
          err instanceof Error
            ? err.message
            : "Unable to delete education record.",
      });
    } finally {
      setDeletingEdu(false);
    }
  }

  if (checking || !user) {
    return (
      <main className={styles.authCentered}>
        <section className={styles.authCard}>
          <LoadingSkeleton rows={2} />
        </section>
      </main>
    );
  }

  return (
    <AppShell user={user} title="Profile & Education">
      <div className={styles.pageHeader}>
        <div>
          <h1>Student Profile &amp; Education Records</h1>
          <p className={styles.pageSubtitle}>
            Keep your personal profile and all qualifications (Class 10, Class 12,
            Diploma, Bachelor&apos;s, Master&apos;s) up to date for accurate eligibility checks.
          </p>
        </div>
      </div>

      {feedback && (
        <div style={{ marginBottom: 18 }}>
          <AlertBanner tone={feedback.tone}>{feedback.text}</AlertBanner>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <div className={styles.stackLg}>
          {/* Profile Completion Card */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Profile Completion</h2>
                <p className={styles.cardSubtitle}>
                  Account email: <strong>{user.email}</strong>
                </p>
              </div>
              <GenericBadge
                label={`${completion?.percentage ?? 0}% Complete`}
                tone={
                  (completion?.percentage ?? 0) >= 100
                    ? "success"
                    : (completion?.percentage ?? 0) >= 60
                      ? "info"
                      : "warning"
                }
              />
            </div>

            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${completion?.percentage ?? 0}%` }}
              />
            </div>

            {completion && completion.missingFields.length > 0 && (
              <p className={styles.fieldHint} style={{ marginTop: 8 }}>
                Remaining fields: {completion.missingFields.join(", ")}
              </p>
            )}
          </section>

          {/* Personal Profile Form */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>Personal Information</h2>
                <p className={styles.cardSubtitle}>
                  Date of birth and category directly determine cutoff-date age limits
                  and reservation relaxations.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className={styles.stackMd}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="prof-first" className={styles.label}>
                    First Name *
                  </label>
                  <input
                    id="prof-first"
                    type="text"
                    className={styles.input}
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prof-last" className={styles.label}>
                    Last Name
                  </label>
                  <input
                    id="prof-last"
                    type="text"
                    className={styles.input}
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prof-dob" className={styles.label}>
                    Date of Birth
                  </label>
                  <input
                    id="prof-dob"
                    type="date"
                    className={styles.input}
                    value={profileForm.dateOfBirth}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, dateOfBirth: e.target.value }))
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prof-category" className={styles.label}>
                    Category
                  </label>
                  <select
                    id="prof-category"
                    className={styles.select}
                    value={profileForm.category}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, category: e.target.value }))
                    }
                  >
                    <option value="">Select category</option>
                    <option value="General">General (UR)</option>
                    <option value="OBC">OBC (NCL)</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="EWS">EWS</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prof-gender" className={styles.label}>
                    Gender
                  </label>
                  <select
                    id="prof-gender"
                    className={styles.select}
                    value={profileForm.gender}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, gender: e.target.value }))
                    }
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prof-state" className={styles.label}>
                    State / UT
                  </label>
                  <select
                    id="prof-state"
                    className={styles.select}
                    value={profileForm.state}
                    onChange={(e) =>
                      setProfileForm((p) => ({ ...p, state: e.target.value }))
                    }
                  >
                    <option value="">Select state / UT</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving profile..." : "Save Personal Profile"}
                </button>
              </div>
            </form>
          </section>

          {/* Existing Education Records List */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  Saved Education Records ({educationList.length})
                </h2>
                <p className={styles.cardSubtitle}>
                  You can store multiple qualifications simultaneously (for example,
                  Class 12 Science with Mathematics AND a B.Voc / Bachelor&apos;s degree).
                </p>
              </div>
            </div>

            {educationList.length === 0 ? (
              <EmptyState
                title="No education records added yet"
                description="Add your Class 12 and degree records below so ExamConnect can verify qualification and stream requirements accurately."
              />
            ) : (
              <div className={styles.stackMd}>
                {educationList.map((record) => (
                  <div
                    key={record.id}
                    className={styles.postBox}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className={styles.postTitle}>
                          {record.qualification}
                          {record.courseName ? ` — ${record.courseName}` : ""}
                        </span>
                        {record.stream && (
                          <GenericBadge label={record.stream} tone="info" />
                        )}
                      </div>
                      <div className={styles.postMeta}>
                        {[
                          record.institutionName,
                          record.boardOrUniversity,
                          record.passingYear ? `Passed ${record.passingYear}` : null,
                          record.percentage !== null &&
                          record.percentage !== undefined
                            ? `${record.percentage}%`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "Additional details not specified"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                        onClick={() => startEditEducation(record)}
                      >
                        <IconEdit size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDangerOutline} ${styles.btnSm}`}
                        onClick={() => setDeleteTarget(record)}
                      >
                        <IconTrash size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Add / Edit Education Record Form */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  {editingEduId !== null
                    ? "Edit Education Record"
                    : "Add New Education Record"}
                </h2>
                <p className={styles.cardSubtitle}>
                  Adding a Class 12 record preserves your existing Bachelor&apos;s/Master&apos;s
                  degrees. For SSC CHSL Specified DEO, enter Class 12 with stream
                  &quot;Science with Mathematics&quot;.
                </p>
              </div>
              {editingEduId !== null && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => {
                    setEditingEduId(null);
                    setEduForm(emptyEducation);
                  }}
                >
                  Cancel Editing
                </button>
              )}
            </div>

            <form onSubmit={handleSaveEducation} className={styles.stackMd}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="edu-qual" className={styles.label}>
                    Qualification *
                  </label>
                  <input
                    id="edu-qual"
                    type="text"
                    list="qualification-suggestions"
                    className={styles.input}
                    value={eduForm.qualification}
                    onChange={(e) =>
                      setEduForm((p) => ({ ...p, qualification: e.target.value }))
                    }
                    placeholder="e.g. Class 12, B.Voc, B.Sc, B.Tech, M.Sc"
                    required
                  />
                  <datalist id="qualification-suggestions">
                    <option value="Class 10" />
                    <option value="Class 12" />
                    <option value="Diploma" />
                    <option value="B.Voc" />
                    <option value="B.A." />
                    <option value="B.Sc." />
                    <option value="B.Com." />
                    <option value="B.Tech" />
                    <option value="BCA" />
                    <option value="M.Sc." />
                    <option value="M.A." />
                    <option value="M.Tech" />
                  </datalist>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edu-stream" className={styles.label}>
                    Stream / Subject Combination
                  </label>
                  <input
                    id="edu-stream"
                    type="text"
                    list="stream-suggestions"
                    className={styles.input}
                    value={eduForm.stream}
                    onChange={(e) =>
                      setEduForm((p) => ({ ...p, stream: e.target.value }))
                    }
                    placeholder="e.g. Science with Mathematics, Software Development, Physics"
                  />
                  <datalist id="stream-suggestions">
                    <option value="Science with Mathematics" />
                    <option value="Science (PCB)" />
                    <option value="Commerce" />
                    <option value="Arts / Humanities" />
                    <option value="Software Development" />
                    <option value="Computer Science" />
                    <option value="Physics" />
                    <option value="Chemistry" />
                    <option value="Geology" />
                  </datalist>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edu-course" className={styles.label}>
                    Course / Specialization Name
                  </label>
                  <input
                    id="edu-course"
                    type="text"
                    className={styles.input}
                    value={eduForm.courseName}
                    onChange={(e) =>
                      setEduForm((p) => ({ ...p, courseName: e.target.value }))
                    }
                    placeholder="e.g. Senior Secondary, B.Voc Software Development"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edu-inst" className={styles.label}>
                    School / College / Institution
                  </label>
                  <input
                    id="edu-inst"
                    type="text"
                    className={styles.input}
                    value={eduForm.institutionName}
                    onChange={(e) =>
                      setEduForm((p) => ({
                        ...p,
                        institutionName: e.target.value,
                      }))
                    }
                    placeholder="Institution name"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edu-board" className={styles.label}>
                    Board / University
                  </label>
                  <input
                    id="edu-board"
                    type="text"
                    className={styles.input}
                    value={eduForm.boardOrUniversity}
                    onChange={(e) =>
                      setEduForm((p) => ({
                        ...p,
                        boardOrUniversity: e.target.value,
                      }))
                    }
                    placeholder="e.g. CBSE, University of Delhi"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edu-year" className={styles.label}>
                    Passing Year
                  </label>
                  <input
                    id="edu-year"
                    type="number"
                    min={1950}
                    max={2035}
                    className={styles.input}
                    value={eduForm.passingYear}
                    onChange={(e) =>
                      setEduForm((p) => ({ ...p, passingYear: e.target.value }))
                    }
                    placeholder="e.g. 2024"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="edu-pct" className={styles.label}>
                    Percentage (%)
                  </label>
                  <input
                    id="edu-pct"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className={styles.input}
                    value={eduForm.percentage}
                    onChange={(e) =>
                      setEduForm((p) => ({ ...p, percentage: e.target.value }))
                    }
                    placeholder="e.g. 82.5"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnBlue}`}
                  disabled={savingEdu}
                >
                  <IconPlus size={15} />
                  {savingEdu
                    ? "Saving..."
                    : editingEduId !== null
                      ? "Update Education Record"
                      : "Add Education Record"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Education Record"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.qualification}${
                deleteTarget.stream ? ` (${deleteTarget.stream})` : ""
              }"? Your eligibility will be recalculated immediately.`
            : ""
        }
        confirmLabel="Delete Record"
        destructive
        loading={deletingEdu}
        onConfirm={confirmDeleteEducation}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
