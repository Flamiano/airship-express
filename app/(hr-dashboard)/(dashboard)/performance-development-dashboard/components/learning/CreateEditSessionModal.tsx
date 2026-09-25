"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Tooltip } from "@/performance-development-dashboard/components/ui/Tooltip";
import { Modal } from "@/performance-development-dashboard/components/ui/Modal";
import {
  PerformanceButton,
  PerformanceDialogPanel,
  PerformanceField,
  PerformanceSelect,
  PerformanceTextInput,
} from "@/performance-development-dashboard/components/ui/performance";
import type { TrainingSession, TrainingSessionInput } from "@/performance-development-dashboard/types";
import { MAX_SESSION_TITLE_LENGTH, MAX_SHORT_TEXT_LENGTH } from "@/performance-development-dashboard/lib/constants";

const SESSION_TYPE_PRESETS = ["development", "compliance", "onboarding", "other"];

type Props = {
  session: TrainingSession | null;
  competenciesById: Record<string, string>;
  submitting: boolean;
  onSubmit: (input: TrainingSessionInput) => Promise<void>;
  onClose: () => void;
};

export function CreateEditSessionModal({
  session,
  competenciesById,
  submitting,
  onSubmit,
  onClose,
}: Props) {
  const [title, setTitle] = useState(session?.title ?? "");
  const [trainerName, setTrainerName] = useState(session?.trainer_name ?? "");
  const [trainerType, setTrainerType] = useState(session?.trainer_type ?? "");
  const [mode, setMode] = useState(session?.mode ?? "");
  const [venue, setVenue] = useState(session?.venue ?? "");
  const [scheduleDate, setScheduleDate] = useState(
    session?.schedule_date ? session.schedule_date.slice(0, 16) : ""
  );
  const [capacity, setCapacity] = useState<number | null>(
    session?.capacity ?? null
  );
  const [cost, setCost] = useState<number | null>(session?.cost ?? null);
  const [status, setStatus] = useState(session?.status ?? "scheduled");
  const [sessionType, setSessionType] = useState(
    session?.session_type ?? "development"
  );
  const [competencyId, setCompetencyId] = useState(
    session?.competency_id ?? ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  const competencyOptions = Object.entries(competenciesById).map(
    ([id, name]) => ({ id, name })
  );

  function parseScheduleDate(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Session title is required.");
      return;
    }

    const scheduleIso = parseScheduleDate(scheduleDate);
    const sessionTypeValue = (sessionType.trim() || "development").toLowerCase();
    if (sessionTypeValue.length > MAX_SHORT_TEXT_LENGTH) {
      setFormError(`Session type must be at most ${MAX_SHORT_TEXT_LENGTH} characters.`);
      return;
    }

    const submittedInput: TrainingSessionInput = {
      title: trimmedTitle,
      trainer_name: trainerName.trim() || null,
      trainer_type: trainerType.trim() || null,
      mode: mode.trim() || null,
      venue: venue.trim() || null,
      schedule_date: scheduleIso,
      capacity,
      cost,
      status: (status.trim() || "scheduled").toLowerCase() as string,
      session_type: sessionTypeValue,
      competency_id: competencyId || null,
    };

    try {
      await onSubmit(submittedInput);
      setTitle("");
      setTrainerName("");
      setTrainerType("");
      setMode("");
      setVenue("");
      setScheduleDate("");
      setCapacity(null);
      setCost(null);
      setStatus("scheduled");
      setSessionType("development");
      setCompetencyId("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save session."
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      closeDisabled={submitting}
      labelledBy="create-edit-session-modal-title"
    >
      <PerformanceDialogPanel labelledBy="create-edit-session-modal-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">
              Performance development
            </p>
            <h2
              id="create-edit-session-modal-title"
              className="mt-1 font-bricolage text-[20px] font-medium tracking-tight text-ink"
            >
              {session ? "Edit training session" : "New training session"}
            </h2>
          </div>
          <Tooltip label="Close" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/[0.08] hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <PerformanceField label="Title" htmlFor="session-title">
              <PerformanceTextInput
                id="session-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_SESSION_TITLE_LENGTH}
                placeholder="e.g. Defensive Driving Refresher"
                disabled={submitting}
              />
            </PerformanceField>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted">
              {title.length}/{MAX_SESSION_TITLE_LENGTH}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PerformanceField label="Status" htmlFor="session-status">
              <PerformanceTextInput
                id="session-status"
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                maxLength={MAX_SHORT_TEXT_LENGTH}
                placeholder="scheduled"
                disabled={submitting}
              />
            </PerformanceField>

            <PerformanceField label="Session type" htmlFor="session-type">
              <PerformanceSelect
                id="session-type"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                disabled={submitting}
              >
                {SESSION_TYPE_PRESETS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </PerformanceSelect>
            </PerformanceField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PerformanceField
              label="Trainer"
              htmlFor="session-trainer"
              optional
            >
              <PerformanceTextInput
                id="session-trainer"
                type="text"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                maxLength={MAX_SESSION_TITLE_LENGTH}
                placeholder="e.g. Marcus Rivera"
                disabled={submitting}
              />
            </PerformanceField>

            <PerformanceField
              label="Trainer type"
              htmlFor="session-trainer-type"
              optional
            >
              <PerformanceTextInput
                id="session-trainer-type"
                type="text"
                value={trainerType}
                onChange={(e) => setTrainerType(e.target.value)}
                maxLength={MAX_SHORT_TEXT_LENGTH}
                placeholder="internal / external"
                disabled={submitting}
              />
            </PerformanceField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PerformanceField label="Mode" htmlFor="session-mode" optional>
              <PerformanceTextInput
                id="session-mode"
                type="text"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                maxLength={MAX_SHORT_TEXT_LENGTH}
                placeholder="in_person / virtual"
                disabled={submitting}
              />
            </PerformanceField>

            <PerformanceField label="Venue" htmlFor="session-venue" optional>
              <PerformanceTextInput
                id="session-venue"
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                maxLength={MAX_SESSION_TITLE_LENGTH}
                placeholder="HQ Training Room 2"
                disabled={submitting}
              />
            </PerformanceField>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <PerformanceField
              label="Schedule"
              htmlFor="session-date"
              optional
            >
              <PerformanceTextInput
                id="session-date"
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                disabled={submitting}
              />
            </PerformanceField>

            <PerformanceField
              label="Capacity"
              htmlFor="session-capacity"
              optional
            >
              <PerformanceTextInput
                id="session-capacity"
                type="number"
                min={0}
                value={capacity ?? ""}
                onChange={(e) =>
                  setCapacity(e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="20"
                disabled={submitting}
              />
            </PerformanceField>

            <PerformanceField label="Cost" htmlFor="session-cost" optional>
              <PerformanceTextInput
                id="session-cost"
                type="number"
                min={0}
                step="any"
                value={cost ?? ""}
                onChange={(e) =>
                  setCost(e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="500"
                disabled={submitting}
              />
            </PerformanceField>
          </div>

          <PerformanceField
            label="Linked competency"
            htmlFor="session-competency"
            hint="Optional reference only — attendance never changes a competency level."
          >
            <PerformanceSelect
              id="session-competency"
              value={competencyId}
              onChange={(e) => setCompetencyId(e.target.value)}
              disabled={submitting}
            >
              <option value="">None</option>
              {competencyOptions.map((competency) => (
                <option key={competency.id} value={competency.id}>
                  {competency.name}
                </option>
              ))}
            </PerformanceSelect>
          </PerformanceField>

          {formError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-[12.5px] font-medium text-red-600">
                {formError}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <PerformanceButton
              variant="ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </PerformanceButton>
            <PerformanceButton type="submit" disabled={submitting}>
              {submitting
                ? "Saving..."
                : session
                  ? "Save changes"
                  : "Create session"}
            </PerformanceButton>
          </div>
        </form>
      </PerformanceDialogPanel>
    </Modal>
  );
}
