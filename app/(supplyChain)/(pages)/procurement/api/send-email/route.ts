// app/(supplyChain)/procurement/api/send-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_SUPPLYCHAIN_USER,
        pass: process.env.EMAIL_SUPPLYCHAIN_PASS,
    },
});

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

        // verify connection
        await transporter.verify();

        // send email
        const info = await transporter.sendMail({
            from: `"AirshipExpress" <${process.env.EMAIL_SUPPLYCHAIN_USER}>`,
            to: to,
            subject: subject,
            text: text || '',
            html: html,
            replyTo: process.env.EMAIL_SUPPLYCHAIN_USER,
        });

        return NextResponse.json({
            success: true,
            messageId: info.messageId,
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