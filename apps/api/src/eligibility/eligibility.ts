import type { FastifyInstance } from "fastify";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import { requireAuth } from "../auth/guards.js";
import {
  evaluateEligibility,
  type EligibilityRule,
  type EligibilityStudent,
  type EvaluatedRuleDetail,
} from "./evaluator.js";
import { createNewEligibleExamNotification } from "../notifications/notification-service.js";

export type EligibilitySource = {
  id: number;
  organization: string;
  notificationTitle: string;
  notificationDate: string | null;
  officialUrl: string;
  notificationIdentifier: string | null;
  dateImported: string;
  lastVerifiedAt: string | null;
};

export type EligibilityDeadline = {
  id: number;
  postId: number | null;
  applicationUrl: string | null;
  status: string;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
};

export type ExamEvaluationItem = {
  exam: {
    id: number;
    name: string;
    conductingBody: string;
    examType: string | null;
    description: string | null;
    officialWebsite: string | null;
  };
  post: {
    id: number;
    name: string;
    code: string | null;
    department: string | null;
    vacancies: number | null;
    qualification: string | null;
    description: string | null;
  } | null;
  eligible: boolean;
  saved: boolean;
  reasons: string[];
  ruleEvaluations: EvaluatedRuleDetail[];
  sources: EligibilitySource[];
  deadlines: EligibilityDeadline[];
};

export function calculateApplicationStatus(
  applicationStart: string | null,
  applicationEnd: string | null,
  storedStatus?: string | null,
): string {
  const now = new Date();

  // Expired application windows must NEVER show as OPEN
  if (applicationEnd) {
    const end = new Date(applicationEnd);
    if (!Number.isNaN(end.getTime()) && now > end) {
      return "CLOSED";
    }
  }

  if (applicationStart) {
    const start = new Date(applicationStart);
    if (!Number.isNaN(start.getTime()) && now < start) {
      return "UPCOMING";
    }
  }

  if (applicationStart || applicationEnd) {
    if (storedStatus && storedStatus.toUpperCase() === "CLOSED") {
      return "CLOSED";
    }
    return "OPEN";
  }

  if (storedStatus) {
    const normalized = storedStatus.trim().toUpperCase();
    if (
      normalized === "NOTIFICATION_AWAITED" ||
      normalized === "UPCOMING" ||
      normalized === "CLOSED"
    ) {
      return normalized;
    }
  }

  return "UNKNOWN";
}

function getRuleExpectedValue(
  rule: {
    ruleType: string;
    description: string | null;
  },
  versionExpectedValue: string,
): string {
  if (
    rule.ruleType === "AGE" &&
    rule.description &&
    rule.description.includes(":")
  ) {
    return rule.description.trim();
  }

  return versionExpectedValue;
}

function isDevelopmentTestSource(
  source: Pick<EligibilitySource, "notificationTitle">,
): boolean {
  return /development\s+test|test\s+notification/i.test(
    source.notificationTitle,
  );
}

function formatNotificationSource(source: {
  id: number;
  organization: string;
  notificationTitle: string;
  notificationDate: { toString(): string } | null;
  officialUrl: string;
  notificationIdentifier: string | null;
  dateImported: { toString(): string };
  lastVerifiedAt: { toString(): string } | null;
}): EligibilitySource {
  return {
    id: source.id,
    organization: source.organization,
    notificationTitle: source.notificationTitle,
    notificationDate: source.notificationDate
      ? source.notificationDate.toString()
      : null,
    officialUrl: source.officialUrl,
    notificationIdentifier: source.notificationIdentifier,
    dateImported: source.dateImported.toString(),
    lastVerifiedAt: source.lastVerifiedAt
      ? source.lastVerifiedAt.toString()
      : null,
  };
}

