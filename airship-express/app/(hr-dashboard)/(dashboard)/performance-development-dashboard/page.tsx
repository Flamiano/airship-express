"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { withHRProtection } from "../../hocs/withHRProtection";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  HeartHandshake,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
  SkeletonStats,
  StatCard,
  fadeUp,
  staggerContainer,
  staggerItem,
} from "./components/ui";
import { AiInsights } from "./components/AiInsights";
import { useHrAuth } from "./lib/hr-auth";
import { useApiResource } from "./lib/use-api";
import { formatDate, todayManila } from "./lib/datetime";

type ModuleCard = {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  count?: number;
};

const PERFORMANCE_MODULES: ModuleCard[] = [
  {
    icon: Target,
    label: "Goals",
    description: "Track objectives, update progress, and align with your team.",
    href: "/performance-development-dashboard/goals",
  },
  {
    icon: MessageSquareText,
    label: "Feedback",
    description: "Share praise, coaching, or improvement notes anytime.",
    href: "/performance-development-dashboard/feedback",
  },
  {
    icon: TrendingUp,
    label: "PIP",
    description: "A structured plan to support getting back on track.",
    href: "/performance-development-dashboard/pip",
  },
];

const DEVELOPMENT_MODULES: ModuleCard[] = [
  {
    icon: BookOpen,
    label: "Learning Management",
    description: "Browse the course catalog, enroll, and track progress.",
    href: "/performance-development-dashboard/learning",
  },
  {
    icon: GraduationCap,
    label: "Training Management",
    description: "Schedule sessions and record attendance.",
    href: "/performance-development-dashboard/training",
  },
  {
    icon: HeartHandshake,
    label: "Social Recognition",
    description: "Acknowledge good work across the team.",
    href: "/performance-development-dashboard/recognition",
  },
];

const ADMIN_MODULES: ModuleCard[] = [
  {
    icon: ClipboardCheck,
    label: "Appraisals",
    description: "Rate performance across key areas and finalize reviews.",
    href: "/performance-development-dashboard/appraisals",
  },
  {
    icon: Award,
    label: "Competency Management",
    description: "Assess skill levels, spot gaps, and manage the library.",
    href: "/performance-development-dashboard/competency",
  },
  {
    icon: UserCog,
    label: "Succession Planning",
    description: "Track readiness for critical roles.",
    href: "/performance-development-dashboard/succession",
  },
];

