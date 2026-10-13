# User Activity, Audit Logs & Device Security Reference

## 1. Overview
Airship Express Supply Chain system enforces strict audit compliance, role-based access control, active session management, and automated device security.

---

## 2. User Activity Audit Trail (`user_activity`)
Every administrative and operational action is logged to the immutable `user_activity` table:
- **Captured Attributes**:
  - `user_id`: Operator uuid.
  - `action`: Specific operation (e.g. `Stock In`, `Stock Out`, `Create PO`, `Approve Requisition`, `Update Threshold`, `Delete Item`, `Login`, `Block Device`).
  - `module`: Target module (Inventory, Procurement, Warehousing, Executive, Settings, Security).
  - `description`: Human-readable summary of the exact change made.
  - `ip_address` & `user_agent`: Network and client environment metadata.
  - `created_at`: Timestamp with time zone.

---

## 3. Session Management (`sessions`)
- **Active Session Tracking**:
  - All logged-in users have an active session record in `sessions`.
  - Supervisors and administrators can view active sessions across hubs, inspect IP addresses, and immediately revoke suspicious sessions.
- **Deactivation Triggers**:
  - Automatically triggered upon logout, idle timeout, or when a device is blocked.

---

## 4. Blocked Devices & Appeals Workflow (`blocked_devices`, `appeals`)
1. **Device Blocking**:
   - Devices flagged for unauthorized access attempts, abnormal IP patterns, or policy violations are inserted into `blocked_devices`.
   - Database trigger `trg_deactivate_blocked_device_sessions` automatically deactivates all active sessions matching the blocked device.
2. **User Appeal Submission**:
   - Blocked users can submit a reinstatement appeal via the login screen.
   - Appeal record is created in `appeals` (`blocked_device_id`, `user_email`, `user_name`, `appeal_message`, `status = 'pending'`).
3. **Administrator Review**:
   - Administrators review the appeal, investigate security logs, and either approve or reject the request (`resolved_by`, `response_message`, `status = 'approved' | 'rejected'`).
   - If approved, device status updates to `'unblocked'`.
