import Link from "next/link";
import { FileText } from "lucide-react";
import { requirePermission } from "../../../library/auth/rbac.server";
import { getCustomerAnalytics } from "../../../services/customer-analytics.service";
import AnalyticsSection from "../../../components/analytics/AnalyticsSection";
import {
  KpiCard,
  TrendBarChart,
  TrendLineChart,
  CountBarChart,
  DonutChart,
} from "../../../components/analytics/Charts";

export default async function CustomerAnalyticsPage() {
  await requirePermission("analytics.view");

  const data = await getCustomerAnalytics();

  const satisfactionDonut = [
    { name: "5★ Excellent", value: data.ratingDistribution[4].value, color: "#10b981" },
    { name: "4★ Good",      value: data.ratingDistribution[3].value, color: "#34d399" },
    { name: "3★ Neutral",   value: data.ratingDistribution[2].value, color: "#f59e0b" },
    { name: "2★ Poor",      value: data.ratingDistribution[1].value, color: "#f97316" },
    { name: "1★ Bad",       value: data.ratingDistribution[0].value, color: "#ef4444" },
  ];

  const concernDonut = data.concernsByStatus.map((c, i) => ({
    name: c.label,
    value: c.value,
    color: ["#ef4444", "#f97316", "#10b981", "#6b7280"][i] ?? "#a1a1aa",
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Customer Analytics</h1>
          <p className="text-muted mt-0.5 text-sm">
            Customer engagement, satisfaction, and service performance across all channels.
          </p>
        </div>
        <Link
          href="/crbc/analytics/reports?type=customer-analytics"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-line/50 hover:text-foreground"
        >
          <FileText size={14} />
          Reports &amp; Export
        </Link>
      </div>

      {/* ── 1. OVERVIEW ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-foreground text-sm font-semibold">Overview</h2>
        <p className="text-muted mt-0.5 mb-3 text-xs">Snapshot of customer activity.</p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label="Total Customers"
            value={data.totalCustomers.toLocaleString("en-PH")}
            hint={`${data.activeCustomers} active (30d)`}
          />
          <KpiCard
            label="Total Bookings"
            value={data.totalBookings.toLocaleString("en-PH")}
            hint="all channels"
          />
          <KpiCard
            label="Interactions"
            value={data.totalInteractions.toLocaleString("en-PH")}
            hint="all touchpoints"
          />
          <KpiCard
            label="Avg. Rating"
            value={data.totalFeedback > 0 ? `${data.avgRating} / 5` : "—"}
            hint={`${data.totalFeedback} reviews`}
            tone={data.avgRating >= 4 ? "good" : data.avgRating >= 3 ? "warn" : data.avgRating > 0 ? "bad" : "default"}
          />
          <KpiCard
            label="Open Concerns"
            value={data.openConcerns}
            hint={`${data.resolvedConcerns} resolved`}
            tone={data.openConcerns > 5 ? "warn" : "default"}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AnalyticsSection title="Customer Growth" description="New customers per month">
            <TrendLineChart
              data={data.customerGrowth.map(d => ({ label: d.month, value: d.value }))}
              valueKey="value"
              categoryKey="label"
              color="#0ea5e9"
            />
          </AnalyticsSection>

          <AnalyticsSection title="Booking Trend" description="Requests created per month">
            <TrendBarChart
              data={data.bookingTrend.map(d => ({ label: d.month, value: d.value }))}
              valueKey="value"
              categoryKey="label"
              color="#4f46e5"
            />
          </AnalyticsSection>
        </div>
      </div>

      {/* ── 2. ENGAGEMENT ───────────────────────────────────────── */}
      <div className="pt-2">
        <h2 className="text-foreground text-sm font-semibold">Engagement</h2>
        <p className="text-muted mt-0.5 mb-3 text-xs">
          How customers interact with Airship Express across channels.
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Interactions" value={data.totalInteractions} />
          <KpiCard label="Active Customers" value={data.activeCustomers} tone="good" />
          <KpiCard label="Inactive Customers" value={data.inactiveCustomers} />
          <KpiCard label="Delivered Shipments" value={data.deliveredShipments} tone="good" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AnalyticsSection title="Interaction Trend" description="Customer touchpoints per month">
            <TrendLineChart
              data={data.interactionTrend.map(d => ({ label: d.month, value: d.value }))}
              valueKey="value"
              categoryKey="label"
              color="#14b8a6"
            />
          </AnalyticsSection>

          <AnalyticsSection title="Bookings by Channel" description="Where requests originate">
            <CountBarChart
              data={data.bookingsByChannel}
              valueKey="value"
              categoryKey="label"
              color="#4f46e5"
            />
          </AnalyticsSection>
        </div>
      </div>

      {/* ── 3. SATISFACTION ─────────────────────────────────────── */}
      <div className="pt-2">
        <h2 className="text-foreground text-sm font-semibold">Customer Satisfaction</h2>
        <p className="text-muted mt-0.5 mb-3 text-xs">
          Feedback ratings submitted after delivered shipments.
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Reviews" value={data.totalFeedback} />
          <KpiCard
            label="Average Rating"
            value={data.totalFeedback > 0 ? `${data.avgRating} ★` : "—"}
            tone={data.avgRating >= 4 ? "good" : data.avgRating >= 3 ? "warn" : data.avgRating > 0 ? "bad" : "default"}
          />
          <KpiCard
            label="5★ Reviews"
            value={data.ratingDistribution[4].value}
            hint="excellent"
            tone="good"
          />
          <KpiCard
            label="Low Ratings (1-2★)"
            value={data.ratingDistribution[0].value + data.ratingDistribution[1].value}
            hint="needs attention"
            tone={data.ratingDistribution[0].value + data.ratingDistribution[1].value > 0 ? "warn" : "default"}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AnalyticsSection title="Rating Distribution" description="Breakdown of all submitted ratings">
            <DonutChart data={satisfactionDonut} valueKey="value" nameKey="name" />
          </AnalyticsSection>

          <AnalyticsSection title="Feedback Trend" description="Reviews submitted per month">
            <TrendBarChart
              data={data.feedbackTrend.map(d => ({ label: d.month, value: d.value }))}
              valueKey="value"
              categoryKey="label"
              color="#10b981"
            />
          </AnalyticsSection>
        </div>
      </div>

      {/* ── 4. CONCERNS ─────────────────────────────────────────── */}
      <div className="pt-2">
        <h2 className="text-foreground text-sm font-semibold">Complaints & Concerns</h2>
        <p className="text-muted mt-0.5 mb-3 text-xs">
          Volume and resolution status of customer-raised concerns.
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Concerns" value={data.totalConcerns} />
          <KpiCard label="Open" value={data.openConcerns} tone={data.openConcerns > 0 ? "warn" : "default"} />
          <KpiCard label="Resolved" value={data.resolvedConcerns} tone="good" />
          <KpiCard
            label="Resolution Rate"
            value={data.totalConcerns > 0 ? `${Math.round((data.resolvedConcerns / data.totalConcerns) * 100)}%` : "—"}
            tone={data.totalConcerns > 0 && (data.resolvedConcerns / data.totalConcerns) >= 0.8 ? "good" : "warn"}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AnalyticsSection title="Concerns by Status" description="Current state of all concerns">
            <DonutChart data={concernDonut} valueKey="value" nameKey="name" />
          </AnalyticsSection>

          <AnalyticsSection title="Concern Volume Trend" description="Concerns raised per month">
            <TrendBarChart
              data={data.concernTrend.map(d => ({ label: d.month, value: d.value }))}
              valueKey="value"
              categoryKey="label"
              color="#f97316"
            />
          </AnalyticsSection>
        </div>
      </div>
    </div>
  );
}
