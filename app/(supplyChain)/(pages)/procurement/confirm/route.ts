import { NextRequest } from "next/server";
import { supabase } from "@/app/(supplyChain)/lib/services/client/supabase";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const po = searchParams.get('po');

    if (!po) {
        return new Response('Missing PO number', { status: 400 });
    }

    const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'Confirmed', updated_at: new Date().toISOString() })
        .eq('po_number', po);

    if (error) {
        console.error('Error confirming PO:', error);
        return new Response('Failed to confirm PO', { status: 500 });
    }

    return new Response(`
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PO Confirmed — ${po}</title>
    <style>
        :root {
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --border: #e2e8f0;
            --text-title: #0f172a;
            --text-body: #475569;
            --text-muted: #94a3b8;
            --badge-bg: #f1f5f9;
            --badge-text: #0f172a;
            --badge-border: #cbd5e1;
            --status-bg: #ecfdf5;
            --status-text: #047857;
            --status-border: #a7f3d0;
            --ring: #dcfce7;
            --check-fill: #10b981;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0b0f19;
                --card-bg: #131b2e;
                --border: #1e293b;
                --text-title: #f8fafc;
                --text-body: #94a3b8;
                --text-muted: #64748b;
                --badge-bg: #1e293b;
                --badge-text: #e2e8f0;
                --badge-border: #334155;
                --status-bg: rgba(6, 78, 59, 0.4);
                --status-text: #34d399;
                --status-border: rgba(5, 150, 105, 0.4);
                --ring: rgba(16, 185, 129, 0.15);
                --check-fill: #10b981;
            }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text-body);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            -webkit-font-smoothing: antialiased;
        }

        .card {
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 48px 36px 36px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.07);
            animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Success Animated Icon */
        .icon-container {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: var(--ring);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
        }

        .icon-inner {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: var(--check-fill);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .icon-inner svg {
            width: 28px;
            height: 28px;
            stroke: #ffffff;
            stroke-width: 3;
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
        }

        h1 {
            color: var(--text-title);
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin-bottom: 8px;
        }

        .subtitle {
            color: var(--text-body);
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 24px;
        }

        /* Order Details Box */
        .details-box {
            background: var(--badge-bg);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px 18px;
            margin-bottom: 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-align: left;
        }

        .details-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
        }

        .po-number {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 14px;
            font-weight: 700;
            color: var(--badge-text);
            margin-top: 2px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--status-bg);
            color: var(--status-text);
            border: 1px solid var(--status-border);
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
        }

        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
        }

        .footer-note {
            font-size: 13px;
            color: var(--text-muted);
            line-height: 1.5;
            padding-top: 20px;
            border-top: 1px solid var(--border);
        }
    </style>
</head>
<body>
    <div class="card">
        <!-- Success Icon -->
        <div class="icon-container">
            <div class="icon-inner">
                <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        </div>

        <!-- Headings -->
        <h1>Purchase Order Confirmed</h1>
        <p class="subtitle">Your confirmation has been recorded and updated across all procurement systems.</p>

        <!-- Information Card -->
        <div class="details-box">
            <div>
                <span class="details-label">Order Reference</span>
                <p class="po-number">${po}</p>
            </div>
            <div class="status-badge">
                <span class="status-dot"></span>
                Confirmed
            </div>
        </div>

        <!-- Footer Note -->
        <p class="footer-note">
            Thank you for confirming this order. You may now close this window safely.
        </p>
    </div>
</body>
</html>
    `, {
        headers: { 'Content-Type': 'text/html' },
    });
}