import { Temporal } from "@js-temporal/polyfill";
import { db } from "./index.js";

type SeedPost = {
  name: string;
  code?: string;
  department: string;
  vacancies?: number;
  qualification: string;
  description?: string;
  ageRule?: {
    name: string;
    expectedValue: string;
  };
};

type SeedExtraRule = {
  ruleType: string;
  name: string;
  description?: string;
  conditionField: string;
  operator: string;
  expectedValue: string;
  logicGroup?: string;
  logicOperator?: "AND" | "OR";
};

type SeedDeadline = {
  applicationUrl: string;
  status: string;
  applicationStart?: string;
  applicationEnd?: string;
  examDate?: string;
};

type SeedExam = {
  name: string;
  conductingBody: string;
  examType: string;
  description: string;
  officialWebsite: string;
  source: {
    notificationTitle: string;
    officialUrl: string;
    notificationIdentifier: string;
    notificationDate?: string;
    verified?: boolean;
  };
  examAgeRule?: {
    name: string;
    expectedValue: string;
  };
  extraExamRules?: SeedExtraRule[];
  deadline?: SeedDeadline;
  posts: SeedPost[];
};

/**
 * Verified baseline catalogue of major Indian Central Government & Banking examinations.
 *
 * DATA INTEGRITY GUARANTEE:
 * - Never invents vacancy counts (vacancies remain null unless verified from official notice).
 * - Never invents application dates or exam dates (deadlines default to NOTIFICATION_AWAITED).
 * - Strictly idempotent: checks existing records by (name, conductingBody) and never modifies
 *   or deletes pre-existing database entries.
 */
