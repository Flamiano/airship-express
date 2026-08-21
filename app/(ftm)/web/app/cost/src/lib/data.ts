export type Trend = "up" | "down" | "flat";

export interface Kpi {
  label: string;
  value: string;
  trend?: Trend;
  accent: string; // tailwind border color class, e.g. "border-b-primary"
  valueColor?: string; // tailwind text color class
}

export const primaryKpis: Kpi[] = [
  { label: "Total Fleet Cost", value: "₱382,450", accent: "border-b-primary" },
  {
    label: "Monthly Cost Change",
    value: "+4.2%",
    trend: "up",
    accent: "border-b-green-500",
    valueColor: "text-green-600",
  },
  {
    label: "Cost per Asset",
    value: "₱3,540",
    accent: "border-b-blue-500",
  },
  {
    label: "Cost per Hour",
    value: "₱78.50",
    accent: "border-b-blue-500",
  },
  {
    label: "Budget Utilization",
    value: "92%",
    trend: "up",
    accent: "border-b-green-500",
    valueColor: "text-green-600",
  },
  {
    label: "Cost Variance",
    value: "+₱18,700",
    trend: "up",
    accent: "border-b-error",
    valueColor: "text-error",
  },
];

export const secondaryKpis: Kpi[] = [
  {
    label: "Maintenance Cost",
    value: "₱124,300",
    trend: "down",
    accent: "border-b-blue-700",
    valueColor: "text-blue-700",
  },
  {
    label: "Fuel Cost",
    value: "₱95,780",
    trend: "up",
    accent: "border-b-green-600",
    valueColor: "text-green-600",
  },
  {
    label: "Parts Cost",
    value: "₱58,620",
    trend: "up",
    accent: "border-b-green-500",
    valueColor: "text-green-500",
  },
  {
    label: "Labor Cost",
    value: "₱71,500",
    trend: "down",
    accent: "border-b-blue-600",
    valueColor: "text-blue-600",
  },
  {
    label: "Tire Cost",
    value: "₱22,150",
    trend: "up",
    accent: "border-b-error",
    valueColor: "text-error",
  },
];

export interface ExpenseSlice {
  label: string;
  percent: number;
  color: string; // hex for chart.js
  dot: string; // tailwind bg class for legend dot
}

export const expenseBreakdown: ExpenseSlice[] = [
  { label: "Maintenance", percent: 30, color: "#2563eb", dot: "bg-blue-600" },
  { label: "Fuel", percent: 25, color: "#22c55e", dot: "bg-green-500" },
  { label: "Parts", percent: 20, color: "#eab308", dot: "bg-yellow-500" },
  { label: "Labor", percent: 15, color: "#ba1a1a", dot: "bg-error" },
  { label: "Tires", percent: 10, color: "#f97316", dot: "bg-orange-500" },
];

export interface CostDriver {
  rank: number;
  label: string;
  percent: string;
}

export const topCostDrivers: CostDriver[] = [
  { rank: 1, label: "Engine Repairs", percent: "24%" },
  { rank: 2, label: "Fuel Usage", percent: "18%" },
  { rank: 3, label: "Hydraulic Systems", percent: "15%" },
  { rank: 4, label: "Tire Replacements", percent: "12%" },
  { rank: 5, label: "Transmission Repairs", percent: "9%" },
];

export type AssetStatus =
  | "Over Budget"
  | "On Target"
  | "Watch List"
  | "Rising Costs"
  | "Optimized";

export interface AssetRow {
  id: string;
  category: string;
  maintenanceCost: string;
  fuelCost: string;
  partsLabor: string;
  totalCost: string;
  trend: Trend;
  trendColor: string; // tailwind text color class for the trend arrow
  status: AssetStatus;
  highlighted?: boolean;
}

export const assetRows: AssetRow[] = [
  {
    id: "DV-102",
    category: "Dozer",
    maintenanceCost: "₱18,200",
    fuelCost: "₱12,450",
    partsLabor: "₱8,950",
    totalCost: "₱39,600",
    trend: "up",
    trendColor: "text-green-600",
    status: "Over Budget",
  },
  {
    id: "LD-305",
    category: "Loader",
    maintenanceCost: "₱15,860",
    fuelCost: "₱10,880",
    partsLabor: "₱16,200",
    totalCost: "₱42,940",
    trend: "down",
    trendColor: "text-error",
    status: "On Target",
  },
  {
    id: "RS-210",
    category: "Roller",
    maintenanceCost: "₱12,500",
    fuelCost: "₱8,720",
    partsLabor: "₱6,450",
    totalCost: "₱27,670",
    trend: "up",
    trendColor: "text-green-600",
    status: "Watch List",
  },
  {
    id: "EX-488",
    category: "Excavator",
    maintenanceCost: "₱22,340",
    fuelCost: "₱14,600",
    partsLabor: "₱21,580",
    totalCost: "₱58,520",
    trend: "up",
    trendColor: "text-error",
    status: "Over Budget",
    highlighted: true,
  },
  {
    id: "CT-150",
    category: "Truck",
    maintenanceCost: "₱9,780",
    fuelCost: "₱28,500",
    partsLabor: "₱5,420",
    totalCost: "₱43,700",
    trend: "up",
    trendColor: "text-green-600",
    status: "Rising Costs",
  },
  {
    id: "GD-224",
    category: "Grader",
    maintenanceCost: "₱11,920",
    fuelCost: "₱7,650",
    partsLabor: "₱10,300",
    totalCost: "₱29,870",
    trend: "flat",
    trendColor: "text-secondary",
    status: "Optimized",
  },
];

export interface Insight {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  valueSuffix?: string;
  borderLeft?: boolean;
}

export const costInsights: Insight[] = [
  {
    icon: "calendar_month",
    iconColor: "text-blue-600",
    label: "Preventive vs Reactive",
    value: "68% / 32%",
    valueColor: "text-on-surface",
  },
  {
    icon: "savings",
    iconColor: "text-green-600",
    label: "Savings from PM",
    value: "₱14,800",
    valueColor: "text-green-600",
    valueSuffix: "Saved",
  },
  {
    icon: "construction",
    iconColor: "text-orange-500",
    label: "Reduce Parts Waste",
    value: "-15%",
    valueColor: "text-orange-500",
    valueSuffix: "Opportunity",
  },
  {
    icon: "warning",
    iconColor: "text-error",
    label: "Recurring Issue Alerts",
    value: "9",
    valueColor: "text-error",
    valueSuffix: "High Cost Alerts",
    borderLeft: true,
  },
];

export const trendChart = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Dec"],
  planned: [55, 38, 42, 58, 43, 52, 38, 20, 75],
  actual: [28, 30, 25, 35, 45, 30, 26, 28, 55],
  trendLine: [40, 50, 45, 60, 48, 55, 40, 35, 50],
};
