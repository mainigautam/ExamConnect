import { Temporal } from "@js-temporal/polyfill";

export type EligibilityStudent = {
  profile: {
    category: string | null;
    state: string | null;
    dateOfBirth: string | null;
    gender?: string | null;
  };

  education: Array<{
    qualification: string;
    courseName?: string | null;
    percentage: number | null;
    passingYear: number | null;
    stream: string | null;
  }>;
};

export type EligibilityRule = {
  name: string;
  conditionField: string;
  operator: string;
  expectedValue: string;
  qualificationRequirement?: string | null;
  logicGroup?: string | null;
  logicOperator?: string | null;
  scope?: "EXAM" | "POST";
  ruleType?: string;
};

export type EvaluatedRuleDetail = {
  name: string;
  conditionField: string;
  operator: string;
  expectedValue: string;
  scope: "EXAM" | "POST";
  logicGroup: string | null;
  logicOperator: string;
  satisfied: boolean;
  reason: string;
};

export type EligibilityResult = {
  eligible: boolean;
  reasons: string[];
  ruleEvaluations: EvaluatedRuleDetail[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function cleanTextForMatching(value: string | null | undefined): string {
  return normalizeText(value)
    .replace(/[.,()/-]/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeQualification(value: string): string {
  const normalized = normalizeText(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    "10th": "10th",
    "class 10": "10th",
    "class x": "10th",
    matriculation: "10th",
    matric: "10th",
    sslc: "10th",
    "secondary school": "10th",

    "12th": "12th",
    "class 12": "12th",
    "class xii": "12th",
    "10+2": "12th",
    "plus two": "12th",
    "higher secondary": "12th",
    "senior secondary": "12th",
    intermediate: "12th",
    hsc: "12th",

    diploma: "diploma",

    ba: "ba",
    "b a": "ba",
    "bachelor of arts": "ba",

    bsc: "bsc",
    "b sc": "bsc",
    "bachelor of science": "bsc",

    bcom: "bcom",
    "b com": "bcom",
    "bachelor of commerce": "bcom",

    btech: "btech",
    "b tech": "btech",
    be: "btech",
    "b e": "btech",
    "bachelor of technology": "btech",
    "bachelor of engineering": "btech",

    bvoc: "bvoc",
    "b voc": "bvoc",
    "bachelor of vocational studies": "bvoc",
    "bachelor of vocation": "bvoc",

    bba: "bba",
    "b b a": "bba",
    "bachelor of business administration": "bba",

    bca: "bca",
    "b c a": "bca",
    "bachelor of computer applications": "bca",

    llb: "llb",
    "l l b": "llb",
    "bachelor of laws": "llb",

    mbbs: "mbbs",
    "m b b s": "mbbs",

    graduate: "bachelor",
    graduation: "bachelor",
    "bachelor's degree": "bachelor",
    "bachelors degree": "bachelor",
    bachelor: "bachelor",

    ma: "ma",
    "m a": "ma",
    "master of arts": "ma",

    msc: "msc",
    "m sc": "msc",
    "master of science": "msc",

    mcom: "mcom",
    "m com": "mcom",
    "master of commerce": "mcom",

    mtech: "mtech",
    "m tech": "mtech",
    me: "mtech",
    "m e": "mtech",
    "master of technology": "mtech",
    "master of engineering": "mtech",

    mba: "mba",
    "m b a": "mba",
    "master of business administration": "mba",

    mca: "mca",
    "m c a": "mca",
    "master of computer applications": "mca",

    postgraduate: "master",
    "post graduate": "master",
    "master's degree": "master",
    "masters degree": "master",
    master: "master",
  };

  return aliases[normalized] ?? normalized;
}

function compareNumbers(
  actual: number,
  operator: string,
  expected: number,
): boolean {
  switch (operator.trim().toUpperCase()) {
    case ">=":
      return actual >= expected;
    case "<=":
      return actual <= expected;
    case ">":
      return actual > expected;
    case "<":
      return actual < expected;
    case "=":
    case "==":
    case "EQUALS":
      return actual === expected;
    case "!=":
    case "NOT_EQUALS":
      return actual !== expected;
    default:
      return false;
  }
}

function compareText(
  actual: string,
  operator: string,
  expected: string,
): boolean {
  const normalizedActual = normalizeText(actual);
  const normalizedExpectedList = expected
    .split(",")
    .map((value) => normalizeText(value))
    .filter(Boolean);

  switch (operator.trim().toUpperCase()) {
    case "IN":
      return normalizedExpectedList.includes(normalizedActual);
    case "=":
    case "==":
    case "EQUALS":
      return normalizedActual === normalizeText(expected);
    case "!=":
    case "NOT_EQUALS":
      return normalizedActual !== normalizeText(expected);
    case "REQUIRED":
      return normalizedActual.length > 0 && normalizedExpectedList.includes(normalizedActual);
    default:
      return false;
  }
}

export function normalizeAgeCategory(category: string): string {
  const value = normalizeText(category).replace(/[^a-z0-9]/g, "");

  if (["general", "gen", "unreserved", "ur", "open"].includes(value)) {
    return "general";
  }

  if (
    [
      "obc",
      "obcncl",
      "obcnoncreamylayer",
      "otherbackwardclass",
      "otherbackwardclasses",
    ].includes(value)
  ) {
    return "obc";
  }

  if (["sc", "scheduledcaste", "scheduledcastes"].includes(value)) {
    return "sc";
  }

  if (["st", "scheduledtribe", "scheduledtribes"].includes(value)) {
    return "st";
  }

  if (
    [
      "ews",
      "economicallyweakersection",
      "economicallyweakersections",
    ].includes(value)
  ) {
    return "ews";
  }

  return value;
}

/**
 * Safely parse a date of birth string (ISO timestamp or YYYY-MM-DD) into a PlainDate
 * using Asia/Kolkata timezone for ISO instants so midnight UTC timestamps stay accurate.
 */
function parsePlainDateSafe(dateString: string): Temporal.PlainDate | null {
  const trimmed = dateString.trim();
  if (!trimmed) {
    return null;
  }

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return Temporal.PlainDate.from(trimmed);
    }

    // If ISO string ends with T00:00:00.000Z or T00:00:00Z, treat the calendar date directly
    // to prevent timezone shifts across UTC/IST boundaries for pure date-of-birth values
    const midnightIsoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/i);
    if (midnightIsoMatch) {
      return Temporal.PlainDate.from(midnightIsoMatch[1]);
    }

    return Temporal.Instant.from(trimmed)
      .toZonedDateTimeISO("Asia/Kolkata")
      .toPlainDate();
  } catch {
    return null;
  }
}

export function calculateAge(
  dateOfBirth: string,
  asOfDate?: string,
): number | null {
  const birthDate = parsePlainDateSafe(dateOfBirth);
  if (!birthDate) {
    return null;
  }

  const targetDate = asOfDate
    ? parsePlainDateSafe(asOfDate)
    : Temporal.Now.zonedDateTimeISO("Asia/Kolkata").toPlainDate();

  if (!targetDate) {
    return null;
  }

  let age = targetDate.year - birthDate.year;

  const birthdayOnTargetYear = birthDate.add({ years: age });

  if (Temporal.PlainDate.compare(targetDate, birthdayOnTargetYear) < 0) {
    age -= 1;
  }

  return age;
}

const SUBJECT_ALIASES: Record<string, string[]> = {
  geology: [
    "geology",
    "geological science",
    "applied geology",
    "marine geology",
    "earth science",
    "geo exploration",
    "mineral exploration",
    "hydrogeology",
  ],
  geophysics: [
    "geophysics",
    "geophysicist",
    "exploration geophysics",
    "applied geophysics",
    "marine geophysics",
    "geo exploration",
  ],
  physics: ["physics", "applied physics"],
  chemistry: [
    "chemistry",
    "applied chemistry",
    "analytical chemistry",
    "physical chemistry",
    "inorganic chemistry",
    "organic chemistry",
    "hydro chemistry",
    "industrial chemistry",
  ],
  mathematics: ["mathematics", "maths", "applied mathematics", "pcm"],
  statistics: ["statistics", "mathematical statistics", "applied statistics"],
  economics: ["economics", "applied economics", "econometrics"],
  commerce: ["commerce", "accountancy", "accounting", "bcom", "b com", "mcom", "m com"],
  engineering: [
    "engineering",
    "btech",
    "b tech",
    "b e",
    "mtech",
    "m tech",
    "civil engineering",
    "mechanical engineering",
    "electrical engineering",
    "electronics",
  ],
  computer_science: [
    "computer science",
    "information technology",
    "software development",
    "computer applications",
    "bca",
    "mca",
  ],
  medicine: ["mbbs", "medicine", "medical"],
  law: ["llb", "law", "legal"],
  agriculture: ["agriculture", "agricultural", "horticulture", "forestry"],
};

function classifyEducationItem(item: EligibilityStudent["education"][number]) {
  const qualification = cleanTextForMatching(item.qualification);
  const courseName = cleanTextForMatching(item.courseName);
  const stream = cleanTextForMatching(item.stream);
  const fullText = `${qualification} ${courseName} ${stream}`.trim();

  const isMasters =
    /\b(m sc|msc|master of science|master|post graduate|postgraduate|mtech|m tech|m e|ma|m a|mcom|m com|mba|mca)\b/i.test(
      `${qualification} ${courseName}`,
    );

  const isBachelors =
    /\b(b voc|bvoc|b sc|bsc|b a|ba|b com|bcom|b tech|btech|b e|bba|bca|llb|mbbs|bachelor|graduate|graduation)\b/i.test(
      `${qualification} ${courseName}`,
    );

  const isDiploma = /\bdiploma\b/i.test(`${qualification} ${courseName}`);

  const isTwelve =
    /\b(12th|class\s*xii|class\s*12|senior secondary|higher secondary|intermediate|10\s*\+\s*2|10\s+2|plus two|hsc)\b/i.test(
      `${qualification} ${courseName}`,
    );

  const isTen =
    /\b(10th|class\s*x|class\s*10|matriculation|matric|sslc|secondary\s+school)\b/i.test(
      `${qualification} ${courseName}`,
    ) && !isTwelve;

  const hasScienceAndMaths =
    (/\bscience\b/i.test(fullText) && /\b(mathematics|maths)\b/i.test(fullText)) ||
    /\bpcm\b/i.test(fullText);

  return {
    qualification,
    courseName,
    stream,
    fullText,
    isMasters,
    isBachelors,
    isDiploma,
    isTwelve,
    isTen,
    hasScienceAndMaths,
  };
}

function parseQualificationRequirements(requirement: string) {
  const normalizedRequirement = cleanTextForMatching(requirement);

  const needsScienceAndMaths =
    (/\bscience\b/i.test(normalizedRequirement) &&
      /\b(mathematics|maths)\b/i.test(normalizedRequirement)) ||
    /\bpcm\b/i.test(normalizedRequirement);

  const needsTwelve =
    /\b(12th|class\s*xii|class\s*12|senior secondary|higher secondary|intermediate|10\s*\+\s*2|10\s+2|plus two|hsc)\b/i.test(
      normalizedRequirement,
    );

  const needsTen =
    /\b(10th|class\s*x|class\s*10|matriculation|matric|sslc)\b/i.test(
      normalizedRequirement,
    ) && !needsTwelve;

  const needsMasters =
    /\b(masters degree|master of science|m sc|msc|master of|mtech|m tech|ma|m a|mcom|m com|post graduate|postgraduate)\b/i.test(
      normalizedRequirement,
    );

  const needsBachelors =
    /\b(bachelors degree|bachelor of|bachelor|graduate|graduation|b sc|bsc|b tech|btech|b voc|bvoc|degree from a recognised university|degree from a recognized university|any degree)\b/i.test(
      normalizedRequirement,
    );

  const needsDiploma = /\bdiploma\b/i.test(normalizedRequirement);

  // Extract subject requirements only when not purely generic Class 12 Science+Maths
  const requiredSubjects = needsScienceAndMaths
    ? []
    : Object.entries(SUBJECT_ALIASES)
        .filter(([, aliases]) =>
          aliases.some((alias) => {
            const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            return new RegExp(`\\b${escaped}\\b`, "i").test(normalizedRequirement);
          }),
        )
        .map(([subject]) => subject);

  return {
    normalizedRequirement,
    needsScienceAndMaths,
    needsTwelve,
    needsTen,
    needsMasters,
    needsBachelors,
    needsDiploma,
    requiredSubjects,
  };
}

function educationItemMatchesRequirement(
  item: EligibilityStudent["education"][number],
  requirement: string,
): boolean {
  const req = parseQualificationRequirements(requirement);
  const edu = classifyEducationItem(item);

  // 1. Class 12 Science with Mathematics (e.g., SSC CHSL Specified DEO, UPSC NDA Air Force/Navy)
  // MUST be satisfied by an actual Class 12 record — NEVER inferred from B.Voc or Bachelor's!
  if (req.needsScienceAndMaths && req.needsTwelve) {
    return edu.isTwelve && edu.hasScienceAndMaths;
  }

  if (req.needsScienceAndMaths && !req.needsBachelors && !req.needsMasters) {
    return edu.isTwelve && edu.hasScienceAndMaths;
  }

  // 2. General Class 12 requirement (e.g., SSC CHSL LDC/JSA, DEO Other Departments, UPSC NDA Army)
  // Verified against an actual Class 12 record (or Diploma if explicitly allowed by the notice)
  if (req.needsTwelve && !req.needsBachelors && !req.needsMasters) {
    if (edu.isTwelve) {
      return true;
    }
    if (req.needsDiploma && edu.isDiploma) {
      return true;
    }
    return false;
  }

  // 3. Class 10 / Matriculation requirement (e.g., SSC MTS, SSC GD Constable)
  if (req.needsTen && !req.needsTwelve && !req.needsBachelors && !req.needsMasters) {
    return edu.isTen || edu.isTwelve || edu.isDiploma || edu.isBachelors || edu.isMasters;
  }

  // 4. Master's degree requirement (with optional Bachelor's alternative when both are mentioned)
  if (req.needsMasters && !req.needsBachelors) {
    if (!edu.isMasters) {
      return false;
    }
    if (req.requiredSubjects.length === 0) {
      return true;
    }
    return req.requiredSubjects.some((subject) =>
      SUBJECT_ALIASES[subject].some((alias) => edu.fullText.includes(alias)),
    );
  }

  // 5. Bachelor's degree requirement (also satisfied by Master's if general graduate degree or matching subject)
  if (req.needsBachelors) {
    const degreeLevelMatch = req.needsMasters
      ? edu.isBachelors || edu.isMasters
      : edu.isBachelors || edu.isMasters;

    if (!degreeLevelMatch) {
      return false;
    }

    if (req.requiredSubjects.length === 0) {
      return true;
    }

    return req.requiredSubjects.some((subject) =>
      SUBJECT_ALIASES[subject].some((alias) => edu.fullText.includes(alias)),
    );
  }

  // 6. Diploma requirement
  if (req.needsDiploma) {
    return edu.isDiploma || edu.isBachelors || edu.isMasters;
  }

  // 7. Subject-only fallback
  if (req.requiredSubjects.length > 0) {
    return req.requiredSubjects.some((subject) =>
      SUBJECT_ALIASES[subject].some((alias) => edu.fullText.includes(alias)),
    );
  }

  return false;
}

export function qualificationSatisfiesRequirement(
  education: EligibilityStudent["education"],
  requirement: string,
): boolean {
  return education.some((item) => educationItemMatchesRequirement(item, requirement));
}

function findMatchingEducation(
  student: EligibilityStudent,
  requirement?: string | null,
): EligibilityStudent["education"][number] | null {
  if (!student.education.length) {
    return null;
  }

  if (!requirement) {
    return student.education[0];
  }

  const req = parseQualificationRequirements(requirement);

  // Prioritize the exact education level requested (e.g., Class 10 for 10th, Class 12 for 12th, Bachelor's for Graduate)
  const prioritized = [...student.education].sort((a, b) => {
    const ca = classifyEducationItem(a);
    const cb = classifyEducationItem(b);
    const score = (c: ReturnType<typeof classifyEducationItem>) => {
      if (req.needsTwelve && c.isTwelve) return 10;
      if (req.needsTen && c.isTen) return 10;
      if (req.needsMasters && c.isMasters) return 10;
      if (req.needsBachelors && c.isBachelors) return 9;
      if (req.needsDiploma && c.isDiploma) return 8;
      return 0;
    };
    return score(cb) - score(ca);
  });

  for (const education of prioritized) {
    if (educationItemMatchesRequirement(education, requirement)) {
      return education;
    }
  }

  return null;
}

function formatEducation(
  education: EligibilityStudent["education"][number] | null,
): string {
  if (!education) {
    return "No education record available";
  }

  const qualification = education.qualification?.trim();
  const courseName = education.courseName?.trim();
  const stream = education.stream?.trim();

  const parts = [qualification, courseName, stream].filter(Boolean);
  // Deduplicate adjacent identical labels
  const uniqueParts = parts.filter(
    (part, idx) =>
      idx === 0 ||
      normalizeText(part) !== normalizeText(parts[idx - 1]),
  );

  return uniqueParts.length > 0
    ? uniqueParts.join(" — ")
    : "Education details not available";
}

function formatAllEducations(education: EligibilityStudent["education"]): string {
  if (education.length === 0) {
    return "No education records added";
  }
  return education.map((item) => formatEducation(item)).join("; ");
}

function formatAgeRequirement(expectedValue: string): {
  minAge: number | null;
  maxAge: number | null;
  asOfDate: string | null;
} {
  const match = expectedValue
    .trim()
    .match(/^(\d+)\s*-\s*(\d+)(?:\s*(?:\||as\s+of)\s*(\d{4}-\d{2}-\d{2}))?$/i);

  if (!match) {
    return {
      minAge: null,
      maxAge: null,
      asOfDate: null,
    };
  }

  return {
    minAge: Number(match[1]),
    maxAge: Number(match[2]),
    asOfDate: match[3] ?? null,
  };
}

function parseCategoryNumericRequirement(
  expectedValue: string,
): Map<string, number> {
  const requirements = new Map<string, number>();

  for (const item of expectedValue.split(",")) {
    const trimmedItem = item.trim();
    if (!trimmedItem) continue;

    const separatorIndex = trimmedItem.indexOf(":");
    if (separatorIndex === -1) continue;

    const category = normalizeAgeCategory(trimmedItem.slice(0, separatorIndex));
    const value = Number(trimmedItem.slice(separatorIndex + 1).trim());

    if (category && Number.isFinite(value)) {
      requirements.set(category, value);
    }
  }

  return requirements;
}

type CategoryAgeRange = {
  minAge: number;
  maxAge: number;
};

export function parseCategoryAgeRangeRequirement(expectedValue: string): {
  ranges: Map<string, CategoryAgeRange>;
  asOfDate: string | null;
} {
  const separatorIndex = expectedValue.lastIndexOf("|");
  const ranges = new Map<string, CategoryAgeRange>();

  if (separatorIndex === -1) {
    return { ranges, asOfDate: null };
  }

  const asOfDate = expectedValue.slice(separatorIndex + 1).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) ||
    !parsePlainDateSafe(asOfDate)
  ) {
    return { ranges, asOfDate: null };
  }

  const rangeText = expectedValue.slice(0, separatorIndex);

  for (const item of rangeText.split(",")) {
    const trimmedItem = item.trim();
    const colonIndex = trimmedItem.indexOf(":");
    if (colonIndex === -1) continue;

    const category = normalizeAgeCategory(trimmedItem.slice(0, colonIndex));
    const match = trimmedItem
      .slice(colonIndex + 1)
      .trim()
      .match(/^(\d+)\s*-\s*(\d+)$/);

    if (!category || !match) continue;

    const minAge = Number(match[1]);
    const maxAge = Number(match[2]);

    if (
      Number.isInteger(minAge) &&
      Number.isInteger(maxAge) &&
      minAge >= 0 &&
      maxAge >= minAge
    ) {
      ranges.set(category, { minAge, maxAge });
    }
  }

  return { ranges, asOfDate };
}

