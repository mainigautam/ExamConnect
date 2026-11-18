import type { ExamResult, GroupedExam } from "./types";

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "/api/backend" : "http://localhost:4000")
).replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new ApiError(
      typeof data.message === "string"
        ? data.message
        : `Request failed with status ${response.status}.`,
      response.status,
      typeof data.error === "string" ? data.error : undefined,
    );
  }

  return data as T;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Not announced";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not announced";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function cleanReason(reason: string): string {
  return reason
    .replace(/^Requirement (?:not )?satisfied:\s*/i, "")
    .replace(/^Requirement failed:\s*/i, "")
    .trim();
}

export function isTestExamName(name: string): boolean {
  return name.trim().toLowerCase().includes("examconnect notification test exam");
}

function resolvePrimaryStatus(statuses: string[]): string {
  if (statuses.includes("OPEN")) return "OPEN";
  if (statuses.includes("UPCOMING")) return "UPCOMING";
  if (statuses.includes("NOTIFICATION_AWAITED")) return "NOTIFICATION_AWAITED";
  if (statuses.includes("CLOSED")) return "CLOSED";
  return "UNKNOWN";
}

export function groupExamResults(results: ExamResult[]): GroupedExam[] {
  const map = new Map<number, ExamResult[]>();

  for (const item of results) {
    if (isTestExamName(item.exam.name)) {
      continue;
    }
    const existing = map.get(item.exam.id) ?? [];
    existing.push(item);
    map.set(item.exam.id, existing);
  }

  const grouped: GroupedExam[] = [];

  for (const items of map.values()) {
    const first = items[0];
    const eligiblePostCount = items.filter((p) => p.eligible).length;
    const ineligiblePostCount = items.filter((p) => !p.eligible).length;

    const allDeadlines = Array.from(
      new Map(
        items.flatMap((p) => p.deadlines).map((d) => [d.id, d]),
      ).values(),
    );

    const allSources = Array.from(
      new Map(
        items.flatMap((p) => p.sources).map((s) => [s.id, s]),
      ).values(),
    );

    const primaryStatus = resolvePrimaryStatus(
      allDeadlines.map((d) => d.status),
    );

    const endTimestamps = allDeadlines
      .map((d) => (d.applicationEnd ? new Date(d.applicationEnd).getTime() : NaN))
      .filter((t) => !Number.isNaN(t));

    grouped.push({
      exam: first.exam,
      posts: items,
      eligible: eligiblePostCount > 0,
      eligiblePostCount,
      ineligiblePostCount,
      saved: Boolean(first.saved),
      primaryStatus,
      earliestEndTimestamp:
        endTimestamps.length > 0 ? Math.min(...endTimestamps) : null,
      sources: allSources,
      deadlines: allDeadlines,
    });
  }

  return grouped;
}
