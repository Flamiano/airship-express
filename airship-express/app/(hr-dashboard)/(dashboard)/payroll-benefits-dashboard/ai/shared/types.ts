import type { ProviderName } from "../config";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  provider?: ProviderName;
  error?: boolean;
}

export interface LLMRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
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
}

export interface StreamChunk {
  delta: string;
  done: boolean;
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

export interface AIInsight {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export interface MessageAttachment {
  type: "image";
  url: string;
  label?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  provider?: ProviderName;
  error?: boolean;
  attachments?: MessageAttachment[];
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  attachment?: MessageAttachment;
}

export interface LLMRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  context?: PayrollContext;
  employeeId?: string;
}
