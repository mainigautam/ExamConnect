import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

const REMINDER_WINDOWS = [
  { days: 1, type: "DEADLINE_1D", label: "closes within 24 hours" },
  { days: 3, type: "DEADLINE_3D", label: "closes within 3 days" },
  { days: 7, type: "DEADLINE_7D", label: "closes within 7 days" },
] as const;

export async function generateDeadlineNotifications() {
  const now = Temporal.Now.instant();

  const [deadlines, exams, profiles, existingNotifications] = await Promise.all([
    db.orm.public.ApplicationDeadline.all(),
    db.orm.public.Exam.all(),
    db.orm.public.StudentProfile.all(),
    db.orm.public.StudentNotification.all(),
  ]);

  const examById = new Map(exams.map((exam) => [exam.id, exam]));

  const existingKeys = new Set(
    existingNotifications
      .filter((n) => n.deadlineId !== null)
      .map((n) => `${n.userId}:${n.deadlineId}:${n.type}`),
  );

  let createdCount = 0;

  for (const deadline of deadlines) {
    if (!deadline.applicationEnd) {
      continue;
    }

    const exam = examById.get(deadline.examId);
    if (!exam || exam.isArchived) {
      continue;
    }

    if (deadline.status.trim().toUpperCase() === "CLOSED") {
      continue;
    }

    const applicationEnd = Temporal.Instant.from(
      deadline.applicationEnd.toString(),
    );

    if (Temporal.Instant.compare(applicationEnd, now) <= 0) {
      continue;
    }

    if (deadline.applicationStart) {
      const applicationStart = Temporal.Instant.from(
        deadline.applicationStart.toString(),
      );
      if (Temporal.Instant.compare(now, applicationStart) < 0) {
        continue;
      }
    }

    const msRemaining =
      applicationEnd.epochMilliseconds - now.epochMilliseconds;
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);

    const matchedWindow = REMINDER_WINDOWS.find(
      (window) => daysRemaining <= window.days,
    );

    if (!matchedWindow) {
      continue;
    }

    const formattedEndDate = new Date(
      applicationEnd.epochMilliseconds,
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    for (const profile of profiles) {
      const dedupeKey = `${profile.userId}:${deadline.id}:${matchedWindow.type}`;
      if (existingKeys.has(dedupeKey)) {
        continue;
      }

      await db.orm.public.StudentNotification.create({
        userId: profile.userId,
        type: matchedWindow.type,
        title: `Application deadline reminder: ${exam.name}`,
        message: `Applications for ${exam.name} (${exam.conductingBody}) ${matchedWindow.label} on ${formattedEndDate}. Check your eligibility and submit before closing.`,
        deadlineId: deadline.id,
        examId: deadline.examId,
        postId: deadline.postId,
        isRead: false,
      });

      existingKeys.add(dedupeKey);
      createdCount += 1;
    }
  }

  return {
    createdCount,
  };
}
