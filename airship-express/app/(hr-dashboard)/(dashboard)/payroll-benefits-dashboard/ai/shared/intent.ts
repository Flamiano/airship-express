const TRIGGER_PATTERNS = [
  /generate.*(payslip|pay ?slip)/i,
  /(payslip|pay ?slip).*(image|picture|photo|print[- ]?ready|ready.*print)/i,
  /print[- ]?ready.*(payslip|pay ?slip)/i,
  /(gumawa|gawa|gawin).*(payslip|pay ?slip)/i,
  /(larawan|litrato).*(payslip|pay ?slip)/i,
  /ipa[- ]?print.*(payslip|pay ?slip)/i,
];

export function detectPayslipImageIntent(
  message: string
): { employeeName: string } | null {
  const matched = TRIGGER_PATTERNS.some((pattern) => pattern.test(message));
  if (!matched) return null;

  const nameMatch = message.match(
    /(?:payslip|pay ?slip)\s*(?:of|ni|para\s*kay|for)\s+([A-Za-zÑñ.'\- ]{2,60})/i
  );

  const employeeName = nameMatch?.[1]?.trim().replace(/[.?!]+$/, "") || "";
  if (!employeeName) return null;

  return { employeeName };
}
