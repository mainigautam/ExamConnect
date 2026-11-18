import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { db } from "@examconnect/database";

import { requireAuth } from "./auth/guards.js";

const dateOfBirthSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return !Number.isNaN(Date.parse(`${val}T00:00:00.000Z`));
      }
      return !Number.isNaN(Date.parse(val));
    },
    { message: "Date of birth must be a valid date (YYYY-MM-DD or ISO datetime)." },
  );

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  dateOfBirth: dateOfBirthSchema.optional().nullable(),
  gender: z.string().trim().max(50).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  category: z.string().trim().max(50).optional().nullable(),
});

const educationSchema = z.object({
  qualification: z.string().trim().min(1, "Qualification is required.").max(100),
  courseName: z.string().trim().max(150).optional().nullable(),
  institutionName: z.string().trim().max(200).optional().nullable(),
  boardOrUniversity: z.string().trim().max(200).optional().nullable(),
  passingYear: z.number().int().min(1900).max(2100).optional().nullable(),
  percentage: z.number().min(0).max(100).optional().nullable(),
  stream: z.string().trim().max(100).optional().nullable(),
});

const educationUpdateSchema = educationSchema.partial();

export function computeProfileCompletion(
  profile: {
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: unknown;
    gender: string | null;
    state: string | null;
    category: string | null;
  } | null,
  educationCount: number,
): { percentage: number; missingFields: string[] } {
  if (!profile) {
    return {
      percentage: 0,
      missingFields: [
        "First name",
        "Date of birth",
        "Gender",
        "State",
        "Category",
        "Education record",
      ],
    };
  }

  const checks: Array<{ label: string; filled: boolean }> = [
    { label: "First name", filled: Boolean(profile.firstName?.trim()) },
    { label: "Last name", filled: Boolean(profile.lastName?.trim()) },
    { label: "Date of birth", filled: Boolean(profile.dateOfBirth) },
    { label: "Gender", filled: Boolean(profile.gender?.trim()) },
    { label: "State", filled: Boolean(profile.state?.trim()) },
    { label: "Category", filled: Boolean(profile.category?.trim()) },
    { label: "Education record", filled: educationCount > 0 },
  ];

  const completed = checks.filter((c) => c.filled).length;
  const missingFields = checks.filter((c) => !c.filled).map((c) => c.label);

  return {
    percentage: Math.round((completed / checks.length) * 100),
    missingFields,
  };
}

function parseDobToInstant(value: string | null | undefined): Temporal.Instant | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return Temporal.Instant.from(`${trimmed}T00:00:00.000Z`);
  }
  return Temporal.Instant.from(trimmed);
}