function formatRuleRequirement(rule: EligibilityRule): string {
  return rule.expectedValue.trim().replace(/\s+/g, " ");
}

function buildSatisfiedReason(
  student: EligibilityStudent,
  rule: EligibilityRule,
): string {
  const { conditionField, operator, expectedValue } = rule;

  if (conditionField === "ageByCategory") {
    const { ranges, asOfDate } = parseCategoryAgeRangeRequirement(expectedValue);
    const category = student.profile.category ?? "Unknown";
    const range = ranges.get(normalizeAgeCategory(category));
    const age =
      student.profile.dateOfBirth && asOfDate
        ? calculateAge(student.profile.dateOfBirth, asOfDate)
        : null;

    if (age !== null && range && asOfDate) {
      return `Age verified: ${age} years on ${asOfDate} (Allowed for ${category}: ${range.minAge}–${range.maxAge} years)`;
    }
    return `Age requirement satisfied: ${rule.name}`;
  }

  if (conditionField === "age") {
    if (!student.profile.dateOfBirth) {
      return `Age requirement satisfied: ${rule.name}`;
    }

    if (expectedValue.includes(":")) {
      const category = student.profile.category ?? "General";
      const age = calculateAge(student.profile.dateOfBirth);
      const categoryRules = parseCategoryNumericRequirement(expectedValue);
      const maxAge = categoryRules.get(normalizeAgeCategory(category));
      if (age !== null && maxAge !== undefined) {
        return `Age verified: ${age} years (Category: ${category}, Maximum allowed: ${maxAge} years)`;
      }
    }

    if (operator.trim().toUpperCase() === "BETWEEN") {
      const { minAge, maxAge, asOfDate } = formatAgeRequirement(expectedValue);
      const age = calculateAge(student.profile.dateOfBirth, asOfDate ?? undefined);
      if (age !== null && minAge !== null && maxAge !== null) {
        return `Age verified: ${age} years${asOfDate ? ` as of ${asOfDate}` : ""} (Allowed: ${minAge}–${maxAge} years)`;
      }
    }

    const age = calculateAge(student.profile.dateOfBirth);
    return `Age verified: ${age ?? "N/A"} years (Required: ${operator} ${expectedValue})`;
  }

  if (conditionField === "qualificationRequirement" && rule.qualificationRequirement) {
    const matchingEducation = findMatchingEducation(student, rule.qualificationRequirement);
    const required = formatRuleRequirement(rule);
    const clippedRequired =
      required.length > 180 ? `${required.slice(0, 177)}...` : required;
    return `Matched qualification: ${formatEducation(matchingEducation)} (Required: ${clippedRequired})`;
  }

  if (conditionField === "qualification") {
    const expectedList = expectedValue.split(",").map((v) => normalizeQualification(v));
    const matchingEducation =
      student.education.find((education) =>
        expectedList.includes(normalizeQualification(education.qualification)),
      ) ??
      student.education[0] ??
      null;

    return `Matched qualification: ${formatEducation(matchingEducation)} (Required: ${expectedValue})`;
  }

  if (conditionField === "stream") {
    const matchingEducation =
      student.education.find(
        (education) =>
          education.stream && compareText(education.stream, operator, expectedValue),
      ) ?? null;

    return `Matched stream: ${matchingEducation?.stream ?? "Available"} (Required: ${expectedValue})`;
  }

  if (conditionField === "percentage") {
    const matchingEducation =
      student.education.find((education) => education.percentage !== null) ?? null;
    const actual = matchingEducation?.percentage;

    if (expectedValue.includes(":") && student.profile.category) {
      const categoryRules = parseCategoryNumericRequirement(expectedValue);
      const minPct = categoryRules.get(normalizeAgeCategory(student.profile.category));
      if (actual !== undefined && actual !== null && minPct !== undefined) {
        return `Percentage verified: ${actual}% (Category: ${student.profile.category}, Minimum required: ${minPct}%)`;
      }
    }

    if (actual !== undefined && actual !== null) {
      return `Percentage verified: ${actual}% (Required: ${operator} ${expectedValue}%)`;
    }
    return `Percentage requirement satisfied (${operator} ${expectedValue}%)`;
  }

  if (conditionField === "passingYear") {
    const matchingEducation =
      student.education.find((education) => education.passingYear !== null) ?? null;
    const actual = matchingEducation?.passingYear;

    if (expectedValue.includes(":") && student.profile.category) {
      const categoryRules = parseCategoryNumericRequirement(expectedValue);
      const reqYear = categoryRules.get(normalizeAgeCategory(student.profile.category));
      if (actual !== undefined && actual !== null && reqYear !== undefined) {
        return `Passing year verified: ${actual} (Category: ${student.profile.category}, Required: ${operator} ${reqYear})`;
      }
    }

    if (actual !== undefined && actual !== null) {
      return `Passing year verified: ${actual} (Required: ${operator} ${expectedValue})`;
    }
    return `Passing year requirement satisfied (${operator} ${expectedValue})`;
  }

  if (conditionField === "category") {
    return `Category verified: ${student.profile.category ?? "Not set"} (Allowed: ${expectedValue})`;
  }

  if (conditionField === "state") {
    return `State verified: ${student.profile.state ?? "Not set"} (Required: ${expectedValue})`;
  }

  if (conditionField === "gender") {
    return `Gender verified: ${student.profile.gender ?? "Not set"} (Allowed: ${expectedValue})`;
  }

  return `Requirement satisfied: ${rule.name}`;
}

