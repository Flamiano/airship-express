import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import type { OptimizeRequest, OptimizeResponse } from "../optimize";

const PYTHON_TIMEOUT_MS = 25_000;
const INTERNAL_TIMEOUT_MS = 55_000;
const MAX_STDOUT_CHARS = 2_000_000;

type OptimizerFailure = Error & { status?: number; details?: unknown; upstreamStatus?: number };

function optimizerError(message: string, status: number, details?: unknown, upstreamStatus?: number): OptimizerFailure {
  return Object.assign(new Error(message), { status, details, upstreamStatus });
}

function validateSolverResponse(value: unknown): OptimizeResponse {
  if (!value || typeof value !== "object") throw optimizerError("Python OR-Tools returned an invalid response.", 502);
  const result = value as Partial<OptimizeResponse>;
  if (result.engine !== "or-tools") {
    throw optimizerError(`Python solver did not confirm an OR-Tools solve (engine=${String(result.engine)}).`, 502, value);
  }
  if (!Array.isArray(result.orderedStopIds) || !Array.isArray(result.routes)) {
    throw optimizerError("Python OR-Tools response is missing route results.", 502, value);
  }
  if (!Number.isFinite(result.distanceMi) || !Number.isFinite(result.etaMinutes)) {
    throw optimizerError("Python OR-Tools response contains invalid route metrics.", 502, value);
  }
  return result as OptimizeResponse;
}

async function runBoundPythonService(payload: OptimizeRequest, baseUrl: string): Promise<unknown> {
  const sharedSecret = process.env.FTM_ORTOOLS_SHARED_SECRET;
  if (!sharedSecret) {
    throw optimizerError("The FTM Python optimizer credential is not configured.", 503);
  }

  let endpoint: URL;
  try {
    endpoint = new URL("optimize-route", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  } catch {
    throw optimizerError("The internal FTM Python service binding is invalid.", 500);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${sharedSecret}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw optimizerError(
      timedOut ? `Colocated Python OR-Tools function timed out after ${INTERNAL_TIMEOUT_MS} ms.` : "Could not reach the colocated Python OR-Tools function.",
      timedOut ? 504 : 502,
      error instanceof Error ? error.message : String(error)
    );
  }

  const responseText = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(responseText);
  } catch {
    throw optimizerError(`Python OR-Tools returned invalid JSON (HTTP ${response.status}).`, 502, responseText.slice(0, 2000), response.status);
  }
  if (!response.ok) {
    const detail = (body as { detail?: unknown; error?: unknown } | null)?.detail
      || (body as { error?: unknown } | null)?.error
      || response.statusText;
    throw optimizerError(`Python OR-Tools returned HTTP ${response.status}: ${String(detail)}`, 502, body, response.status);
  }
  return body;
}

function runLocalPythonSolver(payload: OptimizeRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "app", "(ftm)", "lib", "server", "python", "optimize.py");
    const pythonCommand = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "py" : "python3");
    const pythonArgs = process.platform === "win32" && !process.env.PYTHON_EXECUTABLE
      ? ["-3", scriptPath]
      : [scriptPath];
    const processRunner = spawn(pythonCommand, pythonArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      processRunner.kill();
      finish(optimizerError(`Local Python OR-Tools process timed out after ${PYTHON_TIMEOUT_MS} ms.`, 504));
    }, PYTHON_TIMEOUT_MS);

    processRunner.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_STDOUT_CHARS) {
        processRunner.kill();
        finish(optimizerError("Local Python OR-Tools response exceeded the size limit.", 502));
      }
    });
    processRunner.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > MAX_STDOUT_CHARS) stderr = stderr.slice(-MAX_STDOUT_CHARS);
    });
    processRunner.on("error", (error) => {
      finish(optimizerError("Unable to start Python for route optimization. Install Python and the requirements in app/(ftm)/lib/server/python/requirements.txt, or set PYTHON_EXECUTABLE.", 503, error.message));
    });
    processRunner.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const stderrOutput = stderr.trim();
        if (/Application Control policy has blocked this file/i.test(stderrOutput)) {
          finish(optimizerError(
            "Windows Application Control blocked the OR-Tools native library. Ask your administrator to approve the runtime or configure an approved FTM optimizer service.",
            503,
            "Application Control blocked the OR-Tools native library."
          ));
          return;
        }
        finish(optimizerError(`Local Python OR-Tools exited with code ${code}.`, 502, stderrOutput || "No stderr output."));
        return;
      }
      try {
        finish(undefined, JSON.parse(stdout));
      } catch (error) {
        finish(optimizerError("Local Python OR-Tools returned invalid JSON.", 502, `${error instanceof Error ? error.message : String(error)}; stderr=${stderr.trim()}`));
      }
    });

    processRunner.stdin.on("error", (error) => {
      finish(optimizerError("Could not send the route request to Python OR-Tools.", 502, error.message));
    });
    processRunner.stdin.end(JSON.stringify(payload));
  });
}

export async function runFtmPythonOptimizer(payload: OptimizeRequest): Promise<OptimizeResponse> {
  if (!Array.isArray(payload.stops) || payload.stops.length === 0) {
    throw optimizerError("At least one valid stop is required for OR-Tools optimization.", 400);
  }

  try {
    const bindingUrl = process.env.FTM_INTERNAL_ORTOOLS_URL;
    const result = bindingUrl
      ? await runBoundPythonService(payload, bindingUrl)
      : process.env.VERCEL
        ? (() => { throw optimizerError("The colocated FTM Python service binding is missing from this Vercel deployment.", 503); })()
        : await runLocalPythonSolver(payload);
    return validateSolverResponse(result);
  } catch (error) {
    const failure = error as OptimizerFailure;
    console.error("[ftm-python-optimizer] Optimization failed", {
      message: failure.message || String(error),
      status: failure.status,
      upstreamStatus: failure.upstreamStatus,
      details: failure.details,
    });
    throw error;
  }
}
