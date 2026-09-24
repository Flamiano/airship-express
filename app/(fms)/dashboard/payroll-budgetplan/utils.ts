export const MONTH_NAMES = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

export const FISCAL_YEARS = [2023, 2024, 2025, 2026, 2027];
export const PAGE_SIZE = 8;

export const formatPeso = (val: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(val || 0);

export const monthName = (month: number) =>
  MONTH_NAMES[month - 1] ?? `Month ${month}`;