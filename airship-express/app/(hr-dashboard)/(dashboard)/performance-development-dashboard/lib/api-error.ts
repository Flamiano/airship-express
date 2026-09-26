import {
  type ErrorCode,
  type ErrorResponseBody,
  type FieldError,
} from "@/app/(hr-dashboard)/(dashboard)/performance-development-dashboard/api/lib/errors";

type UnknownCode = "UNKNOWN";

export class ApiError extends Error {
  readonly code: ErrorCode | UnknownCode;
  readonly status: number;
  readonly requestId?: string;
  readonly fieldErrors: FieldError[];

  constructor(
    options: {
      code: ErrorCode | UnknownCode;
      status: number;
      message: string;
      requestId?: string;
      fieldErrors?: FieldError[];
    }
  ) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.fieldErrors = options.fieldErrors ?? [];
  }
}

export async function readApiError(
  res: Response,
  fallback: string
): Promise<ApiError> {
  let body: Partial<ErrorResponseBody> | null = null;
  try {
    body = (await res.json()) as Partial<ErrorResponseBody> | null;
  } catch {
    body = null;
  }

  return new ApiError({
    code: body?.code ?? "UNKNOWN",
    status: res.status,
    message: body?.error ?? fallback,
    requestId: body?.request_id,
    fieldErrors: Array.isArray(body?.details)
      ? (body.details as FieldError[])
      : [],
  });
}