function isVersionCurrentlyEffective(
  version: {
    status: string;
    effectiveFrom: { toString(): string } | null;
    effectiveTo: { toString(): string } | null;
  },
  now: Temporal.Instant,
): boolean {
  if (version.status !== "ACTIVE") {
    return false;
  }

  if (version.effectiveFrom) {
    try {
      const from = Temporal.Instant.from(version.effectiveFrom.toString());
      if (Temporal.Instant.compare(now, from) < 0) {
        return false;
      }
    } catch {
      // Ignore malformed dates
    }
  }

  if (version.effectiveTo) {
    try {
      const to = Temporal.Instant.from(version.effectiveTo.toString());
      if (Temporal.Instant.compare(now, to) > 0) {
        return false;
      }
    } catch {
      // Ignore malformed dates
    }
  }

  return true;
}

function formatDeadline(deadline: {
  id: number;
  postId: number | null;
  applicationUrl: string | null;
  status: string;
  applicationStart: { toString(): string } | null;
  applicationEnd: { toString(): string } | null;
  examDate: { toString(): string } | null;
}): EligibilityDeadline {
  const applicationStart = deadline.applicationStart
    ? deadline.applicationStart.toString()
    : null;
  const applicationEnd = deadline.applicationEnd
    ? deadline.applicationEnd.toString()
    : null;

  return {
    id: deadline.id,
    postId: deadline.postId,
    applicationUrl: deadline.applicationUrl,
    status: calculateApplicationStatus(
      applicationStart,
      applicationEnd,
      deadline.status,
    ),
    applicationStart,
    applicationEnd,
    examDate: deadline.examDate ? deadline.examDate.toString() : null,
  };
}

/**
 * Shared batch evaluator used by student dashboard, single-exam details, and admin analytics.
 */
