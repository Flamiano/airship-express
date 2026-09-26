import type { ProviderName } from "../config";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  provider?: ProviderName;
  error?: boolean;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  type: "image";
  url: string;
  label?: string;
  downloadUrl?: string;
  printUrl?: string;
}

export interface LLMRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  context?: PayrollContext;
  employeeId?: string;
  adminContext?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface LLMResponse {
  content: string;
  provider: ProviderName;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  attachment?: MessageAttachment;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  attachment?: MessageAttachment;
}

export interface PayrollContext {
  employee?: {
    id: string;
    name: string;
    idNumber: string;
    department: string;
    jobTitle: string;
  };
  payslip?: {
    periodStart: string;
    periodEnd: string;
    basicPay: number;
    grossPay: number;
    netPay: number;
    deductions: {
      sss: number;
      philHealth: number;
      pagIbig: number;
      withholdingTax: number;
    };
  };
  runs?: Array<{
    id: number;
    periodStart: string;
    periodEnd: string;
    status: string;
    totalNetPay: number;
  }>;
}

export type AiryBlock =
  | {
      kind: "heading";
      text: string;
    }
  | {
      kind: "summary";
      items: Array<{
        label: string;
        value: string;
        tint?: "default" | "warning" | "danger" | "success";
      }>;
    }
  | {
      kind: "employee_table";
      items: Array<{
        name: string;
        employee_id_number: string;
        position: string | null;
        department: string | null;
        warnings: Array<"missing_bank" | "missing_birthdate">;
      }>;
    }
  | {
      kind: "run_table";
      items: Array<{
        id: number;
        period_start: string;
        period_end: string;
        approval_status: string;
        note?: string | null;
      }>;
    }
  | {
      kind: "top_rated_table";
      items: Array<{
        name: string;
        employee_id_number: string;
        department: string | null;
        rating: number;
        letter_grade: string | null;
      }>;
    }
  | {
      kind: "link";
      label: string;
      full: string;
      href: string;
      allowed: boolean;
      reason?: string;
    }
  | {
      kind: "text";
      text: string;
    };

export interface AiryStructuredReply {
  text: string;
  blocks?: AiryBlock[];
  attachment?: MessageAttachment;
  forceLogout?: boolean;
  accessDenied?: boolean;
  redirectTo?: string;
}

export interface AIInsight {
  id?: string;
  severity: "info" | "warning" | "critical" | "low" | "medium" | "high";
  title: string;
  message?: string;
  description?: string;
  category?: string;
  recommendation?: string;
  affectedEmployees?: string[];
  affectedRecords?: Array<Record<string, unknown>>;
  metric?: string;
  value?: number | string;
  threshold?: number | string;
  createdAt?: string;
}

export interface AIInsight {
  id?: string;
  severity: "info" | "warning" | "critical" | "low" | "medium" | "high";
  title: string;
  message?: string;
  description?: string;
  category?: string;
  recommendation?: string;
  affectedEmployees?: string[];
  affectedRecords?: Array<Record<string, unknown>>;
  metric?: string;
  value?: number | string;
  threshold?: number | string;
  createdAt?: string;
}