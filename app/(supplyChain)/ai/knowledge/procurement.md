# Procurement Module

## Overview
Manages supplier relationships and purchase requests for warehouse operations.

## Key Features

### 1. Supplier Management
- Add/Edit/Delete suppliers
- Supplier categories: Tire Supplier, Auto Parts, Packaging, General Supplies
- Contact information management (name, phone, email, location)
- Active/Inactive status tracking
- Products/Services tracking
- **Messenger Link**: Optional Facebook Messenger link for direct supplier communication
- **Email Integration**: Direct email communication with suppliers

### 2. Purchase Requests
- Create purchase requests
- Multi-item requests support
- Supplier selection
- Status tracking: pending → approved → rejected → ordered → received
- Low stock auto-suggestions
- Priority levels: Normal, Urgent, Critical
- Department tracking: Fleet, Warehouse, Operations, Office

### 3. Purchase Orders
- **Direct AI Chat Creation**: Ask the AI assistant to "Create purchase order" to immediately pull all pending purchase requests without purchase orders. Select all or choose specific requests, then click "Create as Draft" or "Create & Send via Gmail".
- Auto-generate PO numbers
- AI-powered supplier message generation
- Send via Email or Messenger
- Status tracking: Draft → Sent → Confirmed → Delivered → Cancelled
- Confirmation link for supplier approval
- Copy to clipboard functionality
- Print-ready format

### 4. Reports
- Supplier performance reports
- Purchase history tracking
- Spending analysis
- Priority distribution charts
- Monthly spending trends

## Supplier Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Supplier Name | String | Yes | Company name |
| Category | String | Yes | Supplier type |
| Contact Person | String | Yes | Primary contact |
| Phone | String | Yes | Contact number |
| Email | String | Yes | Email address |
| Location | String | Yes | Address |
| Products | Text | No | Products/services offered |
| Notes | Text | No | Additional details |
| Active Status | Boolean | Yes | Supplier availability |
| Messenger Link | Text | No | Facebook Messenger profile link |

## Purchase Request Status Flow
Pending
│
├──→ Approved ──→ Ordered ──→ Received
│
└──→ Rejected

## Purchase Order Status Flow
Draft
│
├──→ Sent ──→ Confirmed ──→ Delivered
│
└──→ Cancelled


## AI Integration Features

### Supplier Message Generation
- AI generates professional supplier messages
- Includes order details, quantities, and pricing
- Auto-includes confirmation link
- Copy for Email or Messenger

### Communication Methods
- **Email**: Opens default email client with supplier's email pre-filled
- **Messenger**: Opens Facebook Messenger with supplier's profile link
- **Copy**: Copies message with confirmation link to clipboard
- **Print**: Print-ready format

### Confirmation Link
- Auto-generated for each purchase order
- Supplier clicks to confirm order
- Updates PO status to "Confirmed"
- Simple and secure

## Module Structure
procurement/
├── page.tsx # Main procurement dashboard
├── api/
│ ├── route.ts # Procurement API endpoints
│ └── gemini/
│ └── route.ts # AI message generation
├── utils/
│ └── procurementApi.ts # API utilities
└── confirm/
└── route.ts # Order confirmation page


## Tech Stack Integration

| Component | Technology |
|-----------|------------|
| UI Framework | Next.js 15+ (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| AI Integration | Google Gemini API |
| Charts | Chart.js |
| Notifications | Sonner |
| Icons | FontAwesome |
| Forms | React Hook Form |
| Validation | Zod |

## Security Features

- **Role-Based Access**: Admin and Employee roles
- **Input Sanitization**: All user inputs sanitized
- **Rate Limiting**: Prevents abuse
- **Supabase RLS**: Row-level security
- **Session Management**: Secure authentication

## Common User Workflows

### Creating a Purchase Request
1. Click "New Purchase Request"
2. Fill in supplier and item details
3. Submit for approval
4. Status updates in real-time

### Creating a Purchase Order
1. Find approved request
2. Click "Create PO"
3. Set item prices
4. Generate AI message
5. Send via Email or Messenger
6. Wait for supplier confirmation

### Managing Suppliers
1. Add new supplier with details
2. Set active status
3. Update contact information
4. Track performance

---

*This documentation describes the Procurement Module functionality and is maintained alongside the platform.*