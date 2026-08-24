"use client";

import { useState } from "react";
import Button from "@/app/(hr-dashboard)/performance-development-dashboard/components/Button";
import {
  inputClass,
  selectClass,
  textareaClass,
  errorTextClass,
} from "@/app/(hr-dashboard)/performance-development-dashboard/components/formStyles";
import {
  ApiError,
  readApiError,
} from "@/app/(hr-dashboard)/performance-development-dashboard/lib/api-error";
import { toast } from "sonner";

type GoalFormProps = {
  onGoalCreated: () => void;
};

export default function GoalForm({ onGoalCreated }: GoalFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("individual");
  const [priority, setPriority] = useState("medium");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    try {
      const res = await fetch("/performance-development-dashboard/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          priority,
          target,
          due_date: dueDate || null,
        }),
      });

      if (!res.ok) {
        throw await readApiError(res, "Failed to create goal");
      }

      setTitle("");
      setDescription("");
      setTarget("");
      setDueDate("");
      onGoalCreated();
      toast.success("Goal created successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message]))
        );
        toast.error(
          err.fieldErrors.length > 0
            ? "Failed to create goal. Please check the form and try again."
            : "Failed to create goal. Please try again."
        );
      } else {
        toast.error("Failed to create goal. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex max-w-md flex-col gap-3">
      <input
        type="text"
        placeholder="Goal title"
        aria-label="Goal title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={inputClass}
      />
      {fieldErrors.title && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.title}
        </p>
      )}
      <textarea
        placeholder="Description (optional)"
        aria-label="Goal description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className={textareaClass}
      />
      {fieldErrors.description && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.description}
        </p>
      )}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Goal category"
        className={selectClass}
      >
        <option value="individual">Individual</option>
        <option value="department">Department</option>
        <option value="company">Company</option>
      </select>
      <div className="flex gap-3">
        <input
          type="date"
          aria-label="Due date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        {fieldErrors.due_date && (
          <p className={errorTextClass} role="alert">
            {fieldErrors.due_date}
          </p>
        )}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Priority"
          className={selectClass}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <input
        type="text"
        placeholder="Target (e.g. 25 packages/day)"
        aria-label="Goal target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={inputClass}
      />
      {fieldErrors.target && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.target}
        </p>
      )}
      <Button type="submit" loading={submitting}>
        {submitting ? "Saving…" : "Create Goal"}
      </Button>
    </form>
  );
}