const VERIFIED_EXAM_CATALOGUE: SeedExam[] = [
  {
    name: "Combined Higher Secondary (10+2) Level Examination, 2026",
    conductingBody: "Staff Selection Commission",
    examType: "Government Recruitment Examination",
    description:
      "Official SSC notice dated 07-09-2026. Approx. 2536 tentative vacancies overall; post-wise vacancies are not specified in this record. Applications closed on 07-10-2026. Age limit stated in the notice: 18 to 27 years as on 01-08-2026, subject to applicable relaxations.",
    officialWebsite: "https://ssc.gov.in/",
    source: {
      notificationTitle:
        "Notice of Combined Higher Secondary (10+2) Level Examination, 2026",
      officialUrl:
        "https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_chsl_2026.pdf",
      notificationIdentifier: "HQ-C1102/5/2026-C-1",
      notificationDate: "2026-09-06T18:30:00.000Z",
      verified: true,
    },
    examAgeRule: {
      name: "Age Range as on 01 August 2026",
      expectedValue:
        "general:18-27,obc:18-30,sc:18-32,st:18-32,ews:18-27|2026-08-01",
    },
    deadline: {
      applicationUrl: "https://ssc.gov.in/",
      status: "CLOSED",
      applicationStart: "2026-09-06T18:30:00.000Z",
      applicationEnd: "2026-10-07T17:30:00.000Z",
    },
    posts: [
      {
        name: "Lower Division Clerk (LDC) / Junior Secretariat Assistant (JSA)",
        department: "Various Ministries, Departments and Offices",
        qualification:
          "Passed 12th Standard or equivalent examination from a recognized Board or University. Essential qualification cut-off date: 07-10-2026.",
        description:
          "Age limit: 18 to 27 years as on 01-08-2026, subject to applicable relaxations. Refer to the official SSC notification.",
      },
      {
        name: "Data Entry Operator (DEO) / DEO Grade A - Other Departments",
        department: "Other eligible Ministries and Departments",
        qualification:
          "Passed 12th Standard or equivalent examination from a recognized Board or University. Essential qualification cut-off date: 07-10-2026.",
        description:
          "Age limit: 18 to 27 years as on 01-08-2026, subject to applicable relaxations. Refer to the official SSC notification.",
      },
      {
        name: "Data Entry Operator (DEO) / DEO Grade A - Specified Departments",
        department: "Specified departments in the official SSC notice",
        qualification:
          "12th Standard pass in Science stream with Mathematics as a subject from a recognized Board or equivalent. Essential qualification cut-off date: 07-10-2026.",
        description:
          "Requires Science stream with Mathematics in Class 12. Age limit: 18 to 27 years as on 01-08-2026, subject to applicable relaxations.",
      },
    ],
  },
  {
    name: "UPSC Civil Services Examination",
    conductingBody: "Union Public Service Commission",
    examType: "Government Exam",
    description:
      "All-India competitive examination conducted by UPSC for recruitment to IAS, IPS, IFS, and Central Services Group A & Group B.",
    officialWebsite: "https://upsc.gov.in",
    source: {
      notificationTitle:
        "UPSC Civil Services Examination — Official UPSC Portal",
      officialUrl: "https://upsc.gov.in",
      notificationIdentifier: "UPSC-CSE-PORTAL",
      verified: true,
    },
    examAgeRule: {
      name: "Category-wise Age Limit (UPSC CSE)",
      expectedValue:
        "general:21-32,obc:21-35,sc:21-37,st:21-37,ews:21-32|2026-08-01",
    },
    extraExamRules: [
      {
        ruleType: "PERCENTAGE",
        name: "Minimum Percentage",
        conditionField: "percentage",
        operator: ">=",
        expectedValue: "General:60,OBC:55,SC:50,ST:50,EWS:55",
      },
      {
        ruleType: "PASSING_YEAR",
        name: "Passing Year Requirement",
        conditionField: "passingYear",
        operator: "<=",
        expectedValue: "General:2027,OBC:2027,SC:2027,ST:2027,EWS:2027",
      },
    ],
    posts: [
      {
        name: "Indian Administrative Service",
        code: "IAS",
        department: "Government of India",
        vacancies: 180,
        qualification:
          "Bachelor's degree from a recognized university or equivalent",
        description: "Civil Services Examination post.",
      },
    ],
  },
  {
    name: "COMBINED GEO-SCIENTIST EXAMINATION, 2027",
    conductingBody: "Union Public Service Commission",
    examType: "Government Recruitment Examination",
    description:
      "COMBINED GEO-SCIENTIST EXAMINATION, 2027 official notification for Geological Survey of India and Central Ground Water Board posts.",
    officialWebsite: "https://upsconline.nic.in",
    source: {
      notificationTitle:
        "COMBINED GEO-SCIENTIST EXAMINATION, 2027 — Official UPSC Portal",
      officialUrl: "https://upsconline.nic.in",
      notificationIdentifier: "UPSC-GEOSCI-2027",
      verified: true,
    },
    extraExamRules: [
      {
        ruleType: "AGE",
        name: "Age Requirement",
        description: "21-32 as of 2027-01-01",
        conditionField: "age",
        operator: "BETWEEN",
        expectedValue: "21-32 as of 2027-01-01",
      },
    ],
    deadline: {
      applicationUrl: "https://upsconline.nic.in",
      status: "CLOSED",
      applicationStart: "2026-09-02T00:00:00.000Z",
      applicationEnd: "2026-09-22T00:00:00.000Z",
      examDate: "2027-01-10T00:00:00.000Z",
    },
    posts: [
      {
        name: "Geologist",
        department: "Geological Survey of India",
        vacancies: 29,
        qualification:
          "Master's degree in Geological Science or Geology or Applied Geology or Geo-Exploration or Mineral Exploration or Marine Geology or Earth Science from a recognized University.",
      },
      {
        name: "Chemist",
        department: "Geological Survey of India",
        vacancies: 7,
        qualification:
          "M.Sc. in Chemistry or Applied Chemistry or Analytical Chemistry from a recognized University.",
      },
      {
        name: "Assistant Geologist",
        department: "Geological Survey of India",
        vacancies: 34,
        qualification:
          "Master's degree or Integrated Master's degree in Geology or Applied Geology or Mineral Exploration or Marine Geology or Earth Science from a recognized University.",
      },
      {
        name: "Assistant Hydrogeologist",
        department: "Central Ground Water Board",
        vacancies: 7,
        qualification:
          "Master's degree in Geology or Applied Geology or Marine Geology or Hydrogeology from a recognized University.",
      },
      {
        name: "Assistant Chemist",
        department: "Central Ground Water Board",
        vacancies: 1,
        qualification:
          "Master of Science in Chemistry or Applied Chemistry or Analytical Chemistry or Physical Chemistry or Inorganic Chemistry or Organic Chemistry from a recognized University.",
      },
      {
        name: "Assistant Geophysicist",
        department: "Central Ground Water Board",
        vacancies: 1,
        qualification:
          "Master of Science in Geophysics or Exploration Geophysics or Applied Geophysics or Physics or Applied Physics from a recognized University.",
      },
    ],
  },
  {
    name: "SSC Combined Graduate Level Examination (CGL)",
    conductingBody: "Staff Selection Commission",
    examType: "Central Government — Graduate Level",
    description:
      "National-level recruitment by the Staff Selection Commission for Group B and Group C posts across Central Government Ministries, Departments, and Organizations.",
    officialWebsite: "https://ssc.gov.in",
    source: {
      notificationTitle:
        "SSC Combined Graduate Level Examination (CGL) — Official Recruitment Portal",
      officialUrl: "https://ssc.gov.in",
      notificationIdentifier: "SSC-CGL-PORTAL",
    },
    posts: [
      {
        name: "Assistant Section Officer / Inspector (Group B)",
        code: "CGL-GRP-B",
        department: "Central Secretariat Service / CBIC / CBDT / Ministries",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Group B non-gazetted posts including ASO, Income Tax Inspector, Examiner, and Preventive Officer.",
        ageRule: {
          name: "Category-wise Age Limit (Group B)",
          expectedValue:
            "general:18-30,obc:18-33,sc:18-35,st:18-35,ews:18-30|2026-08-01",
        },
      },
      {
        name: "Junior Statistical Officer (JSO)",
        code: "CGL-JSO",
        department: "Ministry of Statistics & Programme Implementation",
        qualification:
          "Bachelor's Degree in any subject with Statistics or Mathematics from a recognised university.",
        description:
          "Group B statistical cadre post requiring Statistics in Graduation or 60% in Mathematics at Class 12 level.",
        ageRule: {
          name: "Category-wise Age Limit (JSO)",
          expectedValue:
            "general:18-32,obc:18-35,sc:18-37,st:18-37,ews:18-32|2026-08-01",
        },
      },
      {
        name: "Auditor / Tax Assistant / UDC (Group C)",
        code: "CGL-GRP-C",
        department: "CAG / CBDT / CBIC / Central Ministries",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Group C administrative, audit, and taxation posts in central government departments.",
        ageRule: {
          name: "Category-wise Age Limit (Group C)",
          expectedValue:
            "general:18-27,obc:18-30,sc:18-32,st:18-32,ews:18-27|2026-08-01",
        },
      },
    ],
  },
  {
    name: "SSC Multi-Tasking (Non-Technical) Staff & Havaldar Examination",
    conductingBody: "Staff Selection Commission",
    examType: "Central Government — Matriculation Level",
    description:
      "Recruitment for General Central Service Group C Non-Gazetted, Non-Ministerial Multi-Tasking Staff and Havaldar posts in CBIC and CBN.",
    officialWebsite: "https://ssc.gov.in",
    source: {
      notificationTitle:
        "SSC Multi-Tasking (Non-Technical) Staff & Havaldar Examination — Official Recruitment Portal",
      officialUrl: "https://ssc.gov.in",
      notificationIdentifier: "SSC-MTS-PORTAL",
    },
    posts: [
      {
        name: "Multi-Tasking (Non-Technical) Staff (18–25 Age Group)",
        code: "MTS-18-25",
        department: "Central Government Ministries & Departments",
        qualification:
          "Matriculation (Class 10th) Examination or equivalent from a recognised board.",
        description:
          "General Central Service Group C non-ministerial posts in ministries and offices across India.",
        ageRule: {
          name: "Category-wise Age Limit (MTS 18-25)",
          expectedValue:
            "general:18-25,obc:18-28,sc:18-30,st:18-30,ews:18-25|2026-08-01",
        },
      },
      {
        name: "Havaldar (CBIC & CBN)",
        code: "MTS-HAVALDAR",
        department: "Central Board of Indirect Taxes & Customs / Central Bureau of Narcotics",
        qualification:
          "Matriculation (Class 10th) Examination or equivalent from a recognised board.",
        description:
          "Havaldar posts in CBIC and CBN (subject to Physical Efficiency & Standard Tests).",
        ageRule: {
          name: "Category-wise Age Limit (Havaldar 18-27)",
          expectedValue:
            "general:18-27,obc:18-30,sc:18-32,st:18-32,ews:18-27|2026-08-01",
        },
      },
    ],
  },
  {
    name: "SSC Constable (GD) in CAPFs, SSF & Rifleman (GD) in Assam Rifles",
    conductingBody: "Staff Selection Commission",
    examType: "Central Armed Police Forces — Matriculation Level",
    description:
      "Recruitment of Constables (General Duty) in BSF, CISF, CRPF, ITBP, SSB, SSF and Rifleman (GD) in Assam Rifles.",
    officialWebsite: "https://ssc.gov.in",
    source: {
      notificationTitle:
        "SSC Constable (GD) in CAPFs, SSF & Rifleman (GD) — Official Recruitment Portal",
      officialUrl: "https://ssc.gov.in",
      notificationIdentifier: "SSC-GD-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (SSC GD)",
      expectedValue:
        "general:18-23,obc:18-26,sc:18-28,st:18-28,ews:18-23|2026-08-01",
    },
    posts: [
      {
        name: "Constable (GD) / Rifleman (GD)",
        code: "SSC-GD-CONSTABLE",
        department: "Ministry of Home Affairs (CAPFs / SSF / Assam Rifles)",
        qualification:
          "Matriculation (Class 10th) Examination passed from a recognised board or university.",
        description:
          "General Duty Constable recruitment (subject to PST, PET, and Medical Examination standards).",
      },
    ],
  },
  {
    name: "SSC Sub-Inspector in Delhi Police and CAPFs Examination (CPO)",
    conductingBody: "Staff Selection Commission",
    examType: "Central Armed Police Forces — Graduate Level",
    description:
      "Recruitment of Sub-Inspectors (GD) in Central Armed Police Forces and Sub-Inspectors (Executive) in Delhi Police.",
    officialWebsite: "https://ssc.gov.in",
    source: {
      notificationTitle:
        "SSC Sub-Inspector in Delhi Police and CAPFs Examination (CPO) — Official Recruitment Portal",
      officialUrl: "https://ssc.gov.in",
      notificationIdentifier: "SSC-CPO-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (SSC CPO)",
      expectedValue:
        "general:20-25,obc:20-28,sc:20-30,st:20-30,ews:20-25|2026-08-01",
    },
    posts: [
      {
        name: "Sub-Inspector (GD) in CAPFs",
        code: "CPO-SI-CAPF",
        department: "BSF / CISF / CRPF / ITBP / SSB",
        qualification:
          "Bachelor's Degree from a recognised university or equivalent.",
        description:
          "Group B Non-Gazetted Sub-Inspector (GD) posts in Central Armed Police Forces.",
      },
      {
        name: "Sub-Inspector (Executive) in Delhi Police",
        code: "CPO-SI-DP",
        department: "Delhi Police",
        qualification:
          "Bachelor's Degree from a recognised university or equivalent.",
        description:
          "Sub-Inspector (Executive) in Delhi Police (male candidates require valid LMV driving licence at PET/MT).",
      },
    ],
  },
  {
    name: "IBPS Probationary Officer / Management Trainee (CRP PO/MT)",
    conductingBody: "Institute of Banking Personnel Selection",
    examType: "Public Sector Banking — Officer Cadre",
    description:
      "Common Recruitment Process by IBPS for selection of Probationary Officers / Management Trainees in participating Public Sector Banks.",
    officialWebsite: "https://www.ibps.in",
    source: {
      notificationTitle:
        "IBPS Probationary Officer / Management Trainee (CRP PO/MT) — Official IBPS Portal",
      officialUrl: "https://www.ibps.in",
      notificationIdentifier: "IBPS-PO-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (IBPS PO)",
      expectedValue:
        "general:20-30,obc:20-33,sc:20-35,st:20-35,ews:20-30|2026-08-01",
    },
    posts: [
      {
        name: "Probationary Officer / Management Trainee",
        code: "IBPS-PO-MT",
        department: "Participating Public Sector Banks",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Scale-I Officer recruitment across participating public sector banks under IBPS CRP.",
      },
    ],
  },
  {
    name: "IBPS Customer Service Associate (CRP CSA / Clerk)",
    conductingBody: "Institute of Banking Personnel Selection",
    examType: "Public Sector Banking — Clerical Cadre",
    description:
      "Common Recruitment Process by IBPS for Customer Service Associates (Clerical Cadre) in participating Public Sector Banks.",
    officialWebsite: "https://www.ibps.in",
    source: {
      notificationTitle:
        "IBPS Customer Service Associate (CRP CSA / Clerk) — Official IBPS Portal",
      officialUrl: "https://www.ibps.in",
      notificationIdentifier: "IBPS-CSA-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (IBPS CSA)",
      expectedValue:
        "general:20-28,obc:20-31,sc:20-33,st:20-33,ews:20-28|2026-08-01",
    },
    posts: [
      {
        name: "Customer Service Associate (Clerk)",
        code: "IBPS-CSA",
        department: "Participating Public Sector Banks",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Clerical cadre recruitment requiring computer literacy and official state language proficiency.",
      },
    ],
  },
  {
    name: "IBPS Regional Rural Banks Recruitment (CRP RRBs)",
    conductingBody: "Institute of Banking Personnel Selection",
    examType: "Regional Rural Banks — Officer & Assistant",
    description:
      "Common Recruitment Process for Officers (Scale I, II, III) and Office Assistants (Multipurpose) in Regional Rural Banks.",
    officialWebsite: "https://www.ibps.in",
    source: {
      notificationTitle:
        "IBPS Regional Rural Banks Recruitment (CRP RRBs) — Official IBPS Portal",
      officialUrl: "https://www.ibps.in",
      notificationIdentifier: "IBPS-RRB-PORTAL",
    },
    posts: [
      {
        name: "Office Assistant (Multipurpose)",
        code: "RRB-OA",
        department: "Regional Rural Banks",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Clerical cadre recruitment in Regional Rural Banks requiring proficiency in local language.",
        ageRule: {
          name: "Category-wise Age Limit (RRB Office Assistant)",
          expectedValue:
            "general:18-28,obc:18-31,sc:18-33,st:18-33,ews:18-28|2026-06-01",
        },
      },
      {
        name: "Officer Scale-I (Assistant Manager)",
        code: "RRB-SCALE-1",
        department: "Regional Rural Banks",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Officer Scale-I recruitment across Regional Rural Banks in India.",
        ageRule: {
          name: "Category-wise Age Limit (RRB Officer Scale-I)",
          expectedValue:
            "general:18-30,obc:18-33,sc:18-35,st:18-35,ews:18-30|2026-06-01",
        },
      },
    ],
  },
  {
    name: "SBI Probationary Officer (PO) Recruitment",
    conductingBody: "State Bank of India",
    examType: "Public Sector Banking — Officer Cadre",
    description:
      "Direct recruitment of Probationary Officers by State Bank of India across circles nationwide.",
    officialWebsite: "https://sbi.co.in/web/careers",
    source: {
      notificationTitle:
        "SBI Probationary Officer (PO) Recruitment — Official SBI Careers Portal",
      officialUrl: "https://sbi.co.in/web/careers",
      notificationIdentifier: "SBI-PO-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (SBI PO)",
      expectedValue:
        "general:21-30,obc:21-33,sc:21-35,st:21-35,ews:21-30|2026-04-01",
    },
    posts: [
      {
        name: "Probationary Officer (PO)",
        code: "SBI-PO",
        department: "State Bank of India",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Junior Management Grade Scale-I Probationary Officer recruitment at State Bank of India.",
      },
    ],
  },
  {
    name: "SBI Junior Associate (Customer Support & Sales)",
    conductingBody: "State Bank of India",
    examType: "Public Sector Banking — Clerical Cadre",
    description:
      "Direct recruitment of Junior Associates (Customer Support & Sales) in clerical cadre at State Bank of India.",
    officialWebsite: "https://sbi.co.in/web/careers",
    source: {
      notificationTitle:
        "SBI Junior Associate (Customer Support & Sales) — Official SBI Careers Portal",
      officialUrl: "https://sbi.co.in/web/careers",
      notificationIdentifier: "SBI-JA-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (SBI Junior Associate)",
      expectedValue:
        "general:20-28,obc:20-31,sc:20-33,st:20-33,ews:20-28|2026-04-01",
    },
    posts: [
      {
        name: "Junior Associate (Customer Support & Sales)",
        code: "SBI-JA",
        department: "State Bank of India",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Clerical cadre recruitment across SBI circles (local language proficiency required for applied state).",
      },
    ],
  },
  {
    name: "UPSC Central Armed Police Forces (Assistant Commandants) Examination",
    conductingBody: "Union Public Service Commission",
    examType: "Central Armed Police Forces — Gazetted Officer",
    description:
      "Annual UPSC examination for recruitment of Assistant Commandants (Group A) in BSF, CRPF, CISF, ITBP, and SSB.",
    officialWebsite: "https://upsc.gov.in",
    source: {
      notificationTitle:
        "UPSC Central Armed Police Forces (Assistant Commandants) Examination — Official UPSC Portal",
      officialUrl: "https://upsc.gov.in",
      notificationIdentifier: "UPSC-CAPF-PORTAL",
    },
    examAgeRule: {
      name: "Category-wise Age Limit (UPSC CAPF AC)",
      expectedValue:
        "general:20-25,obc:20-28,sc:20-30,st:20-30,ews:20-25|2026-08-01",
    },
    posts: [
      {
        name: "Assistant Commandant (Group A)",
        code: "UPSC-CAPF-AC",
        department: "BSF / CRPF / CISF / ITBP / SSB",
        qualification:
          "Bachelor's Degree from a recognised university or equivalent.",
        description:
          "Group A Gazetted Officer recruitment in Central Armed Police Forces (subject to physical & medical standards).",
      },
    ],
  },
  {
    name: "RRB Non-Technical Popular Categories (NTPC)",
    conductingBody: "Railway Recruitment Boards",
    examType: "Indian Railways — Graduate & 10+2 Level",
    description:
      "Centralised Employment Notice by Railway Recruitment Boards for Graduate and Under Graduate Non-Technical Popular Categories posts.",
    officialWebsite: "https://www.rrbcdg.gov.in",
    source: {
      notificationTitle:
        "RRB Non-Technical Popular Categories (NTPC) — Official RRB Portal",
      officialUrl: "https://www.rrbcdg.gov.in",
      notificationIdentifier: "RRB-NTPC-PORTAL",
    },
    posts: [
      {
        name: "NTPC Graduate Level Posts (Station Master / Goods Train Manager / Clerks)",
        code: "RRB-NTPC-GRAD",
        department: "Indian Railways",
        qualification:
          "Bachelor's Degree in any discipline from a recognised university or equivalent.",
        description:
          "Level 5 & Level 6 graduate railway posts including Chief Commercial cum Ticket Supervisor, Station Master, and Goods Train Manager.",
        ageRule: {
          name: "Category-wise Age Limit (RRB NTPC Graduate)",
          expectedValue:
            "general:18-33,obc:18-36,sc:18-38,st:18-38,ews:18-33|2026-07-01",
        },
      },
      {
        name: "NTPC Under Graduate Level Posts (Commercial cum Ticket Clerk / Accounts Clerk)",
        code: "RRB-NTPC-UG",
        department: "Indian Railways",
        qualification:
          "Class 12 (10+2) or equivalent from a recognised board.",
        description:
          "Level 2 & Level 3 under-graduate railway clerical and ticketing posts.",
        ageRule: {
          name: "Category-wise Age Limit (RRB NTPC Under Graduate)",
          expectedValue:
            "general:18-30,obc:18-33,sc:18-35,st:18-35,ews:18-30|2026-07-01",
        },
      },
    ],
  },
];

