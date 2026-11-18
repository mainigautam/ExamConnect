import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateAge,
  evaluateEligibility,
  type EligibilityRule,
  type EligibilityStudent,
} from "./evaluator.js";
import { calculateApplicationStatus } from "./eligibility.js";

const SSC_CHSL_AGE_RULE: EligibilityRule = {
  name: "SSC CHSL Category-wise Age Limit",
  conditionField: "ageByCategory",
  operator: "BETWEEN",
  expectedValue:
    "general:18-27,obc:18-30,sc:18-32,st:18-32,ews:18-27|2026-08-01",
  scope: "EXAM",
  ruleType: "AGE",
};

describe("Eligibility Engine — Category Age & Cutoff Date Boundaries", () => {
  it("calculates age accurately on 2026-08-01 cutoff date", () => {
    assert.equal(calculateAge("2008-08-01T00:00:00.000Z", "2026-08-01"), 18);
    assert.equal(calculateAge("2008-08-02T00:00:00.000Z", "2026-08-01"), 17);
    assert.equal(calculateAge("1999-08-01T00:00:00.000Z", "2026-08-01"), 27);
    assert.equal(calculateAge("1998-08-01T00:00:00.000Z", "2026-08-01"), 28);
    assert.equal(calculateAge("1998-08-02T00:00:00.000Z", "2026-08-01"), 27);
  });

  it("evaluates General category minimum boundary (exact 18th birthday on 2026-08-01) as eligible", () => {
    const student: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: "2008-08-01" },
      education: [],
    };
    const res = evaluateEligibility(student, [SSC_CHSL_AGE_RULE]);
    assert.equal(res.eligible, true);
    assert.match(res.reasons[0], /18 years on 2026-08-01/);
  });

  it("rejects one day below minimum age (17 years on 2026-08-01)", () => {
    const student: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: "2008-08-02" },
      education: [],
    };
    const res = evaluateEligibility(student, [SSC_CHSL_AGE_RULE]);
    assert.equal(res.eligible, false);
    assert.match(res.reasons[0], /below the minimum 18 years/i);
  });

  it("evaluates General category maximum boundary (27 years on 2026-08-01) as eligible", () => {
    const student: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: "1998-08-02" },
      education: [],
    };
    const res = evaluateEligibility(student, [SSC_CHSL_AGE_RULE]);
    assert.equal(res.eligible, true);
    assert.match(res.reasons[0], /27 years on 2026-08-01/);
  });

  it("rejects one day above General maximum age (turned 28 on 2026-08-01)", () => {
    const student: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: "1998-08-01" },
      education: [],
    };
    const res = evaluateEligibility(student, [SSC_CHSL_AGE_RULE]);
    assert.equal(res.eligible, false);
    assert.match(res.reasons[0], /above the maximum 27 years/i);
  });

  it("evaluates OBC (including OBC-NCL alias) age relaxation up to 30", () => {
    const obc30: EligibilityStudent = {
      profile: { category: "OBC-NCL", state: "UP", dateOfBirth: "1996-08-01" },
      education: [],
    };
    const obc31: EligibilityStudent = {
      profile: { category: "OBC", state: "UP", dateOfBirth: "1995-08-01" },
      education: [],
    };
    assert.equal(evaluateEligibility(obc30, [SSC_CHSL_AGE_RULE]).eligible, true);
    assert.equal(evaluateEligibility(obc31, [SSC_CHSL_AGE_RULE]).eligible, false);
  });

  it("evaluates SC and ST age relaxation up to 32", () => {
    const sc32: EligibilityStudent = {
      profile: { category: "SC", state: "Bihar", dateOfBirth: "1994-08-01" },
      education: [],
    };
    const st32: EligibilityStudent = {
      profile: { category: "Scheduled Tribe", state: "MP", dateOfBirth: "1994-08-01" },
      education: [],
    };
    const sc33: EligibilityStudent = {
      profile: { category: "SC", state: "Bihar", dateOfBirth: "1993-08-01" },
      education: [],
    };
    assert.equal(evaluateEligibility(sc32, [SSC_CHSL_AGE_RULE]).eligible, true);
    assert.equal(evaluateEligibility(st32, [SSC_CHSL_AGE_RULE]).eligible, true);
    assert.equal(evaluateEligibility(sc33, [SSC_CHSL_AGE_RULE]).eligible, false);
  });

  it("evaluates EWS age range 18-27", () => {
    const ews27: EligibilityStudent = {
      profile: { category: "EWS", state: "Rajasthan", dateOfBirth: "1999-08-01" },
      education: [],
    };
    const ews28: EligibilityStudent = {
      profile: { category: "EWS", state: "Rajasthan", dateOfBirth: "1998-08-01" },
      education: [],
    };
    assert.equal(evaluateEligibility(ews27, [SSC_CHSL_AGE_RULE]).eligible, true);
    assert.equal(evaluateEligibility(ews28, [SSC_CHSL_AGE_RULE]).eligible, false);
  });

  it("handles missing DOB and missing category with clear explanations", () => {
    const missingDob: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: null },
      education: [],
    };
    const missingCat: EligibilityStudent = {
      profile: { category: null, state: "Delhi", dateOfBirth: "2002-05-10" },
      education: [],
    };
    const r1 = evaluateEligibility(missingDob, [SSC_CHSL_AGE_RULE]);
    const r2 = evaluateEligibility(missingCat, [SSC_CHSL_AGE_RULE]);
    assert.equal(r1.eligible, false);
    assert.match(r1.reasons[0], /Date of birth is missing/i);
    assert.equal(r2.eligible, false);
    assert.match(r2.reasons[0], /Category is missing/i);
  });
});

