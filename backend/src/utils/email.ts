import nodemailer from 'nodemailer';
import { MailtrapTransport } from 'mailtrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Send an email notification
 */
export async function sendEmailNotification(subject: string, html: string, toOverwrite?: string) {
    try {
        const setting = await prisma.settings.findUnique({
            where: { key: 'notification_email' }
        });
        const targetEmail = toOverwrite || setting?.value;

        if (!targetEmail) {
            console.log('⚠️ No notification email configured in settings. Skipping email.');
            return;
        }

        let transporter;

        // Use Mailtrap SDK if Token is provided
        if (process.env.MAILTRAP_TOKEN) {
            transporter = nodemailer.createTransport(
                MailtrapTransport({
                    token: process.env.MAILTRAP_TOKEN,
                })
            );
        } else {
            // Fallback to standard SMTP
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
                port: parseInt(process.env.SMTP_PORT || '2525'),
                auth: {
                    user: process.env.SMTP_USER || '',
                    pass: process.env.SMTP_PASS || '',
                },
            });
        }

        const mailOptions = {
            from: {
                address: process.env.EMAIL_SENDER_ADDRESS || 'noreply@perpus.com',
                name: process.env.EMAIL_SENDER_NAME || 'Sistem Perpustakaan',
            },
            to: targetEmail,
            subject: subject,
            html: html,
        };

        const info = await transporter.sendMail(mailOptions) as any;
        console.log('✅ Email sent: %s', info.messageId || info.id || 'OK');
        return info;
    } catch (error) {
        console.error('❌ Failed to send email:', error);
    }
}

/**
 * Templates for dynamic email content
 */
export const emailTemplates = {
    loanNotification: (memberName: string, books: { title: string }[], dueDate: Date) => `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4F46E5;">Notifikasi Peminjaman Buku</h2>
            <p>Halo,</p>
            <p>Transaksi peminjaman baru telah dicatat:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Peminjam:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">${memberName}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Buku:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;">
                        <ul style="margin: 0; padding-left: 20px;">
                            ${books.map(b => `<li>${b.title}</li>`).join('')}
                        </ul>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tgl Kembali:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #eee; color: #E11D48;">${dueDate.toLocaleDateString('id-ID')}</td>
                </tr>
            </table>
            <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                Harap pastikan buku dikembalikan sebelum tanggal jatuh tempo untuk menghindari denda.
            </p>
        </div>
    `,
    returnNotification: (memberName: string, items: { book: string, fine: number }[], totalFine: number) => `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #10B981;">Konfirmasi Pengembalian Buku</h2>
            <p>Halo,</p>
            <p>Buku telah berhasil dikembalikan oleh <strong>${memberName}</strong>:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #f9fafb;">
                        <th style="padding: 8px; border: 1px solid #eee; text-align: left;">Buku</th>
                        <th style="padding: 8px; border: 1px solid #eee; text-align: right;">Denda</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #eee;">${item.book}</td>
                            <td style="padding: 8px; border: 1px solid #eee; text-align: right;">Rp ${item.fine.toLocaleString('id-ID')}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold;">
                        <td style="padding: 8px; border: 1px solid #eee;">Total Denda</td>
                        <td style="padding: 8px; border: 1px solid #eee; text-align: right; color: #E11D48;">Rp ${totalFine.toLocaleString('id-ID')}</td>
                    </tr>
                </tfoot>
            </table>
            <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                Terima kasih telah menggunakan layanan perpustakaan kami.
            </p>
        </div>
    `
};