function ModuleCardSection({
  title,
  modules,
}: {
  title: string;
  modules: ModuleCard[];
}) {
  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="shown"
    >
      <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
        {title}
      </p>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="shown"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        {modules.map(({ icon: Icon, label, description, href, count }) => (
          <motion.div key={href} variants={staggerItem}>
            <Link
              href={href}
              className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <Card className="flex h-full items-center gap-3 overflow-hidden p-3 transition-colors group-hover:border-accent/40 group-focus-visible:border-accent/40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/[0.07] text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold tracking-tight text-ink dark:text-paper">
                    {label}
                  </h3>
                  <p className="truncate text-[11.5px] text-muted">
                    {description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {count !== undefined && (
                    <Badge variant="neutral">{count}</Badge>
                  )}
                  <span className="text-[11px] font-medium text-accent opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Open &rarr;
                  </span>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}

function PerDevDashboardPage() {
  const { user, isAdmin } = useHrAuth();
  const firstName = user?.fullName.split(" ")[0] ?? "there";

  const goalsResource = useApiResource<Record<string, unknown>>({
    path: "goals",
    listKey: "goals",
  });
  const feedbackResource = useApiResource<Record<string, unknown>>({
    path: "feedback",
    listKey: "feedback",
  });
  const trainingResource = useApiResource<Record<string, unknown>>({
    path: "training-enrollments",
    listKey: "enrollments",
  });
  const coursesResource = useApiResource<Record<string, unknown>>({
    path: "enrollments",
    listKey: "enrollments",
  });
  const employeesResource = useApiResource<Record<string, unknown>>({
    path: "employees",
    listKey: "employees",
    disabled: !isAdmin,
  });

  const goals = goalsResource.data;
  const feedback = feedbackResource.data;
  const trainingEnrollments = trainingResource.data;
  const courseEnrollments = coursesResource.data;
  const employees = employeesResource.data;

  const isLoading =
    goalsResource.loading ||
    feedbackResource.loading ||
    trainingResource.loading ||
    coursesResource.loading ||
    (isAdmin && employeesResource.loading);

  const loadError =
    goalsResource.error ??
    feedbackResource.error ??
    trainingResource.error ??
    coursesResource.error ??
    (isAdmin ? employeesResource.error : null);

  const retry = () => {
    goalsResource.refetch();
    feedbackResource.refetch();
    trainingResource.refetch();
    coursesResource.refetch();
    if (isAdmin) employeesResource.refetch();
  };

  const today = todayManila();

  if (isLoading && !loadError) {
    return (
      <>
        <PageHeader
          eyebrow="Performance & Development"
          title={`Welcome, ${firstName}.`}
          subtitle={
            isAdmin
              ? "Your team's performance, development, and pending actions at a glance."
              : "Your goals, feedback, and development at a glance."
          }
        />
        <div className="flex flex-col gap-6">
          <SkeletonStats count={4} />
          <Card className="p-4">
            <Skeleton className="mb-3 h-3 w-32" />
            <Skeleton className="h-2 w-full" />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 dark:border-paper/15">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-6 w-10" />
            </div>
          </Card>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader
          eyebrow="Performance & Development"
          title={`Welcome, ${firstName}.`}
          subtitle={
            isAdmin
              ? "Your team's performance, development, and pending actions at a glance."
              : "Your goals, feedback, and development at a glance."
          }
        />
        <Card className="border-red-600/25 bg-red-600/5 p-5 dark:bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-paper">
                Couldn&apos;t load your dashboard
              </p>
              <p className="mt-1 text-[13px] text-red-700 dark:text-red-400">
                {loadError}
              </p>
              <Button
                onClick={retry}
                variant="secondary"
                className="mt-3 h-9 text-[13px]"
              >
                <RefreshCw size={14} /> Try again
              </Button>
            </div>
          </div>
        </Card>
      </>
    );
  }

  const activeGoals = goals.filter(
    (g) => g.status === "in_progress" || g.status === "not_started"
  );
  const pendingFeedbackReceived = feedback.filter(
    (f) => f.given_by !== user?.employeeId
  );
  const upcomingTraining = trainingEnrollments.filter(
    (e) =>
      e.approval_status !== "rejected" &&
      (e as Record<string, unknown>).hr3_training_sessions &&
      (e as Record<string, unknown>).hr3_training_sessions !== null &&
      typeof (e as Record<string, unknown>).hr3_training_sessions === "object" &&
      String(((e as Record<string, unknown>).hr3_training_sessions as Record<string, unknown>).schedule_date) >= today
  );
  const inProgressCourses = courseEnrollments.filter(
    (e) => e.status === "in_progress"
  );
  const activeTeamMembers = employees.filter(
    (e) => e.status === "active"
  );

  const overdueGoals = goals.filter(
    (g) =>
      g.status !== "completed" &&
      g.status !== "missed" &&
      g.due_date &&
      String(g.due_date) < today
  ).length;
  const missedGoals = goals.filter((g) => g.status === "missed").length;
  const pendingTrainingApprovals = trainingEnrollments.filter(
    (e) => e.approval_status === "pending"
  ).length;

  const goalsTotal = goals.length;
  const completedGoals = goals.filter((g) => g.status === "completed").length;
  const goalsCompletion = goalsTotal > 0 ? Math.round((completedGoals / goalsTotal) * 100) : 0;

  const attentionItems: { icon: LucideIcon; iconClass: string; borderClass: string; text: string; reason: string; href: string }[] = [];

  if (missedGoals > 0) {
    attentionItems.push({
      icon: AlertTriangle,
      iconClass: "text-red-600 bg-red-600/10 border-red-600/20 dark:text-red-400 dark:bg-red-500/15 dark:border-red-500/25",
      borderClass: "border-l-red-500 dark:border-l-red-400",
      text: "Goals missed",
      reason: `${missedGoals} ${missedGoals === 1 ? "goal" : "goals"} missed`,
      href: "/performance-development-dashboard/goals",
    });
  }

  if (overdueGoals > 0) {
    attentionItems.push({
      icon: Clock,
      iconClass: "text-amber-600 bg-amber-600/10 border-amber-600/20 dark:text-amber-400 dark:bg-amber-500/15 dark:border-amber-500/25",
      borderClass: "border-l-amber-500 dark:border-l-amber-400",
      text: "Goals overdue",
      reason: `${overdueGoals} ${overdueGoals === 1 ? "goal" : "goals"} require action`,
      href: "/performance-development-dashboard/goals",
    });
  }

  if (pendingTrainingApprovals > 0) {
    attentionItems.push({
      icon: CalendarClock,
      iconClass: "text-amber-600 bg-amber-600/10 border-amber-600/20 dark:text-amber-400 dark:bg-amber-500/15 dark:border-amber-500/25",
      borderClass: "border-l-amber-500 dark:border-l-amber-400",
      text: "Training approvals",
      reason: `${pendingTrainingApprovals} ${pendingTrainingApprovals === 1 ? "enrollment" : "enrollments"} awaiting approval`,
      href: "/performance-development-dashboard/training",
    });
  }

  const topAttention = attentionItems.slice(0, 5);

  const recentGoals = [...goals]
    .filter((g) => g.updated_at)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 3);
  const recentFeedback = [...feedback].slice(0, 3);

  const performanceModules = PERFORMANCE_MODULES.map((m) => {
    if (m.label === "Goals") return { ...m, count: activeGoals.length };
    if (m.label === "Feedback") return { ...m, count: pendingFeedbackReceived.length };
    return m;
  });

  const developmentModules = DEVELOPMENT_MODULES.map((m) => {
    if (m.label === "Learning Management") return { ...m, count: inProgressCourses.length };
    if (m.label === "Training Management") return { ...m, count: upcomingTraining.length };
    return m;
  });

  const adminModules = ADMIN_MODULES;

  return (
    <div>
      <motion.div variants={fadeUp} initial="hidden" animate="shown">
        <PageHeader
          eyebrow="Performance & Development"
          title={`Welcome, ${firstName}.`}
          subtitle={
            isAdmin
              ? "Your team's performance, development, and pending actions at a glance."
              : "Your goals, feedback, and development at a glance."
          }
        />
      </motion.div>

      {/* KPI Summary */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="shown"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={staggerItem} className="h-full">
          <StatCard
            label={isAdmin ? "Active Goals" : "My Active Goals"}
            value={activeGoals.length}
            detail={overdueGoals > 0 ? `${overdueGoals} overdue` : undefined}
            href="/performance-development-dashboard/goals"
          />
        </motion.div>
        <motion.div variants={staggerItem} className="h-full">
          <StatCard
            label={isAdmin ? "Pending Feedback" : "Feedback Received"}
            value={pendingFeedbackReceived.length}
            href="/performance-development-dashboard/feedback"
          />
        </motion.div>
        <motion.div variants={staggerItem} className="h-full">
          <StatCard
            label={isAdmin ? "Team Members" : "In-Progress Courses"}
            value={isAdmin ? activeTeamMembers.length : inProgressCourses.length}
          />
        </motion.div>
        <motion.div variants={staggerItem} className="h-full">
          <StatCard
            label="Upcoming Training"
            value={upcomingTraining.length}
            detail={
              pendingTrainingApprovals > 0
                ? `${pendingTrainingApprovals} pending approval`
                : undefined
            }
            href="/performance-development-dashboard/training"
          />
        </motion.div>
      </motion.section>

      {/* Goals at a glance */}
      <motion.section
        className="mt-6"
        variants={fadeUp}
        initial="hidden"
        animate="shown"
      >
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bricolage text-sm font-semibold tracking-tight">
              Goals at a Glance
            </h2>
            <span className="text-[11px] text-muted">
              {goalsTotal} {goalsTotal === 1 ? "goal" : "goals"}
            </span>
          </div>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex w-16 shrink-0 flex-col">
              <span className="font-bricolage text-lg font-bold leading-none text-ink dark:text-paper">
                {goalsCompletion}%
              </span>
              <span className="mt-0.5 text-[10px] text-muted">completed</span>
            </span>
            <div className="min-w-0 flex-1">
              <ProgressBar
                value={goalsCompletion}
                label="Goals completed"
                className="w-full"
              />
              <p className="mt-1 text-[11px] text-muted">
                {completedGoals} of {goalsTotal} goals complete
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 border-t border-line pt-3 dark:border-paper/15">
            <div className="min-w-0">
              <p className="font-bricolage text-lg font-bold leading-none">
                {completedGoals}
              </p>
              <p className="mt-1 text-[11px] text-muted">Completed</p>
            </div>
            <div className="min-w-0">
              <p className="font-bricolage text-lg font-bold leading-none">
                {activeGoals.length}
              </p>
              <p className="mt-1 text-[11px] text-muted">In progress</p>
            </div>
            <div className="min-w-0">
              <p
                className={`font-bricolage text-lg font-bold leading-none ${
                  overdueGoals > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-ink dark:text-paper"
                }`}
              >
                {overdueGoals}
              </p>
              <p className="mt-1 text-[11px] text-muted">Overdue</p>
            </div>
          </div>
        </Card>
      </motion.section>

      {/* Needs Attention */}
      <motion.section
        className="mt-8"
        variants={fadeUp}
        initial="hidden"
        animate="shown"
      >
        <h2 className="mb-3 font-bricolage text-lg font-semibold tracking-tight">
          Needs Attention
        </h2>
        {topAttention.length === 0 ? (
          <Card className="flex items-center gap-3 p-4">
            <CheckCircle2
              size={16}
              className="shrink-0 text-green-600 dark:text-green-400"
            />
            <p className="text-[13px] text-muted">You&apos;re all caught up.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-1.5">
            {topAttention.map((item, i) => (
              <motion.div
                key={`${item.href}-${i}`}
                variants={staggerItem}
                initial="hidden"
                animate="shown"
                custom={i}
              >
                <Link
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg border border-line border-l-[3px] bg-paper px-4 py-2.5 transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:border-paper/15 dark:bg-ink dark:hover:border-accent/40 ${item.borderClass}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${item.iconClass}`}
                  >
                    <item.icon size={14} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink dark:text-paper">
                      {item.text}
                    </p>
                    <p className="text-[11px] text-muted">{item.reason}</p>
                  </div>
                  <ArrowRight
                    size={13}
                    className="shrink-0 text-accent opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Module Cards */}
      <div className="mt-8 flex flex-col gap-8">
        <ModuleCardSection title="Performance" modules={performanceModules} />
        <ModuleCardSection title="Development" modules={developmentModules} />
        {isAdmin && <ModuleCardSection title="People" modules={adminModules} />}
      </div>

      {/* AI Insights */}
      <motion.section
        className="mt-10"
        variants={fadeUp}
        initial="hidden"
        animate="shown"
      >
        <h2 className="mb-3 font-bricolage text-lg font-semibold tracking-tight">
          AI Insights
        </h2>
        <AiInsights />
      </motion.section>

      {/* Recent Activity */}
      {(recentGoals.length > 0 || recentFeedback.length > 0) && (
        <motion.section
          className="mt-10"
          variants={fadeUp}
          initial="hidden"
          animate="shown"
        >
          <h2 className="mb-3 font-bricolage text-lg font-semibold tracking-tight">
            Recent Activity
          </h2>
          <div className="flex flex-col gap-1.5">
            {recentGoals.map((g) => (
              <Link
                key={g.id as string}
                href="/performance-development-dashboard/goals"
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:hover:bg-paper/[0.05]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/[0.07] text-accent">
                  <Target size={13} strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Goal updated
                  </p>
                  <p className="truncate text-[13px] font-medium text-ink dark:text-paper">
                    {g.title as string}
                  </p>
                  <p className="text-[11px] text-muted">
                    Updated {formatDate(g.updated_at as string)}
                  </p>
                </div>
                <ArrowRight
                  size={13}
                  className="shrink-0 text-accent opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </Link>
            ))}
            {recentFeedback.map((f) => (
              <Link
                key={f.id as string}
                href="/performance-development-dashboard/feedback"
                className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 dark:hover:bg-paper/[0.05]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent/20 bg-accent/[0.07] text-accent">
                  <MessageSquareText size={13} strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Feedback added
                  </p>
                  <p className="truncate text-[13px] font-medium text-ink dark:text-paper">
                    {f.message as string}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDate(f.created_at as string)}
                  </p>
                </div>
                <ArrowRight
                  size={13}
                  className="shrink-0 text-accent opacity-40 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {recentGoals.length === 0 && recentFeedback.length === 0 && (
        <motion.section
          className="mt-10"
          variants={fadeUp}
          initial="hidden"
          animate="shown"
        >
          <EmptyState
            icon={Sparkles}
            title="Your dashboard is ready"
            description="As you set goals, give feedback, and complete training, your activity will appear here."
          />
        </motion.section>
      )}
    </div>
  );
}

export default withHRProtection(PerDevDashboardPage);
