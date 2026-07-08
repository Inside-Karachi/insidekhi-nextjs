import { Database } from "./supabase";

export type FormSubmission =
  Database["public"]["Tables"]["form_submissions"]["Row"];
export type FormSubmissionImage =
  Database["public"]["Tables"]["form_submission_images"]["Row"];
export type FormSubmissionReply =
  Database["public"]["Tables"]["form_submission_replies"]["Row"];
export type FormReplyTemplate =
  Database["public"]["Tables"]["form_reply_templates"]["Row"];

export interface FormSubmissionWithAssets extends FormSubmission {
  images?: FormSubmissionImage[];
  attachmentsCount?: number;
  thumbnailUrl?: string | null;
}

export interface FormSubmissionReplyWithStaff extends FormSubmissionReply {
  staff_name?: string | null;
  staff_username?: string | null;
  staff_avatar?: string | null;
}

export interface FormTypeSummary {
  formType: string;
  total: number;
  pending: number;
  lastSubmittedAt: string | null;
}

export interface FormsOverviewTotals {
  overall: number;
  pending: number;
  last24Hours: number;
}

export interface FormsOverviewData {
  totals: FormsOverviewTotals;
  byType: FormTypeSummary[];
  latest: FormSubmissionWithAssets[];
}

export interface FormsApiResponse {
  success: boolean;
  submissions: FormSubmissionWithAssets[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  formTypes: string[];
  statusCounts: Record<string, number>;
  metrics: FormsOverviewTotals;
}

export interface SendReplyPayload {
  submissionId: number;
  replyText: string;
  emailSubject: string;
  newStatus?: string;
  previousStatus?: string;
}

export interface SendReplyResponse {
  success: boolean;
  reply?: FormSubmissionReplyWithStaff;
  error?: string;
}