function buildFailedReason(
  student: EligibilityStudent,
  rule: EligibilityRule,
): string {
  const { conditionField, operator, expectedValue } = rule;

  if (conditionField === "ageByCategory") {
    if (!student.profile.dateOfBirth) {
      return "Date of birth is missing from your profile. Update your DOB to verify age eligibility.";
    }
    if (!student.profile.category) {
      return "Category is missing from your profile. Select your category to verify age limits.";
    }

    const { ranges, asOfDate } = parseCategoryAgeRangeRequirement(expectedValue);
    if (!asOfDate || ranges.size === 0) {
      return `Age rule "${rule.name}" does not have a valid category age range or cutoff date.`;
    }

    const category = student.profile.category;
    const range = ranges.get(normalizeAgeCategory(category));
    if (!range) {
      return `No age limit is defined for category "${category}" in rule "${rule.name}".`;
    }

    const age = calculateAge(student.profile.dateOfBirth, asOfDate);
    if (age === null) {
      return "Your date of birth format is invalid and could not be evaluated.";
    }

    if (age < range.minAge) {
      return `Age not met: You are ${age} years old on ${asOfDate}, below the minimum ${range.minAge} years for ${category} (Allowed: ${range.minAge}–${range.maxAge} years).`;
    }

    return `Age limit exceeded: You are ${age} years old on ${asOfDate}, above the maximum ${range.maxAge} years for ${category} (Allowed: ${range.minAge}–${range.maxAge} years).`;
  }

  if (conditionField === "age") {
    if (!student.profile.dateOfBirth) {
      return "Date of birth is missing from your profile. Update your DOB to check age eligibility.";
    }

    if (expectedValue.includes(":")) {
      if (!student.profile.category) {
        return "Category is missing from your profile. Select your category to check age limits.";
      }
      const categoryRules = parseCategoryNumericRequirement(expectedValue);
      const maxAge = categoryRules.get(normalizeAgeCategory(student.profile.category));
      const age = calculateAge(student.profile.dateOfBirth);
      if (maxAge === undefined) {
        return `No age limit is configured for category "${student.profile.category}".`;
      }
      if (age === null) {
        return "Your date of birth format is invalid.";
      }
      return `Age limit exceeded: Your age is ${age} years, but maximum allowed for ${student.profile.category} is ${maxAge} years.`;
    }

    if (operator.trim().toUpperCase() === "BETWEEN") {
      const { minAge, maxAge, asOfDate } = formatAgeRequirement(expectedValue);
      if (minAge === null || maxAge === null) {
        return `Age rule "${rule.name}" has an invalid range format (${expectedValue}).`;
      }
      const age = calculateAge(student.profile.dateOfBirth, asOfDate ?? undefined);
      if (age === null) {
        return "Your date of birth format is invalid.";
      }
      return `Age not in range: Your age is ${age} years${asOfDate ? ` as of ${asOfDate}` : ""}, outside the allowed ${minAge}–${maxAge} years.`;
    }

    const age = calculateAge(student.profile.dateOfBirth);
    return `Age not met: Your age is ${age ?? "unknown"} years (Required: ${operator} ${expectedValue} years).`;
  }

  if (conditionField === "qualificationRequirement" && rule.qualificationRequirement) {
    const req = parseQualificationRequirements(rule.qualificationRequirement);
    const recorded = formatAllEducations(student.education);

    if (student.education.length === 0) {
      return `Qualification missing: Add your education records to verify "${formatRuleRequirement(rule)}".`;
    }

    if (req.needsScienceAndMaths) {
      return `Qualification not met: Requires Class 12 (10+2) in Science stream with Mathematics. Your recorded education: ${recorded}.`;
    }

    if (req.needsTwelve && !req.needsBachelors && !req.needsMasters) {
      return `Qualification not met: Requires an explicit Class 12 (10+2) education record. Your recorded education: ${recorded}.`;
    }

    const requiredText = formatRuleRequirement(rule);
    const clippedRequired =
      requiredText.length > 160 ? `${requiredText.slice(0, 157)}...` : requiredText;
    return `Qualification not met: Required ${clippedRequired}. Your recorded education: ${recorded}.`;
  }

  if (conditionField === "qualification") {
    return `Qualification not met: Required ${expectedValue}. Your recorded education: ${formatAllEducations(student.education)}.`;
  }

  if (conditionField === "stream") {
    const streams = student.education
      .map((e) => e.stream)
      .filter(Boolean)
      .join(", ");
    return `Stream not met: Required ${expectedValue}. Your recorded stream(s): ${streams || "None"}.`;
  }

  if (conditionField === "percentage") {
    const percentages = student.education
      .map((e) => e.percentage)
      .filter((p): p is number => p !== null);

    if (percentages.length === 0) {
      return `Percentage missing: Add percentage details to your education record (Required: ${operator} ${expectedValue}%).`;
    }

    if (expectedValue.includes(":")) {
      if (!student.profile.category) {
        return "Category is required to evaluate category-wise percentage rules.";
      }
      const categoryRules = parseCategoryNumericRequirement(expectedValue);
      const minPct = categoryRules.get(normalizeAgeCategory(student.profile.category));
      if (minPct !== undefined) {
        return `Percentage not met: Highest recorded ${Math.max(...percentages)}%, below required ${minPct}% for ${student.profile.category}.`;
      }
    }

    return `Percentage not met: Recorded ${percentages.join("%, ")}% (Required: ${operator} ${expectedValue}%).`;
  }

  if (conditionField === "passingYear") {
    const years = student.education
      .map((e) => e.passingYear)
      .filter((y): y is number => y !== null);

    if (years.length === 0) {
      return `Passing year missing: Add passing year to your education record (Required: ${operator} ${expectedValue}).`;
    }

    return `Passing year not met: Recorded ${years.join(", ")} (Required: ${operator} ${expectedValue}).`;
  }

  if (conditionField === "category") {
    return `Category not met: Your category is "${student.profile.category ?? "Not set"}" (Allowed: ${expectedValue}).`;
  }

  if (conditionField === "state") {
    return `State requirement not met: Your state is "${student.profile.state ?? "Not set"}" (Required: ${expectedValue}).`;
  }

  if (conditionField === "gender") {
    return `Gender requirement not met: Your profile gender is "${student.profile.gender ?? "Not set"}" (Allowed: ${expectedValue}).`;
  }

  return `Requirement not satisfied: ${rule.name} (Expected ${operator} ${expectedValue}).`;
}

