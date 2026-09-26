// app/(supplyChain)/procurement/api/send-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sendSupplyChainEmail } from '../../../../lib/email/mailer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { to, subject, html, text, po_number, supplier_name } = body;

        if (!to || !subject || !html) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: to, subject, html' },
                { status: 400 }
            );
        }

        const result = await sendSupplyChainEmail({
            to,
            subject,
            html,
            text: text || '',
            senderName: 'Airship Express Procurement',
            senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER,
            replyTo: process.env.EMAIL_SUPPLYCHAIN_USER,
        });

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            provider: result.provider,
            message: 'Email sent successfully',
        });

    } catch (error: any) {
        let errorMessage = 'Failed to send email';
        if (error.code === 'EAUTH') {
            errorMessage = 'Email authentication failed. Please check your credentials.';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Could not connect to email server. Please check your internet connection.';
        }

        return NextResponse.json(
            { success: false, error: errorMessage, details: error.message },
            { status: 500 }
        );
    }
}