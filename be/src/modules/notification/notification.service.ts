import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Event } from '../calendar/entities/event.entity';

export interface MailRecipient {
  name: string;
  email: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');

    if (!user || !pass) {
      this.logger.warn('MAIL_USER / MAIL_PASS chưa cấu hình — email notification bị tắt');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: { user, pass },
    });
  }

  private isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendEventCreated(event: Event, recipients: MailRecipient[]): Promise<void> {
    if (!this.isEnabled() || recipients.length === 0) return;

    const subject = `[ICTU Calendar] Lịch mới: ${event.title}`;
    const html = this.buildEventHtml(event, 'Bạn được mời tham dự sự kiện sau:');

    await this.sendBulk(recipients, subject, html);
  }

  async sendEventApproved(event: Event, recipients: MailRecipient[]): Promise<void> {
    if (!this.isEnabled() || recipients.length === 0) return;

    const subject = `[ICTU Calendar] Lịch đã được duyệt: ${event.title}`;
    const html = this.buildEventHtml(event, 'Sự kiện sau đã được <strong style="color:#16a34a">PHÊ DUYỆT</strong>:');

    await this.sendBulk(recipients, subject, html);
  }

  async sendEventUpdated(event: Event, recipients: MailRecipient[]): Promise<void> {
    if (!this.isEnabled() || recipients.length === 0) return;

    const subject = `[ICTU Calendar] Lịch đã thay đổi: ${event.title}`;
    const html = this.buildEventHtml(event, '⚠️ Thông tin sự kiện dưới đây vừa được <strong>cập nhật</strong>:');

    await this.sendBulk(recipients, subject, html);
  }

  private async sendBulk(recipients: MailRecipient[], subject: string, html: string): Promise<void> {
    const from = `"ICTU Calendar" <${this.configService.get('MAIL_USER')}>`;

    const results = await Promise.allSettled(
      recipients.map((r) =>
        this.transporter!.sendMail({
          from,
          to: `"${r.name}" <${r.email}>`,
          subject,
          html,
        }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.error(`Gửi mail thất bại ${failed.length}/${recipients.length} người`);
      failed.forEach((f) => {
        if (f.status === 'rejected') this.logger.error(f.reason);
      });
    } else {
      this.logger.log(`✅ Đã gửi mail thông báo tới ${recipients.length} người`);
    }
  }

  private buildEventHtml(event: Event, intro: string): string {
    const formatDate = (d: Date | string) => {
      const date = new Date(d);
      return date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const timeStr = event.allDay
      ? 'Cả ngày'
      : [event.startTime, event.endTime].filter(Boolean).join(' – ');

    const rows = [
      ['📅 Thời gian', `${timeStr ? timeStr + ' | ' : ''}${formatDate(event.eventDate)}`],
      ['📍 Địa điểm', event.location || '—'],
      ['🏢 Đơn vị chủ trì', event.organizingUnit || '—'],
      ['👤 ĐU/BGH Chỉ đạo', event.supervisor || '—'],
      ['👥 Thành phần', event.participants || '—'],
    ].filter(([, v]) => v !== '—');

    const tableRows = rows
      .map(
        ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;color:#6b7280;white-space:nowrap;font-size:13px">${label}</td>
          <td style="padding:8px 12px;color:#111827;font-size:13px">${value}</td>
        </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#4f46e5;padding:20px 24px">
      <p style="color:#fff;margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase">ICTU CALENDAR</p>
      <h1 style="color:#fff;margin:8px 0 0;font-size:20px;line-height:1.3">${event.title}</h1>
    </div>
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 16px">${intro}</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
        ${tableRows}
      </table>
      ${event.notes ? `<p style="color:#6b7280;font-size:13px;margin:16px 0 0"><strong>Ghi chú:</strong> ${event.notes}</p>` : ''}
    </div>
    <div style="background:#f9fafb;padding:14px 24px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Email được gửi tự động từ hệ thống ICTU Calendar — Trường Đại học Công nghệ Thông tin và Truyền thông.
      </p>
    </div>
  </div>
</body>
</html>`;
  }
}
