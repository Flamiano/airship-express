import Link from "next/link"
import { createClient } from "../../library/supabase/server"
import { getSlaOverviewData } from "../../services/sla.service"
import {
  Users, MessageSquare, Star, ShieldAlert,
  AlertTriangle, CheckCircle2,
  ArrowRight, Truck,
} from "lucide-react"

const LIMIT = 6

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const CONCERN_STATUS_TONE: Record<string, string> = {
  open: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  closed: "bg-line/60 text-muted",
}

const CONCERN_PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
}

export default async function CrbcDashboard() {
  const supabase = await createClient()

  // ── Parallel data fetching ────────────────────────────────────────────────
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    { count: totalCustomers },
    { count: newCustomersThisMonth },
    { data: concerns },
    { data: recentFeedback },
    { data: recentChatMessages },
    slaOverview,
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true })
      .gte("created_at", startOfMonth.toISOString()),
    supabase.from("concerns").select("id, concern_number, subject, status, priority, created_at, customers:customer_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase.from("shipment_feedback").select("id, rating, comment, submitted_at, customer:customers!shipment_feedback_customer_id_fkey(full_name)")
      .order("submitted_at", { ascending: false })
      .limit(LIMIT),
    supabase.from("chat_messages").select("id, conversation_id, text, sender_role, read_at, created_at")
      .eq("sender_role", "customer")
      .order("created_at", { ascending: false })
      .limit(50),
    getSlaOverviewData(),
  ])

  // ── Resolve customer names for chat messages ───────────────────────────────
  const uniqueConvIds = [...new Set((recentChatMessages ?? []).map(m => m.conversation_id))].slice(0, LIMIT)
  const { data: chatCustomers } = await supabase
    .from("customers")
    .select("auth_user_id, full_name, customer_id")
    .in("auth_user_id", uniqueConvIds)

  const convToCustomer = new Map(
    (chatCustomers ?? []).map(c => [c.auth_user_id, c])
  )

  // Latest message per conversation (already sorted desc, so first occurrence wins)
  const seenConvIds = new Set<string>()
  const recentChats = (recentChatMessages ?? []).filter(m => {
    if (seenConvIds.has(m.conversation_id)) return false
    seenConvIds.add(m.conversation_id)
    return true
  }).slice(0, LIMIT)

  // ── Derived values ────────────────────────────────────────────────────────
  const openConcerns = concerns?.filter(c => ["open", "in_progress"].includes(c.status)).length ?? 0
  const highPriorityConcerns = concerns?.filter(c => c.priority === "high" && c.status !== "resolved" && c.status !== "closed").length ?? 0

  const allFeedback = await supabase.from("shipment_feedback").select("rating")
  const ratings = allFeedback.data?.map(f => f.rating) ?? []
  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    : null

  const { summary, shipments } = slaOverview
  const slaAlerts = shipments.filter(s =>
    s.sla_status === "Delayed" || (s.actual_delivery === null && s.sla_status !== "On Time")
  ).slice(0, LIMIT)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: "Total Customers",
      value: totalCustomers ?? 0,
      sub: `+${newCustomersThisMonth ?? 0} this month`,
      icon: Users,
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      href: "/crbc/customers",
    },
    {
      label: "Open Concerns",
      value: openConcerns,
      sub: highPriorityConcerns > 0 ? `${highPriorityConcerns} high priority` : "No high priority",
      icon: MessageSquare,
      color: openConcerns > 0 ? "text-red-500" : "text-emerald-500",
      bg: openConcerns > 0 ? "bg-red-50 dark:bg-red-950/40" : "bg-emerald-50 dark:bg-emerald-950/40",
      href: "/crbc/complaints&concern",
    },
    {
      label: "Avg. Feedback Rating",
      value: avgRating ? `${avgRating} / 5` : "—",
      sub: `${ratings.length} total ratings`,
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      href: "/crbc/customers/feedbackmanagement",
    },
    {
      label: "SLA Alerts",
      value: slaAlerts.length,
      sub: `${summary.compliance}% compliance`,
      icon: ShieldAlert,
      color: slaAlerts.length > 0 ? "text-orange-500" : "text-emerald-500",
      bg: slaAlerts.length > 0 ? "bg-orange-50 dark:bg-orange-950/40" : "bg-emerald-50 dark:bg-emerald-950/40",
      href: "/crbc/sla-monitoring",
    },
  ]

  return (
    <div className="w-full py-4 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-foreground text-xl font-semibold">Dashboard</h1>
        <p className="text-muted text-sm mt-0.5">
          Customer relationships, concerns, feedback, and SLA at a glance.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, sub, icon: Icon, color, bg, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border border-line bg-background px-4 py-3.5 flex items-start gap-3 hover:bg-line/20 transition-colors group"
          >
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon size={16} className={color} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted text-xs">{label}</p>
              <p className="text-foreground text-xl font-semibold mt-0.5">{value}</p>
              <p className="text-muted text-[11px] mt-0.5">{sub}</p>
            </div>
            <ArrowRight size={13} className="text-muted shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

      {/* Row 1: Concerns + Feedback */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Recent Concerns */}
        <section className="rounded-lg border border-line bg-background">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <div>
              <h2 className="text-sm font-medium text-foreground">Recent Concerns</h2>
              <p className="text-xs text-muted mt-0.5">Open and in-progress cases</p>
            </div>
            <Link href="/crbc/complaints&concern" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {!concerns || concerns.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">No concerns yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {concerns.map((c) => {
                const customer = c.customers as unknown as { full_name: string } | null
                return (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-line/20 transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CONCERN_PRIORITY_DOT[c.priority] ?? "bg-foreground/20"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{c.subject}</p>
                      <p className="text-[11px] text-muted mt-0.5 font-mono">{c.concern_number} · {customer?.full_name ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CONCERN_STATUS_TONE[c.status] ?? "bg-line/60 text-muted"}`}>
                        {c.status.replace("_", " ")}
                      </span>
                      <span className="text-[11px] text-muted">{relativeTime(c.created_at)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Recent Feedback */}
        <section className="rounded-lg border border-line bg-background">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <div>
              <h2 className="text-sm font-medium text-foreground">Recent Feedback</h2>
              <p className="text-xs text-muted mt-0.5">Latest delivery ratings</p>
            </div>
            <Link href="/crbc/customers/feedbackmanagement" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {!recentFeedback || recentFeedback.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">No feedback yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentFeedback.map((f) => {
                const customer = f.customer as unknown as { full_name: string } | null
                const customerName = customer?.full_name ?? "—"
                return (
                  <li key={f.id} className="flex items-start gap-3 px-5 py-3 hover:bg-line/20 transition-colors">
                    <span className="shrink-0 mt-0.5 text-xs font-semibold text-amber-500">{f.rating}/5</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{f.comment || <span className="text-muted italic">No comment</span>}</p>
                      <p className="text-[11px] text-muted mt-0.5">{customerName} · {shortDate(f.submitted_at)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Row 2: SLA Alerts + Recent Interactions */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* SLA Alerts */}
        <section className="rounded-lg border border-line bg-background">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <div>
              <h2 className="text-sm font-medium text-foreground">SLA Alerts</h2>
              <p className="text-xs text-muted mt-0.5">
                {summary.onTime} on time · {summary.late} late · {summary.compliance}% compliance
              </p>
            </div>
            <Link href="/crbc/sla-monitoring" className="text-xs text-accent hover:underline flex items-center gap-1">
              Monitor <ArrowRight size={11} />
            </Link>
          </div>
          {slaAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <p className="text-sm text-muted">All shipments on time</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {slaAlerts.map((s) => (
                <li key={s.shipment_id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-line/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-accent">{s.tracking_number ?? s.reference}</p>
                    <p className="text-[11px] text-muted mt-0.5 truncate">
                      {s.origin} → {s.destination}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      s.sla_status === "Delayed"
                        ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    }`}>
                      {s.sla_status}
                    </span>
                    <p className="text-[11px] text-muted mt-0.5">
                      {s.days_variance != null && s.days_variance > 0
                        ? `${s.days_variance}d overdue`
                        : `Due ${s.expected_delivery ?? "—"}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Customer Messages */}
        <section className="rounded-lg border border-line bg-background">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
            <div>
              <h2 className="text-sm font-medium text-foreground">Recent Customer Messages</h2>
              <p className="text-xs text-muted mt-0.5">Latest inquiries and chat messages</p>
            </div>
            <Link href="/crbc/customers/customercommunication" className="text-xs text-accent hover:underline flex items-center gap-1">
              Open inbox <ArrowRight size={11} />
            </Link>
          </div>
          {recentChats.length === 0 ? (
            <p className="text-muted text-sm text-center py-10">No messages yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentChats.map((m) => {
                const customer = convToCustomer.get(m.conversation_id)
                const isUnread = !m.read_at
                return (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-line/20 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-foreground/5 border border-line flex items-center justify-center shrink-0 text-[10px] font-semibold text-muted">
                      {customer?.full_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {customer?.full_name ?? "Unknown"}
                        {isUnread && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent align-middle" />}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5 truncate">{m.text || "📎 Attachment"}</p>
                    </div>
                    <span className="text-[11px] text-muted shrink-0">{relativeTime(m.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Activity strip */}
      <section className="rounded-lg border border-line bg-background">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-medium text-foreground">Activity this month</h2>
        </div>
        <div className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {[
            { label: "New Customers", value: newCustomersThisMonth ?? 0, icon: Users, color: "text-indigo-500" },
            { label: "Open Concerns", value: openConcerns, icon: AlertTriangle, color: openConcerns > 0 ? "text-red-500" : "text-emerald-500" },
            { label: "Feedback Received", value: ratings.length, icon: Star, color: "text-amber-500" },
            { label: "Delivered On Time", value: summary.onTime, icon: Truck, color: "text-emerald-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="px-5 py-4 flex items-center gap-3">
              <Icon size={15} className={`shrink-0 ${color}`} />
              <div>
                <p className="text-muted text-xs">{label}</p>
                <p className="text-foreground text-lg font-semibold mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
