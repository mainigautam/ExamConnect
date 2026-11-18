export type LoggedInUser = {
  id: number;
  email: string;
  role: string;
};

export type ProfileCompletion = {
  percentage: number;
  missingFields: string[];
};

export type StudentProfile = {
  id: number;
  userId: number;
  email?: string;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  state: string | null;
  category: string | null;
};

export type EducationRecord = {
  id: number;
  studentProfileId: number;
  qualification: string;
  courseName: string | null;
  institutionName: string | null;
  boardOrUniversity: string | null;
  passingYear: number | null;
  percentage: number | null;
  stream: string | null;
};

export type Deadline = {
  id: number;
  postId?: number | null;
  applicationUrl: string | null;
  status: string;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
};

export type Source = {
  id: number;
  organization: string;
  notificationTitle: string;
  notificationDate: string | null;
  officialUrl: string;
  notificationIdentifier: string | null;
  dateImported: string;
  lastVerifiedAt: string | null;
};

export type RuleEvaluation = {
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

export type ExamResult = {
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
  saved?: boolean;
  reasons: string[];
  ruleEvaluations?: RuleEvaluation[];
  sources: Source[];
  deadlines: Deadline[];
};

export type GroupedExam = {
  exam: ExamResult["exam"];
  posts: ExamResult[];
  eligible: boolean;
  eligiblePostCount: number;
  ineligiblePostCount: number;
  saved: boolean;
  primaryStatus: string;
  earliestEndTimestamp: number | null;
  sources: Source[];
  deadlines: Deadline[];
};

export type StudentNotification = {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  examId: number | null;
  postId: number | null;
  deadlineId: number | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};