describe("Eligibility Engine — Qualifications, Subjects, Percentage, Passing Year, AND/OR", () => {
  it("matches Bachelor's, Master's, and subject-specific Geo-Scientist requirements accurately", () => {
    const studentBvoc: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: "2002-05-01" },
      education: [
        {
          qualification: "B.Voc",
          courseName: "Software Development",
          stream: "Software Development",
          percentage: 78,
          passingYear: 2025,
        },
      ],
    };

    const bachelorRule: EligibilityRule = {
      name: "UPSC CSE Graduation",
      conditionField: "qualificationRequirement",
      operator: "REQUIRED",
      expectedValue: "Bachelor's Degree in any discipline from a recognised university",
      qualificationRequirement:
        "Bachelor's Degree in any discipline from a recognised university",
    };

    const geoMastersRule: EligibilityRule = {
      name: "Geo-Scientist M.Sc Geology",
      conditionField: "qualificationRequirement",
      operator: "REQUIRED",
      expectedValue: "Master's Degree in Geology or Applied Geology",
      qualificationRequirement: "Master's Degree in Geology or Applied Geology",
    };

    assert.equal(evaluateEligibility(studentBvoc, [bachelorRule]).eligible, true);
    const geoRes = evaluateEligibility(studentBvoc, [geoMastersRule]);
    assert.equal(geoRes.eligible, false);
    assert.match(geoRes.reasons[0], /Qualification not met/i);

    const mscStudent: EligibilityStudent = {
      profile: { category: "General", state: "Delhi", dateOfBirth: "2000-01-01" },
      education: [
        {
          qualification: "M.Sc.",
          stream: "Applied Geology",
          percentage: 72,
          passingYear: 2024,
        },
      ],
    };
    assert.equal(evaluateEligibility(mscStudent, [geoMastersRule]).eligible, true);
  });

  it("evaluates percentage, passingYear, gender, AND and OR logic groups", () => {
    const student: EligibilityStudent = {
      profile: {
        category: "OBC",
        state: "Delhi",
        gender: "Female",
        dateOfBirth: "2002-03-15",
      },
      education: [
        {
          qualification: "B.Sc.",
          stream: "Physics",
          percentage: 58,
          passingYear: 2024,
        },
      ],
    };

    const rules: EligibilityRule[] = [
      {
        name: "Category Percentage",
        conditionField: "percentage",
        operator: ">=",
        expectedValue: "General:60,OBC:55,SC:50",
      },
      {
        name: "Passing Year Cutoff",
        conditionField: "passingYear",
        operator: "<=",
        expectedValue: "2026",
      },
      {
        name: "Option A: B.Tech",
        conditionField: "qualification",
        operator: "=",
        expectedValue: "B.Tech",
        logicGroup: "deg_group",
        logicOperator: "OR",
      },
      {
        name: "Option B: B.Sc",
        conditionField: "qualification",
        operator: "=",
        expectedValue: "B.Sc",
        logicGroup: "deg_group",
        logicOperator: "OR",
      },
      {
        name: "Gender Check",
        conditionField: "gender",
        operator: "IN",
        expectedValue: "Male,Female",
      },
    ];

    const res = evaluateEligibility(student, rules);
    assert.equal(res.eligible, true);
    assert.equal(res.ruleEvaluations.length, 5);
  });
});

