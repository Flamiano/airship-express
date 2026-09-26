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
  textareaClass,
} from "../components/ui";
import { useDirectory } from "../lib/directory";
import { useHrAuth } from "../lib/hr-auth";
import { ApiError } from "../lib/api-error";
import { useApiResource, useApiMutation } from "../lib/use-api";
import { Eye, HeartHandshake } from "lucide-react";
import { toast } from "sonner";

type Recognition = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string | null;
  reason_category: string | null;
  created_at: string;
  hr3_badges: { name: string } | null;
};

type BadgeRow = {
  id: string;
  name: string;
};

const REASON_CATEGORIES = [
  "teamwork",
  "innovation",
  "customer_service",
  "leadership",
  "ownership",
];

type RecognitionFormProps = {
  onRecognized: () => void;
  onClose: () => void;
};

function RecognitionForm({ onRecognized, onClose }: RecognitionFormProps) {
  const { user } = useHrAuth();
  const { directory } = useDirectory();
  const [recipientId, setRecipientId] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [message, setMessage] = useState("");
  const [reasonCategory, setReasonCategory] = useState(REASON_CATEGORIES[0]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const recipients = directory.filter((u) => u.id !== user?.employeeId);

  const {
    data: badges,
    error: badgesError,
  } = useApiResource<BadgeRow>({
    path: "badges",
    listKey: "badges",
    errorMessage: "Could not load badges. Please try again.",
  });

  const createRecognition = useApiMutation({
    path: "recognitions",
    method: "POST",
    onSuccess: () => {
      setRecipientId("");
      setBadgeId("");
      setMessage("");
      setFieldErrors({});
      onRecognized();
      toast.success("Recognition sent successfully.");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId || !badgeId) {
      toast.error("Choose a recipient and a badge.");
      return;
    }
    setFieldErrors({});
    const { error: submitError } = await createRecognition.submit({
      recipient_id: recipientId,
      badge_id: badgeId,
      message,
      reason_category: reasonCategory,
    });
    if (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(
            submitError.fieldErrors.map((f) => [f.field, f.message])
          )
        );
        toast.error(
          submitError.fieldErrors.length > 0
            ? "Failed to send recognition. Please check the form and try again."
            : "Failed to send recognition. Please try again."
        );
      } else {
        toast.error("Failed to send recognition. Please try again.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">

      <select
        value={recipientId}
        onChange={(e) => setRecipientId(e.target.value)}
        required
        aria-label="Select recipient"
        className={selectClass}
      >
        <option value="" disabled>
          Select recipient
        </option>
        {recipients.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} — {u.jobTitle}
          </option>
        ))}
      </select>
      {fieldErrors.recipient_id && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.recipient_id}
        </p>
      )}

      <select
        value={badgeId}
        onChange={(e) => setBadgeId(e.target.value)}
        required
        aria-label="Select badge"
        className={selectClass}
      >
        <option value="" disabled>
          Select badge
        </option>
        {badges.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {fieldErrors.badge_id && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.badge_id}
        </p>
      )}

      <textarea
        placeholder="Message (e.g. Thanks for going above and beyond!)"
        aria-label="Recognition message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className={textareaClass}
      />
      {fieldErrors.message && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.message}
        </p>
      )}

      <select
        value={reasonCategory}
        onChange={(e) => setReasonCategory(e.target.value)}
        aria-label="Reason category"
        className={`${selectClass} capitalize`}
      >
        {REASON_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category.replace("_", " ")}
          </option>
        ))}
      </select>
      {fieldErrors.reason_category && (
        <p className={errorTextClass} role="alert">
          {fieldErrors.reason_category}
        </p>
      )}

      {badgesError && (
        <p className={errorTextClass} role="alert">
          {badgesError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={createRecognition.submitting}>
          {createRecognition.submitting ? "Sending…" : "Send Recognition"}
        </Button>
      </div>
    </form>
  );
}

export default function RecognitionPage() {
  const { user } = useHrAuth();
  const { getDirectoryUser } = useDirectory();

  const {
    data: recognitions,
    loading,
    error,
    refetch,
  } = useApiResource<Recognition>({
    path: "recognitions",
    listKey: "recognitions",
    errorMessage: "Could not load recognitions. Please try again.",
  });

  const [isSendRecognitionModalOpen, setIsSendRecognitionModalOpen] =
    useState(false);
  const [filter, setFilter] = useState<
    "all" | (typeof REASON_CATEGORIES)[number]
  >("all");
  const [selected, setSelected] = useState<Recognition | null>(null);

  const SEND_RECOGNITION_TITLE_ID = "send-recognition-title";

  const myEmployeeId = user?.employeeId ?? null;

  const stats = [
    {
      label: "Given",
      value: recognitions.filter((r) => r.sender_id === myEmployeeId).length,
    },
    {
      label: "Received",
      value: recognitions.filter((r) => r.recipient_id === myEmployeeId).length,
    },
    {
      label: "This Month",
      value: recognitions.filter((r) => {
        const now = new Date();
        const d = new Date(r.created_at);
        return (
          d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
        );
      }).length,
    },
  ];

  const filteredRecognitions =
    filter === "all"
      ? recognitions
      : recognitions.filter((r) => r.reason_category === filter);

  return (
    <div>
      <PageHeader
        eyebrow="Social Recognition"
        title="Recognition Wall"
        subtitle="Acknowledge good work across the team — everyone can be recognized, even if they don't log in."
        actions={
          <Button onClick={() => setIsSendRecognitionModalOpen(true)}>
            Send Recognition
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

      {!loading && recognitions.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
          {REASON_CATEGORIES.map((category) => (
            <Chip
              key={category}
              active={filter === category}
              onClick={() => setFilter(category)}
            >
              {category.replace("_", " ")}
            </Chip>
          ))}
        </div>
      )}

      <Modal
        open={isSendRecognitionModalOpen}
        onClose={() => setIsSendRecognitionModalOpen(false)}
        title="Send Recognition"
        titleId={SEND_RECOGNITION_TITLE_ID}
      >
        <RecognitionForm
          onRecognized={() => {
            refetch();
            setIsSendRecognitionModalOpen(false);
          }}
          onClose={() => setIsSendRecognitionModalOpen(false)}
        />
      </Modal>

      {error && (
        <p className={`mb-6 ${errorTextClass}`} role="alert">
          {error}
        </p>
      )}

      {loading && (
        <SkeletonRegion label="Loading recognitions…">
          <SkeletonCards rows={3} className="max-w-md" />
        </SkeletonRegion>
      )}

      {!loading && recognitions.length === 0 && (
        <EmptyState
          icon={HeartHandshake}
          title="No recognitions yet"
          description='Click "Send Recognition" above to get started.'
        />
      )}

      {!loading && recognitions.length > 0 && filteredRecognitions.length === 0 && (
        <EmptyState
          icon={HeartHandshake}
          title="No recognitions match"
          description="Try a different category to see more recognitions."
        />
      )}

      {!loading && filteredRecognitions.length > 0 && (
        <DataTable columns={["Badge", "Message", "From / To", "Reason", "Date", ""]}>
          {filteredRecognitions.map((r) => {
            const sender = getDirectoryUser(r.sender_id);
            const recipient = getDirectoryUser(r.recipient_id);
            return (
              <DataTableRow key={r.id}>
                <TableCell>
                  {r.hr3_badges ? (
                    <Badge variant="success">{r.hr3_badges.name}</Badge>
                  ) : (
                    <span className="text-accent" aria-hidden>
                      <HeartHandshake size={16} />
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-md truncate">
                  <span
                    className="block max-w-md cursor-pointer truncate text-ink hover:text-accent dark:text-paper"
                    onClick={() => setSelected(r)}
                    title="View recognition"
                  >
                    {r.message ?? "Great work!"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    <span className="text-ink dark:text-paper">
                      {sender?.name ?? "Someone"}
                    </span>
                    {recipient && <> → {recipient.name}</>}
                  </span>
                </TableCell>
                <TableCell>
                  {r.reason_category && (
                    <span className="text-muted">
                      {r.reason_category.replace("_", " ")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-muted">
                    {new Date(r.created_at).toLocaleDateString("en-PH", {
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
                        onClick: () => setSelected(r),
                      },
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
        title="Recognition Details"
        size="lg"
      >
        {selected && (
          <dl className="divide-y divide-line dark:divide-paper/15">
            <DetailRow
              label="Badge"
              value={
                selected.hr3_badges ? (
                  <Badge variant="success">{selected.hr3_badges.name}</Badge>
                ) : (
                  "—"
                )
              }
            />
            <DetailRow
              label="From"
              value={getDirectoryUser(selected.sender_id)?.name ?? "Someone"}
            />
            <DetailRow
              label="To"
              value={
                getDirectoryUser(selected.recipient_id)?.name ?? "—"
              }
            />
            <DetailRow
              label="Reason"
              value={
                selected.reason_category
                  ? selected.reason_category.replace("_", " ")
                  : "—"
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
                {selected.message ?? "Great work!"}
              </p>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
