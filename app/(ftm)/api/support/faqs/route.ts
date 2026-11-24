import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";

const FAQS = [
  { id: "faq-1", question: "How do I start a trip?", answer: 'Open the trip from the Trips tab and tap "Start Trip". Your location will begin sharing with dispatch automatically.' },
  { id: "faq-2", question: "How do I log a fuel or toll expense?", answer: "Go to Expenses > Add Expense, take a photo of the receipt, and the amount/category will auto-fill when possible. You can always edit before submitting." },
  { id: "faq-3", question: "What do I do if my vehicle breaks down?", answer: "Use Vehicle Details > Report an Issue to notify dispatch immediately, including a description of the problem." },
  { id: "faq-4", question: "Why does my route change automatically?", answer: "Routes are optimized automatically by OR-Tools whenever a new stop is dispatched to your vehicle, so your stop order may update without you doing anything." },
  { id: "faq-5", question: "I forgot my PIN. What now?", answer: "Ask your dispatcher to reset your account from the admin dashboard." },
];

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "operations", "view")) {
    return NextResponse.json({ error: "Permission denied: operations.view" }, { status: 403 });
  }
  return NextResponse.json(FAQS);
}