// app/(supplyChain)/procurement/api/gemini/route.ts

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const apiKey = process.env.GEMINI_SUPPLYCHAIN_API_KEY;
const MODEL_NAME = process.env.GEMINI_SUPPLYCHAIN_MODEL || "gemini-3.5-flash-lite";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            supplier_name,
            items,
            total_amount,
            delivery_date,
            po_number,
            notes,
            sender_name,
            sender_position
        } = body;

        if (!supplier_name || !items || items.length === 0) {
            return NextResponse.json(
                { error: "Supplier name and items are required" },
                { status: 400 }
            );
        }

        // get auth user
        let senderName = sender_name || "Procurement Team";
        let senderPosition = sender_position || "Procurement Manager";

        // get user
        if (!sender_name || !sender_position) {
            try {
                const cookieStore = await cookies();
                const supabase = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    {
                        cookies: {
                            get(name: string) {
                                return cookieStore.get(name)?.value;
                            },
                            set(name: string, value: string, options: any) {
                                // no cookies
                            },
                            remove(name: string, options: any) {
                                // no cookies
                            },
                        },
                    }
                );

                const { data: { user }, error } = await supabase.auth.getUser();

                if (!error && user) {
                    const { data: userData, error: userError } = await supabase
                        .from('users')
                        .select('full_name, position')
                        .eq('id', user.id)
                        .single();

                    if (!userError && userData) {
                        senderName = userData.full_name || senderName;
                        senderPosition = userData.position || senderPosition;
                    } else {
                        senderName = user.email?.split('@')[0] || senderName;
                    }
                }
            } catch (sessionError) {
                console.warn('Could not get user session:', sessionError);
            }
        }

        const genAI = new GoogleGenAI({ apiKey });

        const prompt = `
You are a procurement assistant generating a professional purchase order message for a supplier.

**Supplier:** ${supplier_name}
**Items:**
${items.map((item: any) => `- ${item.name}: ${item.quantity} x ₱${item.unit_price || 0} = ₱${(item.quantity * (item.unit_price || 0)).toLocaleString()}`).join('\n')}
**Total Amount:** ₱${total_amount.toLocaleString()}
**PO Number:** ${po_number || 'TBD'}
**Delivery Date:** ${delivery_date || 'TBD'}
**Notes:** ${notes || 'None'}
**Sender Name:** ${senderName}
**Position:** ${senderPosition}

Generate a concise, professional, and friendly email to a supplier regarding a purchase order.

**🔥 CRITICAL: Make each response UNIQUE and DYNAMIC. Never use the same phrasing twice.**

**VARIETY RULES:**
1. **Greetings:** Vary between:
   - "Dear [Supplier],"
   - "Good morning/afternoon [Supplier],"
   - "Greetings [Supplier],"
   - "Hello [Supplier],"
   - "Hi [Supplier],"

2. **Opening Lines:** Vary the opening sentence:
   - "We hope this email finds you well."
   - "I hope you're having a great week."
   - "This message is regarding our purchase order."
   - "We would like to place a purchase order with you."
   - "We are reaching out to confirm our latest order."
   - "We are pleased to share our recent purchase order."
   - "We would like to proceed with the following order."
   - "We have prepared a purchase order for your review."

3. **Order Presentation:** Vary how you present the items:
   - Use bullet points in one version, paragraphs in another
   - Sometimes list items with quantities, sometimes mention them narratively
   - Sometimes use a table format, sometimes a simple list

4. **Amount & Dates:** Vary how you present:
   - "The total comes to..." vs "The grand total is..." vs "Total amount:"
   - "We would appreciate delivery by..." vs "Could you confirm delivery for..." vs "Expected delivery date:"

5. **Tone Variations:**
   - **Professional:** Formal and business-like
   - **Friendly:** Warm but professional
   - **Direct:** Concise and to the point
   - **Collaborative:** Partnership-focused

6. **Closing Lines:** Vary the closing:
   - "We look forward to your confirmation."
   - "Please confirm receipt of this order."
   - "We appreciate your partnership."
   - "Let us know if you need any further information."
   - "We're excited to continue working with you."
   - "Thank you for your attention to this matter."

7. **Sign-off Variations:**
   - "Best regards," / "Sincerely," / "Yours faithfully," / "With kind regards," / "Thank you,"

**ADDITIONAL DYNAMIC ELEMENTS:**
- Sometimes mention something positive about the supplier relationship
- Sometimes include a brief thank you for their previous service
- Sometimes mention looking forward to future collaboration
- Vary the level of detail in item descriptions

**RANDOM STYLE SELECTION:**
Randomly select ONE of these styles for each response:
1. **Formal Professional** - Very business-like, traditional
2. **Warm & Collaborative** - Relationship-focused, friendly
3. **Direct & Efficient** - Short, to the point, modern
4. **Enthusiastic** - Positive, energetic tone

The email should be signed with the sender's name (${senderName}) and position (${senderPosition}).

**IMPORTANT:**
- Make each response sound DIFFERENT from the previous one
- Vary sentence structure and word choice
- Never start with the same greeting twice
- Never use the same closing twice
- Keep it professional but varied
- Output only the final email in plain text
- Do not use Markdown, bullet points, tables, emojis, or explanations
- Use natural line breaks for readability`;

        const response = await genAI.interactions.create({
            model: MODEL_NAME,
            input: prompt,
        });

        const message = response.output_text || '';

        return NextResponse.json({
            success: true,
            message: message,
            senderName: senderName,
            senderPosition: senderPosition,
        });

    } catch (error) {
        console.error('❌ Gemini API Error:', error);
        return NextResponse.json(
            { error: "Failed to generate message" },
            { status: 500 }
        );
    }
}