describe("SSC CHSL 2026 Regression Suite (3 Posts + Cutoff 2026-08-01 + Closed Window)", () => {
  const existingProfileStudent: EligibilityStudent = {
    profile: {
      category: "General",
      state: "Delhi",
      dateOfBirth: "2004-06-15T00:00:00.000Z",
    },
    education: [
      {
        qualification: "B.Voc",
        courseName: "Software Development",
        stream: "Software Development",
        percentage: 75,
        passingYear: 2025,
      },
      {
        qualification: "Class 12",
        courseName: "Senior Secondary",
        stream: "Science with Mathematics",
        percentage: 84,
        passingYear: 2022,
      },
    ],
  };

  const ldcRule: EligibilityRule = {
    name: "LDC/JSA Qualification",
    conditionField: "qualificationRequirement",
    operator: "REQUIRED",
    expectedValue: "Must have passed 12th Standard or equivalent examination from a recognized Board or University.",
    qualificationRequirement:
      "Must have passed 12th Standard or equivalent examination from a recognized Board or University.",
    scope: "POST",
  };

  const deoOtherRule: EligibilityRule = {
    name: "DEO Other Departments Qualification",
    conditionField: "qualificationRequirement",
    operator: "REQUIRED",
    expectedValue: "12th Standard pass or equivalent from a recognized Board or University.",
    qualificationRequirement:
      "12th Standard pass or equivalent from a recognized Board or University.",
    scope: "POST",
  };

  const deoSpecifiedRule: EligibilityRule = {
    name: "DEO Specified Departments Qualification",
    conditionField: "qualificationRequirement",
    operator: "REQUIRED",
    expectedValue:
      "12th Standard pass in Science stream with Mathematics as a subject from a recognized Board or equivalent.",
    qualificationRequirement:
      "12th Standard pass in Science stream with Mathematics as a subject from a recognized Board or equivalent.",
    scope: "POST",
  };

  it("matches all three SSC CHSL posts for student with Class 12 Science+Maths + B.Voc and cites Class 12 record", () => {
    const rLdc = evaluateEligibility(existingProfileStudent, [SSC_CHSL_AGE_RULE, ldcRule]);
    const rDeoOther = evaluateEligibility(existingProfileStudent, [SSC_CHSL_AGE_RULE, deoOtherRule]);
    const rDeoSpec = evaluateEligibility(existingProfileStudent, [SSC_CHSL_AGE_RULE, deoSpecifiedRule]);

    assert.equal(rLdc.eligible, true);
    assert.equal(rDeoOther.eligible, true);
    assert.equal(rDeoSpec.eligible, true);

    // Ensure explanation specifically identifies Class 12 rather than B.Voc
    assert.match(rLdc.reasons[1], /Class 12/i);
    assert.match(rDeoSpec.reasons[1], /Class 12.*Science with Mathematics/i);
  });

  it("does NOT infer Class 12 Science + Mathematics from B.Voc Software Development alone", () => {
    const bvocOnlyStudent: EligibilityStudent = {
      profile: {
        category: "General",
        state: "Delhi",
        dateOfBirth: "2004-06-15T00:00:00.000Z",
      },
      education: [
        {
          qualification: "B.Voc",
          courseName: "Software Development",
          stream: "Software Development",
          percentage: 80,
          passingYear: 2025,
        },
      ],
    };

    const rDeoSpec = evaluateEligibility(bvocOnlyStudent, [SSC_CHSL_AGE_RULE, deoSpecifiedRule]);
    assert.equal(rDeoSpec.eligible, false);
    assert.match(rDeoSpec.reasons[1], /Requires Class 12 \(10\+2\) in Science stream with Mathematics/i);
  });

  it("marks expired SSC CHSL deadline strictly as CLOSED (never OPEN)", () => {
    const status = calculateApplicationStatus(
      "2026-04-01T00:00:00.000Z",
      "2026-05-31T18:29:59.000Z",
      "OPEN", // Even if DB stored OPEN, expired end date must compute as CLOSED
    );
    assert.equal(status, "CLOSED");
  });
});