export async function computeStudentEligibility(
  userId: number,
  options?: {
    onlyExamId?: number;
    createNotifications?: boolean;
    includeArchived?: boolean;
  },
): Promise<{
  profileFound: boolean;
  results: ExamEvaluationItem[];
}> {
  const profile = await db.orm.public.StudentProfile
    .where({ userId })
    .first();

  if (!profile) {
    return { profileFound: false, results: [] };
  }

  // Batch-load all required tables in parallel to eliminate N+1 database queries
  const [
    educationRecords,
    allExams,
    allPosts,
    allRules,
    allRuleVersions,
    allDeadlines,
    allSources,
    savedExams,
  ] = await Promise.all([
    db.orm.public.EducationRecord.where({ studentProfileId: profile.id }).all(),
    options?.onlyExamId
      ? db.orm.public.Exam.where({ id: options.onlyExamId }).all()
      : db.orm.public.Exam.all(),
    options?.onlyExamId
      ? db.orm.public.Post.where({ examId: options.onlyExamId }).all()
      : db.orm.public.Post.all(),
    options?.onlyExamId
      ? db.orm.public.EligibilityRule.where({ examId: options.onlyExamId }).all()
      : db.orm.public.EligibilityRule.all(),
    db.orm.public.EligibilityRuleVersion.all(),
    options?.onlyExamId
      ? db.orm.public.ApplicationDeadline.where({ examId: options.onlyExamId }).all()
      : db.orm.public.ApplicationDeadline.all(),
    db.orm.public.NotificationSource.all(),
    db.orm.public.SavedExam.where({ userId }).all(),
  ]);

  const savedExamIds = new Set(savedExams.map((item) => item.examId));

  const student: EligibilityStudent = {
    profile: {
      category: profile.category,
      state: profile.state,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toString() : null,
    },
    education: educationRecords.map((education) => ({
      qualification: education.qualification,
      courseName: education.courseName,
      percentage: education.percentage,
      passingYear: education.passingYear,
      stream: education.stream,
    })),
  };

  // Index records in memory for O(1) lookups
  const now = Temporal.Now.instant();

  const sourceById = new Map(allSources.map((s) => [s.id, formatNotificationSource(s)]));
  const sourcesByOrg = new Map<string, EligibilitySource[]>();
  for (const s of allSources) {
    const key = s.organization.trim().toLowerCase();
    const list = sourcesByOrg.get(key) ?? [];
    list.push(formatNotificationSource(s));
    sourcesByOrg.set(key, list);
  }

  const activeVersionByRuleId = new Map<number, (typeof allRuleVersions)[number]>();
  for (const version of allRuleVersions) {
    if (!isVersionCurrentlyEffective(version, now)) {
      continue;
    }
    const existing = activeVersionByRuleId.get(version.eligibilityRuleId);
    if (!existing || version.versionNumber > existing.versionNumber) {
      activeVersionByRuleId.set(version.eligibilityRuleId, version);
    }
  }

  const postsByExamId = new Map<number, typeof allPosts>();
  for (const post of allPosts) {
    const list = postsByExamId.get(post.examId) ?? [];
    list.push(post);
    postsByExamId.set(post.examId, list);
  }

  const rulesByExamId = new Map<number, typeof allRules>();
  for (const rule of allRules) {
    const list = rulesByExamId.get(rule.examId) ?? [];
    list.push(rule);
    rulesByExamId.set(rule.examId, list);
  }

  const deadlinesByExamId = new Map<number, typeof allDeadlines>();
  for (const deadline of allDeadlines) {
    const list = deadlinesByExamId.get(deadline.examId) ?? [];
    list.push(deadline);
    deadlinesByExamId.set(deadline.examId, list);
  }

  const results: ExamEvaluationItem[] = [];

  for (const exam of allExams) {
    if (!options?.includeArchived && exam.isArchived) {
      continue;
    }

    const normalizedExamName = exam.name.trim().toLowerCase();
    const normalizedExamOrg = exam.conductingBody.trim().toLowerCase();
    const isSaved = savedExamIds.has(exam.id);

    const examAllRules = rulesByExamId.get(exam.id) ?? [];
    const examLevelRules = examAllRules.filter((r) => r.postId === null);

    const activeExamRules: EligibilityRule[] = [];
    const linkedExamSources: EligibilitySource[] = [];

    for (const rule of examLevelRules) {
      const version = activeVersionByRuleId.get(rule.id);
      if (!version) continue;

      activeExamRules.push({
        name: rule.name,
        conditionField: version.conditionField,
        operator: version.operator,
        expectedValue: getRuleExpectedValue(
          { ruleType: rule.ruleType, description: rule.description },
          version.expectedValue,
        ),
        logicGroup: version.logicGroup,
        logicOperator: version.logicOperator,
        scope: "EXAM",
        ruleType: rule.ruleType,
      });

      if (version.notificationSourceId) {
        const source = sourceById.get(version.notificationSourceId);
        if (source) {
          linkedExamSources.push(source);
        }
      }
    }

    const orgSources = sourcesByOrg.get(normalizedExamOrg) ?? [];
    const matchingExamSources = orgSources.filter((source) => {
      const title = source.notificationTitle.trim().toLowerCase();
      return title.includes(normalizedExamName) && !isDevelopmentTestSource(source);
    });

    const relevantLinkedExamSources = linkedExamSources.filter((source) => {
      const srcOrg = source.organization.trim().toLowerCase();
      return srcOrg === normalizedExamOrg && !isDevelopmentTestSource(source);
    });

    const uniqueExamSources = Array.from(
      new Map(
        [...relevantLinkedExamSources, ...matchingExamSources].map((s) => [s.id, s]),
      ).values(),
    );

    const examPosts = postsByExamId.get(exam.id) ?? [];
    const examDeadlines = deadlinesByExamId.get(exam.id) ?? [];

    if (examPosts.length === 0) {
      const evaluation = evaluateEligibility(student, activeExamRules);
      const formattedDeadlines = examDeadlines.map(formatDeadline);

      results.push({
        exam: {
          id: exam.id,
          name: exam.name,
          conductingBody: exam.conductingBody,
          examType: exam.examType,
          description: exam.description,
          officialWebsite: exam.officialWebsite,
        },
        post: null,
        eligible: evaluation.eligible,
        saved: isSaved,
        reasons: evaluation.reasons,
        ruleEvaluations: evaluation.ruleEvaluations,
        sources: uniqueExamSources,
        deadlines: formattedDeadlines,
      });

      if (options?.createNotifications && evaluation.eligible) {
        await createNewEligibleExamNotification({
          userId,
          examId: exam.id,
          postId: null,
          examName: exam.name,
          postName: null,
        });
      }

      continue;
    }

    for (const post of examPosts) {
      const postLevelRules = examAllRules.filter((r) => r.postId === post.id);
      const activePostRules: EligibilityRule[] = [];
      const linkedPostSources: EligibilitySource[] = [];

      for (const rule of postLevelRules) {
        const version = activeVersionByRuleId.get(rule.id);
        if (!version) continue;

        activePostRules.push({
          name: rule.name,
          conditionField: version.conditionField,
          operator: version.operator,
          expectedValue: getRuleExpectedValue(
            { ruleType: rule.ruleType, description: rule.description },
            version.expectedValue,
          ),
          logicGroup: version.logicGroup,
          logicOperator: version.logicOperator,
          scope: "POST",
          ruleType: rule.ruleType,
        });

        if (version.notificationSourceId) {
          const source = sourceById.get(version.notificationSourceId);
          if (source) {
            linkedPostSources.push(source);
          }
        }
      }

      if (post.qualification) {
        activePostRules.push({
          name: `Qualification (${post.name})`,
          conditionField: "qualificationRequirement",
          operator: "REQUIRED",
          expectedValue: post.qualification,
          qualificationRequirement: post.qualification,
          logicGroup: null,
          logicOperator: "AND",
          scope: "POST",
          ruleType: "QUALIFICATION",
        });
      }

      const combinedRules = [...activeExamRules, ...activePostRules];
      const evaluation = evaluateEligibility(student, combinedRules);

      let postDeadlines = examDeadlines.filter((d) => d.postId === post.id);
      if (postDeadlines.length === 0) {
        postDeadlines = examDeadlines.filter((d) => d.postId === null);
      }
      const formattedDeadlines = postDeadlines.map(formatDeadline);

      const relevantPostSources = linkedPostSources.filter((source) => {
        const srcOrg = source.organization.trim().toLowerCase();
        return srcOrg === normalizedExamOrg && !isDevelopmentTestSource(source);
      });

      const uniqueSources = Array.from(
        new Map(
          [...uniqueExamSources, ...relevantPostSources].map((s) => [s.id, s]),
        ).values(),
      );

      results.push({
        exam: {
          id: exam.id,
          name: exam.name,
          conductingBody: exam.conductingBody,
          examType: exam.examType,
          description: exam.description,
          officialWebsite: exam.officialWebsite,
        },
        post: {
          id: post.id,
          name: post.name,
          code: post.code,
          department: post.department,
          vacancies: post.vacancies,
          qualification: post.qualification,
          description: post.description,
        },
        eligible: evaluation.eligible,
        saved: isSaved,
        reasons: evaluation.reasons,
        ruleEvaluations: evaluation.ruleEvaluations,
        sources: uniqueSources,
        deadlines: formattedDeadlines,
      });

      if (options?.createNotifications && evaluation.eligible) {
        await createNewEligibleExamNotification({
          userId,
          examId: exam.id,
          postId: post.id,
          examName: exam.name,
          postName: post.name,
        });
      }
    }
  }

  return { profileFound: true, results };
}

export async function eligibilityRoute(app: FastifyInstance) {
  app.get(
    "/student/eligible-exams",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { profileFound, results } = await computeStudentEligibility(
        request.authUser!.id,
        { createNotifications: true },
      );

      if (!profileFound) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found. Complete your profile to check eligibility.",
        });
      }

      return reply.send({ results });
    },
  );

  app.get(
    "/student/exams/:examId/eligibility",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const examId = Number((request.params as { examId: string }).examId);

      if (!Number.isInteger(examId) || examId <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Exam ID must be a positive integer.",
        });
      }

      const { profileFound, results } = await computeStudentEligibility(
        request.authUser!.id,
        { onlyExamId: examId, createNotifications: false },
      );

      if (!profileFound) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      if (results.length === 0) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      return reply.send({ results });
    },
  );
}
