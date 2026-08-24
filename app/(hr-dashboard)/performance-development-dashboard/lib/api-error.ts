import {
  ERROR_CODES,
  type ErrorCode,
  type ErrorResponseBody,
  type FieldError,
} from "@/app/(hr-dashboard)/performance-development-dashboard/api/lib/errors";

export { ERROR_CODES, type ErrorCode, type FieldError };

export type UnknownCode = "UNKNOWN";

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

export function fieldError(err: ApiError, field: string): string | undefined {
  return err.fieldErrors.find((f) => f.field === field)?.message;
}

export function apiErrorMessage(err: ApiError): string {
  switch (err.code) {
    case ERROR_CODES.UNAUTHENTICATED:
      return err.message || "Please sign in to continue.";
    case ERROR_CODES.FORBIDDEN:
      return err.message || "You don't have permission to do that.";
    case ERROR_CODES.NOT_FOUND:
      return err.message || "The requested item was not found.";
    case ERROR_CODES.CONFLICT:
      return err.message || "This action conflicts with existing data.";
    case ERROR_CODES.EMPLOYEE_PROFILE_REQUIRED:
      return (
        err.message ||
        "Your account is not linked to an employee profile yet. Contact HR."
      );
    case ERROR_CODES.VALIDATION_ERROR:
      return err.message || "Please correct the highlighted fields.";
    default:
      return err.message || "An unexpected error occurred. Please try again.";
  }
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return apiErrorMessage(err);
  return err instanceof Error ? err.message : fallback;
}