export async function studentRoute(app: FastifyInstance) {
  /*
   * GET STUDENT PROFILE (includes email & completion indicator)
   */
  app.get(
    "/student/profile",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;
      const profile = await db.orm.public.StudentProfile
        .where({ userId })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile has not been created yet.",
          email: request.authUser!.email,
          profileCompletion: computeProfileCompletion(null, 0),
        });
      }

      const educationRecords = await db.orm.public.EducationRecord
        .where({ studentProfileId: profile.id })
        .all();

      return reply.send({
        profile: {
          ...profile,
          email: request.authUser!.email,
        },
        profileCompletion: computeProfileCompletion(profile, educationRecords.length),
      });
    },
  );

  /*
   * CREATE / UPDATE STUDENT PROFILE
   */
  app.put(
    "/student/profile",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = profileSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message:
            parsed.error.issues[0]?.message ?? "Invalid student profile data.",
        });
      }

      const userId = request.authUser!.id;

      const existingProfile = await db.orm.public.StudentProfile
        .where({ userId })
        .first();

      const data = {
        userId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName ?? undefined,
        dateOfBirth: parseDobToInstant(parsed.data.dateOfBirth),
        gender: parsed.data.gender ?? undefined,
        state: parsed.data.state ?? undefined,
        category: parsed.data.category ?? undefined,
        updatedAt: Temporal.Now.instant(),
      };

      if (!existingProfile) {
        const profile = await db.orm.public.StudentProfile.create(data);

        return reply.code(201).send({
          profile: {
            ...profile,
            email: request.authUser!.email,
          },
          profileCompletion: computeProfileCompletion(profile, 0),
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({ id: existingProfile.id })
        .update(data);

      const educationRecords = await db.orm.public.EducationRecord
        .where({ studentProfileId: existingProfile.id })
        .all();

      return reply.send({
        profile: {
          ...profile,
          email: request.authUser!.email,
        },
        profileCompletion: computeProfileCompletion(
          profile ?? existingProfile,
          educationRecords.length,
        ),
      });
    },
  );

  /*
   * GET EDUCATION RECORDS
   */
  app.get(
    "/student/education",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const profile = await db.orm.public.StudentProfile
        .where({ userId: request.authUser!.id })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      const records = await db.orm.public.EducationRecord
        .where({ studentProfileId: profile.id })
        .all();

      return reply.send({
        education: records,
      });
    },
  );

  /*
   * ADD EDUCATION RECORD (always additive; never overwrites existing records)
   */
  app.post(
    "/student/education",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const parsed = educationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid education data.",
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({ userId: request.authUser!.id })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Create your student profile first.",
        });
      }

      const record = await db.orm.public.EducationRecord.create({
        studentProfileId: profile.id,
        qualification: parsed.data.qualification,
        courseName: parsed.data.courseName ?? undefined,
        institutionName: parsed.data.institutionName ?? undefined,
        boardOrUniversity: parsed.data.boardOrUniversity ?? undefined,
        passingYear: parsed.data.passingYear ?? undefined,
        percentage: parsed.data.percentage ?? undefined,
        stream: parsed.data.stream ?? undefined,
        updatedAt: Temporal.Now.instant(),
      });

      return reply.code(201).send({
        education: record,
      });
    },
  );

  /*
   * UPDATE EDUCATION RECORD
   */
  app.put(
    "/student/education/:id",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);

      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Education record ID must be a positive integer.",
        });
      }

      const parsed = educationUpdateSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid education data.",
        });
      }

      const profile = await db.orm.public.StudentProfile
        .where({ userId: request.authUser!.id })
        .first();

      if (!profile) {
        return reply.code(404).send({
          error: "PROFILE_NOT_FOUND",
          message: "Student profile not found.",
        });
      }

      const record = await db.orm.public.EducationRecord
        .where({ id, studentProfileId: profile.id })
        .first();

      if (!record) {
        return reply.code(404).send({
          error: "EDUCATION_NOT_FOUND",
          message: "Education record not found.",
        });
      }

      const updated = await db.orm.public.EducationRecord
        .where({ id: record.id })
        .update({
          ...(parsed.data.qualification !== undefined
            ? { qualification: parsed.data.qualification }
            : {}),
          ...(parsed.data.courseName !== undefined
            ? { courseName: parsed.data.courseName }
            : {}),
          ...(parsed.data.institutionName !== undefined
            ? { institutionName: parsed.data.institutionName }
            : {}),
          ...(parsed.data.boardOrUniversity !== undefined
            ? { boardOrUniversity: parsed.data.boardOrUniversity }
            : {}),
          ...(parsed.data.passingYear !== undefined
            ? { passingYear: parsed.data.passingYear }
            : {}),
          ...(parsed.data.percentage !== undefined
            ? { percentage: parsed.data.percentage }
            : {}),
          ...(parsed.data.stream !== undefined
            ? { stream: parsed.data.stream }
            : {}),
          updatedAt: Temporal.Now.instant(),
        });

      return reply.send({
        education: updated,
      });
    },
  );

  /*
   * DELETE EDUCATION RECORD
   */
  app.delete(
    "/student/education/:id",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);

      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({
          error: "INVALID_ID",
          message: "Education record ID must be a positive integer.",
        });
      }

      try {
        const profile = await db.orm.public.StudentProfile
          .where({ userId: request.authUser!.id })
          .first();

        if (!profile) {
          return reply.code(404).send({
            error: "PROFILE_NOT_FOUND",
            message: "Student profile not found.",
          });
        }

        const record = await db.orm.public.EducationRecord
          .where({ id, studentProfileId: profile.id })
          .first();

        if (!record) {
          return reply.code(404).send({
            error: "EDUCATION_NOT_FOUND",
            message: "Education record not found for this student.",
          });
        }

        await db.orm.public.EducationRecord.where({ id: record.id }).delete();

        return reply.send({
          status: "ok",
          message: "Education record deleted successfully.",
          deletedId: record.id,
        });
      } catch (deleteError) {
        request.log.error(deleteError, "Failed to delete education record");
        return reply.code(500).send({
          error: "EDUCATION_DELETE_FAILED",
          message: "Unable to delete education record.",
        });
      }
    },
  );

  /*
   * SAVED / BOOKMARKED EXAMS
   */
  app.get(
    "/student/saved-exams",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const userId = request.authUser!.id;
      const saved = await db.orm.public.SavedExam.where({ userId }).all();
      const examIds = saved.map((s) => s.examId);

      const allExams = await db.orm.public.Exam.all();
      const examMap = new Map(allExams.map((e) => [e.id, e]));

      const savedExams = saved
        .map((item) => {
          const exam = examMap.get(item.examId);
          if (!exam || exam.isArchived) return null;
          return {
            id: item.id,
            examId: item.examId,
            savedAt: item.createdAt,
            exam,
          };
        })
        .filter(Boolean);

      return reply.send({
        examIds,
        savedExams,
      });
    },
  );

  app.post(
    "/student/saved-exams/:examId",
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

      const exam = await db.orm.public.Exam.where({ id: examId }).first();
      if (!exam || exam.isArchived) {
        return reply.code(404).send({
          error: "EXAM_NOT_FOUND",
          message: "Exam not found.",
        });
      }

      const userId = request.authUser!.id;
      const existing = await db.orm.public.SavedExam
        .where({ userId, examId })
        .first();

      if (existing) {
        return reply.send({ saved: true, savedExam: existing });
      }

      const savedExam = await db.orm.public.SavedExam.create({
        userId,
        examId,
      });

      return reply.code(201).send({ saved: true, savedExam });
    },
  );

  app.delete(
    "/student/saved-exams/:examId",
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

      const userId = request.authUser!.id;
      const existing = await db.orm.public.SavedExam
        .where({ userId, examId })
        .first();

      if (existing) {
        await db.orm.public.SavedExam.where({ id: existing.id }).delete();
      }

      return reply.send({ saved: false, examId });
    },
  );
}
