# Employee Job Transfer Architecture

## Overview
In an enterprise Workforce Management (WFM) environment, when an employee switches departments or job roles (handled via HR1), their scheduled shifts and responsibilities in HR2 often become invalid or create conflicts.

Airship Express handles this desync natively at the Database level using a Postgres Trigger. This ensures zero API polling or client-side cron jobs are required to maintain data integrity.

## Core Rules

1. **Past Shifts (Historical Integrity)**
   Any shifts with `shift_date < CURRENT_DATE` or statuses of `'Completed'` or `'In Progress'` remain untouched. Payroll, attendance records, and sprint charts rely on historical data, which must never be altered when an employee transfers roles.

2. **Future Shifts (Conflict Resolution via Unassignment)**
   Any shifts with `shift_date >= CURRENT_DATE` that have not yet started (`status NOT IN ('Completed', 'In Progress')`) are stripped of the transferred employee. 
   
   *Why not delete the shift?*
   Hard-deleting the shift creates a blind spot in the schedule coverage. By setting `employee_id = NULL` instead, the shift remains in the calendar but becomes unassigned. This flags it for the Workforce Manager to reassign a new employee to cover the slot.

3. **Status Reset**
   The affected shifts have their `status` reset to `'Pending Driver'` (or standard pending status), and an `override_reason` is automatically injected: 
   `"AUTO-UNASSIGNED: Employee transferred to new department/role ([New Department]). Please reassign."`

## Implementation
The logic is deployed via the `handle_employee_transfer` trigger function attached to `hr1_employees` table. 

```sql
CREATE TRIGGER hr1_employee_transfer_trigger
AFTER UPDATE ON public.hr1_employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_employee_transfer();
```

Whenever HR1 updates an employee's `department` or `job_position_id`, Postgres automatically scans `hr2_shifts` and executes the unassignment protocol instantly.
