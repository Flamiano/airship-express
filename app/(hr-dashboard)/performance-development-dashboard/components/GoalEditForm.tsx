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

type Goal = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string | null;
  target: string | null;
  due_date: string | null;
  status: string;
};

type GoalEditFormProps = {
  goal: Goal;
  onSaved: () => void;
  onCancel: () => void;
};

export default function GoalEditForm({
  goal,
  onSaved,
  onCancel,
}: GoalEditFormProps) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? "");
  const [category, setCategory] = useState(goal.category ?? "individual");
  const [priority, setPriority] = useState(goal.priority ?? "medium");
  const [target, setTarget] = useState(goal.target ?? "");
  const [dueDate, setDueDate] = useState(goal.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    try {
      const res = await fetch("/performance-development-dashboard/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: goal.id,
          title,
          description,
          category,
          priority,
          target,
          due_date: dueDate || null,
          status: goal.status,
        }),
      });
      if (!res.ok) {
        throw await readApiError(res, "Failed to save goal");
      }
      onSaved();
      toast.success("Goal updated successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.message]))
        );
        toast.error(
          err.fieldErrors.length > 0
            ? "Failed to update goal. Please check the form and try again."
            : "Failed to update goal. Please try again."
        );
      } else {
        toast.error("Failed to update goal. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-3 border-t border-line pt-4"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        aria-label="Goal title"
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
      <div className="flex gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Goal category"
          className={`${selectClass} flex-1`}
        >
          <option value="individual">Individual</option>
          <option value="department">Department</option>
          <option value="company">Company</option>
        </select>
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
        <input
          type="text"
          placeholder="Target (e.g. 25 packages/day)"
          aria-label="Goal target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={`${inputClass} flex-1`}
        />
      {fieldErrors.target && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.target}
        </p>
      )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