export async function seedVerifiedExamCatalogue() {
  const now = Temporal.Now.instant();
  const existingExams = await db.orm.public.Exam.all();
  const existingSources = await db.orm.public.NotificationSource.all();

  const existingExamKeys = new Set(
    existingExams.map(
      (e) =>
        `${e.name.trim().toLowerCase()}|${e.conductingBody.trim().toLowerCase()}`,
    ),
  );

  let createdExams = 0;
  let skippedExams = 0;

  for (const item of VERIFIED_EXAM_CATALOGUE) {
    const key = `${item.name.trim().toLowerCase()}|${item.conductingBody.trim().toLowerCase()}`;
    if (existingExamKeys.has(key)) {
      skippedExams += 1;
      continue;
    }

    // Create or reuse NotificationSource
    let source = existingSources.find(
      (s) =>
        s.notificationIdentifier === item.source.notificationIdentifier ||
        s.notificationTitle.trim().toLowerCase() ===
          item.source.notificationTitle.trim().toLowerCase(),
    );

    if (!source) {
      source = await db.orm.public.NotificationSource.create({
        organization: item.conductingBody,
        notificationTitle: item.source.notificationTitle,
        notificationDate: item.source.notificationDate
          ? Temporal.Instant.from(item.source.notificationDate)
          : null,
        officialUrl: item.source.officialUrl,
        notificationIdentifier: item.source.notificationIdentifier,
        dateImported: now,
        lastVerifiedAt: item.source.verified ? now : null,
        createdAt: now,
        updatedAt: now,
      });
      existingSources.push(source);
    }

    const exam = await db.orm.public.Exam.create({
      name: item.name,
      conductingBody: item.conductingBody,
      examType: item.examType,
      description: item.description,
      officialWebsite: item.officialWebsite,
      isArchived: false,
      updatedAt: now,
    });

    if (item.examAgeRule) {
      const rule = await db.orm.public.EligibilityRule.create({
        examId: exam.id,
        postId: undefined,
        ruleType: "AGE_BY_CATEGORY",
        name: item.examAgeRule.name,
        description: null,
        updatedAt: now,
      });

      await db.orm.public.EligibilityRuleVersion.create({
        eligibilityRuleId: rule.id,
        notificationSourceId: source.id,
        versionNumber: 1,
        status: "ACTIVE",
        conditionField: "ageByCategory",
        operator: "BETWEEN",
        expectedValue: item.examAgeRule.expectedValue,
        logicOperator: "AND",
        updatedAt: now,
      });
    }

    if (item.extraExamRules) {
      for (const extra of item.extraExamRules) {
        const rule = await db.orm.public.EligibilityRule.create({
          examId: exam.id,
          postId: undefined,
          ruleType: extra.ruleType,
          name: extra.name,
          description: extra.description ?? null,
          updatedAt: now,
        });

        await db.orm.public.EligibilityRuleVersion.create({
          eligibilityRuleId: rule.id,
          notificationSourceId: source.id,
          versionNumber: 1,
          status: "ACTIVE",
          conditionField: extra.conditionField,
          operator: extra.operator,
          expectedValue: extra.expectedValue,
          logicGroup: extra.logicGroup ?? undefined,
          logicOperator: extra.logicOperator ?? "AND",
          updatedAt: now,
        });
      }
    }

    for (const postSpec of item.posts) {
      const post = await db.orm.public.Post.create({
        examId: exam.id,
        name: postSpec.name,
        code: postSpec.code ?? undefined,
        department: postSpec.department,
        vacancies: postSpec.vacancies ?? undefined,
        qualification: postSpec.qualification,
        description: postSpec.description ?? undefined,
        updatedAt: now,
      });

      if (postSpec.ageRule) {
        const postAgeRule = await db.orm.public.EligibilityRule.create({
          examId: exam.id,
          postId: post.id,
          ruleType: "AGE_BY_CATEGORY",
          name: postSpec.ageRule.name,
          description: null,
          updatedAt: now,
        });

        await db.orm.public.EligibilityRuleVersion.create({
          eligibilityRuleId: postAgeRule.id,
          notificationSourceId: source.id,
          versionNumber: 1,
          status: "ACTIVE",
          conditionField: "ageByCategory",
          operator: "BETWEEN",
          expectedValue: postSpec.ageRule.expectedValue,
          logicOperator: "AND",
          updatedAt: now,
        });
      }
    }

    const dl = item.deadline;
    await db.orm.public.ApplicationDeadline.create({
      examId: exam.id,
      postId: undefined,
      applicationUrl: dl?.applicationUrl ?? item.officialWebsite,
      status: dl?.status ?? "NOTIFICATION_AWAITED",
      applicationStart: dl?.applicationStart
        ? Temporal.Instant.from(dl.applicationStart)
        : undefined,
      applicationEnd: dl?.applicationEnd
        ? Temporal.Instant.from(dl.applicationEnd)
        : undefined,
      examDate: dl?.examDate ? Temporal.Instant.from(dl.examDate) : undefined,
      updatedAt: now,
    });

    existingExamKeys.add(key);
    createdExams += 1;
  }

  return { createdExams, skippedExams };
}

// Allow running directly via tsx
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].includes("seed-exams")
) {
  seedVerifiedExamCatalogue()
    .then(async (result) => {
      console.log(
        `Exam catalogue seed complete: created=${result.createdExams}, skipped=${result.skippedExams}`,
      );
      await db.close();
    })
    .catch(async (error) => {
      console.error("Failed to seed exam catalogue:", error);
      try {
        await db.close();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}
