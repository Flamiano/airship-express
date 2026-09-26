import { NextRequest, NextResponse } from 'next/server';
import { sendSupplyChainEmail } from '../../lib/email/mailer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { to, subject, html, text, senderName, senderEmail, replyTo, attachments, cc, bcc } = body;

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
            senderName,
            senderEmail,
            replyTo,
            attachments,
            cc,
            bcc
        });

        return NextResponse.json({
            success: true,
            messageId: result.messageId,
            provider: result.provider,
            message: 'Email sent successfully',
        });

    } catch (error: any) {
        console.error('Error in send-email route:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to send email' },
            { status: 500 }
        );
    }
}