function evaluateRule(
  student: EligibilityStudent,
  rule: EligibilityRule,
): boolean {
  const { conditionField, operator, expectedValue } = rule;

  if (conditionField === "ageByCategory") {
    if (!student.profile.dateOfBirth || !student.profile.category) {
      return false;
    }

    const { ranges, asOfDate } = parseCategoryAgeRangeRequirement(expectedValue);
    if (!asOfDate || ranges.size === 0) {
      return false;
    }

    const range = ranges.get(normalizeAgeCategory(student.profile.category));
    if (!range) {
      return false;
    }

    const age = calculateAge(student.profile.dateOfBirth, asOfDate);
    if (age === null) {
      return false;
    }

    return age >= range.minAge && age <= range.maxAge;
  }

  if (conditionField === "age") {
    if (!student.profile.dateOfBirth) {
      return false;
    }

    if (expectedValue.includes(":")) {
      if (!student.profile.category) {
        return false;
      }

      const categoryRules = parseCategoryNumericRequirement(expectedValue);
      const maxAge = categoryRules.get(normalizeAgeCategory(student.profile.category));
      if (maxAge === undefined) {
        return false;
      }

      const age = calculateAge(student.profile.dateOfBirth);
      if (age === null) {
        return false;
      }

      return age <= maxAge;
    }

    if (operator.trim().toUpperCase() === "BETWEEN") {
      const { minAge, maxAge, asOfDate } = formatAgeRequirement(expectedValue);
      if (minAge === null || maxAge === null) {
        return false;
      }

      const age = calculateAge(student.profile.dateOfBirth, asOfDate ?? undefined);
      if (age === null) {
        return false;
      }

      return age >= minAge && age <= maxAge;
    }

    const age = calculateAge(student.profile.dateOfBirth);
    const expectedAge = Number(expectedValue);

    if (age === null || Number.isNaN(expectedAge)) {
      return false;
    }

    return compareNumbers(age, operator, expectedAge);
  }

  if (conditionField === "qualificationRequirement" && rule.qualificationRequirement) {
    return qualificationSatisfiesRequirement(
      student.education,
      rule.qualificationRequirement,
    );
  }

  if (
    conditionField === "qualification" ||
    conditionField === "stream" ||
    conditionField === "percentage" ||
    conditionField === "passingYear"
  ) {
    return student.education.some((education) => {
      if (conditionField === "qualification") {
        const actual = normalizeQualification(education.qualification);
        const expected = expectedValue
          .split(",")
          .map((value) => normalizeQualification(value));

        switch (operator.trim().toUpperCase()) {
          case "IN":
          case "REQUIRED":
            return expected.includes(actual);
          case "=":
          case "==":
          case "EQUALS":
            return actual === normalizeQualification(expectedValue);
          case "!=":
          case "NOT_EQUALS":
            return actual !== normalizeQualification(expectedValue);
          default:
            return false;
        }
      }

      if (conditionField === "stream") {
        if (!education.stream) {
          return false;
        }
        return compareText(education.stream, operator, expectedValue);
      }

      if (conditionField === "percentage") {
        if (education.percentage === null) {
          return false;
        }

        if (expectedValue.includes(":")) {
          if (!student.profile.category) {
            return false;
          }
          const categoryRules = parseCategoryNumericRequirement(expectedValue);
          const minPercentage = categoryRules.get(
            normalizeAgeCategory(student.profile.category),
          );
          if (minPercentage === undefined) {
            return false;
          }
          return education.percentage >= minPercentage;
        }

        const expectedPercentage = Number(expectedValue);
        if (Number.isNaN(expectedPercentage)) {
          return false;
        }

        return compareNumbers(education.percentage, operator, expectedPercentage);
      }

      if (conditionField === "passingYear") {
        if (education.passingYear === null) {
          return false;
        }

        if (expectedValue.includes(":")) {
          if (!student.profile.category) {
            return false;
          }
          const categoryRules = parseCategoryNumericRequirement(expectedValue);
          const requiredPassingYear = categoryRules.get(
            normalizeAgeCategory(student.profile.category),
          );
          if (requiredPassingYear === undefined) {
            return false;
          }
          return compareNumbers(education.passingYear, operator, requiredPassingYear);
        }

        const expectedPassingYear = Number(expectedValue);
        if (Number.isNaN(expectedPassingYear)) {
          return false;
        }

        return compareNumbers(education.passingYear, operator, expectedPassingYear);
      }

      return false;
    });
  }

  if (conditionField === "category") {
    if (!student.profile.category) {
      return false;
    }

    const actualCat = normalizeAgeCategory(student.profile.category);
    const expectedCats = expectedValue
      .split(",")
      .map((v) => normalizeAgeCategory(v));

    switch (operator.trim().toUpperCase()) {
      case "IN":
      case "REQUIRED":
        return expectedCats.includes(actualCat);
      case "=":
      case "==":
      case "EQUALS":
        return actualCat === normalizeAgeCategory(expectedValue);
      case "!=":
      case "NOT_EQUALS":
        return actualCat !== normalizeAgeCategory(expectedValue);
      default:
        return false;
    }
  }

  if (conditionField === "state") {
    if (!student.profile.state) {
      return false;
    }
    return compareText(student.profile.state, operator, expectedValue);
  }

  if (conditionField === "gender") {
    if (!student.profile.gender) {
      return false;
    }
    return compareText(student.profile.gender, operator, expectedValue);
  }

  return false;
}

