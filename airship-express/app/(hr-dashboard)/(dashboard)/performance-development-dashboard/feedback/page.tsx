"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Chip,
  DataTable,
  DataTableRow,
  DetailRow,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonCards,
  SkeletonRegion,
  StatCard,
  TableActions,
  TableCell,
  errorTextClass,
  selectClass,
  sectionTitleClass,
  textareaClass,
} from "../components/ui";
import { useDirectory } from "../lib/directory";
import { useHrAuth } from "../lib/hr-auth";
import { useApiResource, useApiMutation } from "../lib/use-api";
import { Eye, MessageSquareText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type FeedbackEntry = {
  id: string;
  employee_id: string | null;
  given_by: string;
  message: string;
  feedback_type: string;
  created_at: string;
};

const FEEDBACK_TYPES = [
  "check_in",
  "recognition",
  "coaching",
  "improvement",
] as const;

const FEEDBACK_LABELS: Record<string, string> = {
  check_in: "Check-in",
  recognition: "Recognition",
  coaching: "Coaching",
  improvement: "Improvement",
};

function typeVariant(
  type: string
): "success" | "warning" | "danger" | "neutral" {
  if (type === "recognition") return "success";
  if (type === "coaching") return "warning";
  if (type === "improvement") return "danger";
  return "neutral";
}

export default function FeedbackPage() {
  const { user, isAdmin } = useHrAuth();
  const { getDirectoryUser, directory } = useDirectory();

  const {
    data: entries,
    loading,
    error,
    refetch,
  } = useApiResource<FeedbackEntry>({
    path: "feedback",
    listKey: "feedback",
    errorMessage: "Could not load feedback. Please try again.",
  });

  const createFeedback = useApiMutation({
    path: "feedback",
    method: "POST",
  });

  const [editingEntry, setEditingEntry] = useState<FeedbackEntry | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [editMessage, setEditMessage] = useState("");
  const [editFeedbackType, setEditFeedbackType] = useState<string>(FEEDBACK_TYPES[0]);

  const updateFeedbackMutation = useApiMutation({
    path: "feedback",
    method: "PUT",
    onSuccess: () => {
      setEditingEntry(null);
      refetch();
      toast.success("Feedback updated successfully.");
    },
  });

  const deleteFeedbackMutation = useApiMutation({
    path: "feedback",
    method: "DELETE",
    onSuccess: () => {
      setConfirmingDeleteId(null);
      refetch();
      toast.success("Feedback deleted successfully.");
    },
  });

  const [message, setMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState<string>(FEEDBACK_TYPES[0]);
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isPostFeedbackModalOpen, setIsPostFeedbackModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | (typeof FEEDBACK_TYPES)[number]>(
    "all"
  );
  const [selected, setSelected] = useState<FeedbackEntry | null>(null);

  const POST_FEEDBACK_TITLE_ID = "post-feedback-title";

  const myEmployeeId = user?.employeeId ?? null;

  const givenCount = entries.filter(
    (e) => e.given_by === myEmployeeId
  ).length;
  const receivedCount = entries.filter(
    (e) => e.given_by !== myEmployeeId
  ).length;

  const now = new Date();
  const thisMonthCount = entries.filter((e) => {
    const d = new Date(e.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const stats = [
    { label: "Given", value: givenCount },
    { label: "Received", value: receivedCount },
    { label: "This Month", value: thisMonthCount },
  ];

  const filteredEntries =
    filter === "all"
      ? entries
      : entries.filter((e) => e.feedback_type === filter);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      feedback_type: feedbackType,
      message,
    };
    if (isAdmin && employeeId) {
      payload.employee_id = employeeId;
    }
    const { error: submitError } = await createFeedback.submit(payload);
    if (submitError) {
      toast.error("Failed to post feedback. Please try again.");
      return;
    }
    setMessage("");
    setEmployeeId("");
    setIsPostFeedbackModalOpen(false);
    refetch();
    toast.success("Feedback submitted successfully.");
  }

  function senderName(id: string) {
    return getDirectoryUser(id)?.name ?? null;
  }

  function startEdit(entry: FeedbackEntry) {
    setEditingEntry(entry);
    setEditMessage(entry.message);
    setEditFeedbackType(entry.feedback_type);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    const { error: submitError } = await updateFeedbackMutation.submit({
      id: editingEntry.id,
      message: editMessage,
      feedback_type: editFeedbackType,
    });
    if (submitError) {
      toast.error("Failed to update feedback. Please try again.");
    }
  }

  async function confirmDelete(id: string) {
    const { error: submitError } = await deleteFeedbackMutation.submit(null, {
      id,
    });
    if (submitError) {
      toast.error("Failed to delete feedback. Please try again.");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance Management"
        title="Continuous Feedback"
        subtitle="Share regular feedback — praise, coaching, or improvement notes — anytime."
        actions={
          <Button onClick={() => setIsPostFeedbackModalOpen(true)}>
            Post Feedback
          </Button>
        }
      />

      {!loading && (
        <div className="mb-8 flex flex-wrap gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {FEEDBACK_TYPES.map((type) => (
            <Chip
              key={type}
              active={filter === type}
              onClick={() => setFilter(type)}
            >
              {FEEDBACK_LABELS[type]}
            </Chip>
          ))}
        </div>
      )}

      <Modal
        open={isPostFeedbackModalOpen}
        onClose={() => setIsPostFeedbackModalOpen(false)}
        title="Post Feedback"
        titleId={POST_FEEDBACK_TITLE_ID}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isAdmin && (
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              aria-label="Select employee to receive feedback"
              className={`${selectClass}`}
            >
              <option value="">Myself</option>
              {directory.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.jobTitle}
                </option>
              ))}
            </select>
          )}
          <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                aria-label="Feedback type"
                className={`${selectClass} capitalize`}
              >
                {FEEDBACK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FEEDBACK_LABELS[type]}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Write a note..."
                aria-label="Feedback message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className={textareaClass}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsPostFeedbackModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={createFeedback.submitting}>
                  {createFeedback.submitting ? "Posting…" : "Post Feedback"}
                </Button>
              </div>
            </form>
        </Modal>

        <Modal
          open={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title="Edit Feedback"
          titleId="edit-feedback-title"
        >
          {editingEntry && (
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
              <select
                value={editFeedbackType}
                onChange={(e) => setEditFeedbackType(e.target.value)}
                aria-label="Feedback type"
                className={`${selectClass} capitalize`}
              >
                {FEEDBACK_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FEEDBACK_LABELS[type]}
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Write a note..."
                aria-label="Feedback message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                required
                className={textareaClass}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingEntry(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={updateFeedbackMutation.submitting}>
                  {updateFeedbackMutation.submitting ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </Modal>

        <Modal
          open={!!confirmingDeleteId}
          onClose={() => setConfirmingDeleteId(null)}
          title="Delete Feedback"
          size="sm"
        >
          <p className="text-sm text-muted">
            Delete this feedback? This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="danger"
              onClick={() => confirmingDeleteId && confirmDelete(confirmingDeleteId)}
              loading={deleteFeedbackMutation.submitting}
            >
              {deleteFeedbackMutation.submitting ? "Deleting…" : "Confirm Delete"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
              Cancel
            </Button>
          </div>
        </Modal>

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      <h2 className={`mb-3 ${sectionTitleClass}`}>Recent Notes</h2>

      {loading && (
        <SkeletonRegion label="Loading feedback…">
          <SkeletonCards rows={3} className="max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && entries.length === 0 && (
        <EmptyState
          icon={MessageSquareText}
          title="No feedback yet"
          description='Click "Post Feedback" above to get started.'
        />
      )}

      {!loading && entries.length > 0 && filteredEntries.length === 0 && (
        <EmptyState
          icon={MessageSquareText}
          title="No feedback match"
          description="Try a different filter to see more feedback."
        />
      )}

      {!loading && filteredEntries.length > 0 && (
        <DataTable
          columns={["Type", "Message", "From / To", "Date", ""]}
        >
          {filteredEntries.map((entry) => {
            const sender = senderName(entry.given_by);
            const recipient = entry.employee_id
              ? getDirectoryUser(entry.employee_id)
              : null;
            return (
              <DataTableRow key={entry.id}>
                <TableCell>
                  <Badge variant={typeVariant(entry.feedback_type)}>
                    {FEEDBACK_LABELS[entry.feedback_type] ??
                      entry.feedback_type}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md truncate">
                  <span
                    className="block max-w-md cursor-pointer truncate text-ink hover:text-accent dark:text-paper"
                    onClick={() => setSelected(entry)}
                    title="View feedback"
                  >
                    {entry.message}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    {sender ? (
                      <>
                        <span className="text-ink dark:text-paper">{sender}</span>{" "}
                        {recipient && (
                          <>
                            → {recipient.name}
                          </>
                        )}
                      </>
                    ) : (
                      recipient?.name ?? "—"
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    {new Date(entry.created_at).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <TableActions
                    actions={[
                      {
                        label: "View",
                        icon: <Eye size={14} />,
                        onClick: () => setSelected(entry),
                      },
                      ...(entry.given_by === myEmployeeId || isAdmin
                        ? [
                            {
                              label: "Edit",
                              icon: <Pencil size={14} />,
                              onClick: () => startEdit(entry),
                            },
                            {
                              label: "Delete",
                              icon: <Trash2 size={14} />,
                              danger: true,
                              onClick: () => setConfirmingDeleteId(entry.id),
                            },
                          ]
                        : []),
                    ]}
                  />
                </TableCell>
              </DataTableRow>
            );
          })}
        </DataTable>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Feedback Details"
        size="lg"
      >
        {selected && (
          <dl className="divide-y divide-line dark:divide-paper/15">
            <DetailRow
              label="Type"
              value={
                <Badge variant={typeVariant(selected.feedback_type)}>
                  {FEEDBACK_LABELS[selected.feedback_type] ??
                    selected.feedback_type}
                </Badge>
              }
            />
            <DetailRow label="From" value={senderName(selected.given_by) ?? "—"} />
            <DetailRow
              label="To"
              value={
                selected.employee_id
                  ? getDirectoryUser(selected.employee_id)?.name ?? "—"
                  : "You"
              }
            />
            <DetailRow
              label="Date"
              value={new Date(selected.created_at).toLocaleDateString("en-PH", {
                timeZone: "Asia/Manila",
              })}
            />
            <div className="pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Message
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink dark:text-paper">
                {selected.message}
              </p>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
