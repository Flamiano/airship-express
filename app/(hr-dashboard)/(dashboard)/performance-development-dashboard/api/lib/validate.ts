import { NextResponse } from "next/server";
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  type ErrorCode,
  type ErrorResponseBody,
  type FieldError,
} from "./errors";

export { ERROR_CODES, type ErrorCode, type FieldError };

export type { ErrorResponseBody };

export type Rule =
  | {
      type: "string";
      optional?: boolean;
      min?: number;
      max?: number;
      enum?: readonly string[];
    }
  | {
      type: "number";
      optional?: boolean;
      integer?: boolean;
      min?: number;
      max?: number;
    }
  | { type: "boolean"; optional?: boolean }
  | { type: "uuid"; optional?: boolean }
  | { type: "date"; optional?: boolean }
  | { type: "array"; optional?: boolean; max?: number; item?: Schema };

export type Schema = Record<string, Rule>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateRecord(
  record: Record<string, unknown>,
  schema: Schema,
  prefix = ""
): FieldError[] {
  const errors: FieldError[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const path = prefix ? `${prefix}.${field}` : field;
    const value = record[field];
    const present = value !== undefined && value !== null;

    if (!present) {
      if (!rule.optional) {
        errors.push({ field: path, message: `${path} is required` });
      }
      continue;
    }

    switch (rule.type) {
      case "string": {
        if (typeof value !== "string") {
          errors.push({ field: path, message: `${path} must be a string` });
          break;
        }
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push({
            field: path,
            message: `${path} must be at least ${rule.min} characters`,
          });
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push({
            field: path,
            message: `${path} must be at most ${rule.max} characters`,
          });
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push({
            field: path,
            message: `${path} must be one of: ${rule.enum.join(", ")}`,
          });
        }
        break;
      }
      case "number": {
        if (typeof value !== "number" || Number.isNaN(value)) {
          errors.push({ field: path, message: `${path} must be a number` });
          break;
        }
        if (rule.integer && !Number.isInteger(value)) {
          errors.push({ field: path, message: `${path} must be an integer` });
        }
        if (rule.min !== undefined && value < rule.min) {
          errors.push({ field: path, message: `${path} must be at least ${rule.min}` });
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push({ field: path, message: `${path} must be at most ${rule.max}` });
        }
        break;
      }
      case "boolean": {
        if (typeof value !== "boolean") {
          errors.push({ field: path, message: `${path} must be a boolean` });
        }
        break;
      }
      case "uuid": {
        if (typeof value !== "string" || !UUID_RE.test(value)) {
          errors.push({ field: path, message: `${path} must be a valid UUID` });
        }
        break;
      }
      case "date": {
        if (typeof value !== "string" || !DATE_RE.test(value)) {
          errors.push({
            field: path,
            message: `${path} must be a date in YYYY-MM-DD format`,
          });
          break;
        }
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (
          date.getUTCFullYear() !== year ||
          date.getUTCMonth() !== month - 1 ||
          date.getUTCDate() !== day
        ) {
          errors.push({ field: path, message: `${path} must be a valid date` });
        }
        break;
      }
      case "array": {
        if (!Array.isArray(value)) {
          errors.push({ field: path, message: `${path} must be an array` });
          break;
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push({
            field: path,
            message: `${path} must have at most ${rule.max} items`,
          });
        }
        if (rule.item) {
          value.forEach((item, index) => {
            if (item === null || typeof item !== "object" || Array.isArray(item)) {
              errors.push({
                field: `${path}[${index}]`,
                message: "must be an object",
              });
              return;
            }
            errors.push(
              ...validateRecord(item as Record<string, unknown>, rule.item!, `${path}[${index}]`)
            );
          });
        }
        break;
      }
    }
  }

  return errors;
}

export function validate(body: unknown, schema: Schema): FieldError[] {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return [{ field: "body", message: "Request body must be a JSON object" }];
  }
  return validateRecord(body as Record<string, unknown>, schema);
}

export function validateQuery(url: string, schema: Schema): FieldError[] {
  const params = new URL(url).searchParams;
  const record: Record<string, unknown> = {};
  for (const key of params.keys()) {
    record[key] = params.get(key);
  }
  return validateRecord(record, schema);
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: FieldError[],
  requestId?: string
): NextResponse {
  const status = ERROR_HTTP_STATUS[code];
  const body: ErrorResponseBody = { code, error: message };
  if (details) body.details = details;
  if (requestId) body.request_id = requestId;
  return NextResponse.json(body, { status });
}

export function validationResponse(errors: FieldError[]): NextResponse {
  const summary = errors.map((e) => e.message).join("; ");
  return errorResponse(ERROR_CODES.VALIDATION_ERROR, summary || "Validation failed", errors);
}

export function internalError(cause: unknown): NextResponse {
  const requestId = crypto.randomUUID();
  console.error(`[performance-development] request ${requestId} failed:`, cause);
  return errorResponse(
    ERROR_CODES.INTERNAL_ERROR,
    "An unexpected server error occurred.",
    undefined,
    requestId
  );
}

export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse> | NextResponse
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (cause) {
      return internalError(cause);
    }
  };
}

export type ValidatedJson =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: NextResponse };

export async function validateJson(
  request: Request,
  schema: Schema
): Promise<ValidatedJson> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: errorResponse(ERROR_CODES.INVALID_JSON, "Invalid JSON body"),
    };
  }

  const errors = validate(body, schema);
  if (errors.length > 0) {
    return { ok: false, response: validationResponse(errors) };
  }

  return { ok: true, value: body as Record<string, unknown> };
}
