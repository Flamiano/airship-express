# Payroll Anomaly Detection

Flag unusual items:

- Net pay variance > 30%
- Overtime hours > 20/week
- Zero or negative net pay
- Missing employee IDs
- Duplicate payslips
- Tax > 30% of gross

Return JSON array: [{severity, title, message, employeeId}]. Return [] if clean.