export function evaluateEligibility(
  student: EligibilityStudent,
  rules: EligibilityRule[],
): EligibilityResult {
  if (rules.length === 0) {
    return {
      eligible: false,
      reasons: ["No active eligibility rules are configured for this exam yet."],
      ruleEvaluations: [],
    };
  }

  const hasQualificationRequirement = rules.some(
    (rule) =>
      rule.conditionField === "qualificationRequirement" &&
      Boolean(rule.qualificationRequirement),
  );

  const applicableRules = rules.filter((rule) => {
    if (hasQualificationRequirement && rule.conditionField === "qualification") {
      return false;
    }
    return true;
  });

  const groups = new Map<string, EligibilityRule[]>();

  for (let index = 0; index < applicableRules.length; index += 1) {
    const rule = applicableRules[index];
    const groupName = rule.logicGroup?.trim() || `__single_${index}`;
    const existing = groups.get(groupName) ?? [];
    existing.push(rule);
    groups.set(groupName, existing);
  }

  const reasons: string[] = [];
  const ruleEvaluations: EvaluatedRuleDetail[] = [];
  let allGroupsSatisfied = true;

  for (const groupRules of groups.values()) {
    const logicOperator = (groupRules[0]?.logicOperator ?? "AND")
      .trim()
      .toUpperCase();

    const groupResults = groupRules.map((rule) => {
      const satisfied = evaluateRule(student, rule);
      const reason = satisfied
        ? buildSatisfiedReason(student, rule)
        : buildFailedReason(student, rule);

      const detail: EvaluatedRuleDetail = {
        name: rule.name,
        conditionField: rule.conditionField,
        operator: rule.operator,
        expectedValue: rule.expectedValue,
        scope: rule.scope ?? "EXAM",
        logicGroup: rule.logicGroup ?? null,
        logicOperator,
        satisfied,
        reason,
      };

      return { rule, satisfied, reason, detail };
    });

    const groupSatisfied =
      logicOperator === "OR"
        ? groupResults.some((item) => item.satisfied)
        : groupResults.every((item) => item.satisfied);

    if (!groupSatisfied) {
      allGroupsSatisfied = false;
    }

    for (const item of groupResults) {
      ruleEvaluations.push(item.detail);
    }

    if (logicOperator === "OR") {
      const satisfiedRule = groupResults.find((item) => item.satisfied);
      if (satisfiedRule) {
        reasons.push(satisfiedRule.reason);
      } else {
        for (const item of groupResults) {
          reasons.push(item.reason);
        }
      }
      continue;
    }

    for (const item of groupResults) {
      reasons.push(item.reason);
    }
  }

  if (reasons.length === 0) {
    return {
      eligible: false,
      reasons: ["No applicable eligibility requirements found."],
      ruleEvaluations,
    };
  }

  return {
    eligible: allGroupsSatisfied,
    reasons,
    ruleEvaluations,
  };
}
