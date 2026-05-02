export type ActivityKey = 'act5' | 'act6' | 'act7' | 'act8' | 'act9' | 'final';
export type SubmissionStatus = 'pending' | 'pass' | 'resubmit' | 'oral' | 'missing';
export type Remark = 'deviated_scope' | 'missing_code' | 'github_404' | 'went_overboard';

export interface Student {
  id: string;
  lastname: string;
  firstname: string;
  created_at: string;
}

export interface Submission {
  id: string;
  student_id: string;
  activity_key: ActivityKey;
  status: SubmissionStatus;
  remarks: Remark[];
  updated_at: string;
}

export const ACTIVITIES: ActivityKey[] = ['act5', 'act6', 'act7', 'act8', 'act9', 'final'];

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  pass: 'Pass',
  resubmit: 'Resubmit',
  oral: 'Oral Defense',
  missing: 'Missing',
};

export const REMARK_LABELS: Record<Remark, string> = {
  deviated_scope: 'Deviated from scope',
  missing_code: 'Missing required code',
  github_404: 'GitHub link 404',
  went_overboard: 'Went overboard (Check for AI/Plagiarism)',
};
