import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Event } from '../calendar/entities/event.entity';
import { EventAttachment } from '../calendar/entities/event-attachment.entity';

export interface MailRecipient {
  name: string;
  email: string;
}

interface MailBadge {
  text: string;
  bg: string;
  color: string;
  borderColor: string;
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
      tls: { rejectUnauthorized: true },
    } as any);
  }

  private isEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendEventRejected(event: Event, creator: MailRecipient, reason: string): Promise<void> {
    if (!this.isEnabled()) return;
    const esc = (s: string) => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const extraHtml = reason
      ? `<div style="margin-top:10px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px">
           <div style="font-size:11px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Lý do từ chối</div>
           <div style="font-size:13px;color:#7f1d1d;line-height:1.5">${esc(reason)}</div>
         </div>`
      : '';
    await this.sendBulk(
      [creator],
      `[ICTU Calendar] Sự kiện bị từ chối: ${event.title}`,
      (r) => this.buildEventHtml(event, {
        recipient: r,
        badge: { text: 'Bị từ chối', bg: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' },
        intro: 'Sự kiện bạn tạo đã bị từ chối. Vui lòng xem lý do bên dưới và chỉnh sửa lại nếu cần.',
        extraHtml,
      }),
    );
  }

  async sendEventCancelled(event: Event, recipients: MailRecipient[], cancelledBy: string, cancelReason?: string): Promise<void> {
    if (!this.isEnabled() || recipients.length === 0) return;
    const esc = (s: string) => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const extraHtml = cancelReason
      ? `<div style="margin-top:10px;padding:10px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px">
           <div style="font-size:11px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Lý do hủy</div>
           <div style="font-size:13px;color:#7c2d12;line-height:1.5">${esc(cancelReason)}</div>
         </div>`
      : '';
    await this.sendBulk(
      recipients,
      `[ICTU Calendar] Sự kiện đã bị hủy: ${event.title}`,
      (r) => this.buildEventHtml(event, {
        recipient: r,
        badge: { text: 'Đã hủy', bg: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' },
        intro: `Sự kiện dưới đây đã bị hủy bởi <strong>${esc(cancelledBy)}</strong>. Vui lòng cập nhật lịch làm việc của bạn.`,
        extraHtml,
      }),
    );
  }

  async sendEventApproved(event: Event, recipients: MailRecipient[], attachments: EventAttachment[] = []): Promise<void> {
    if (!this.isEnabled() || recipients.length === 0) return;
    await this.sendBulk(
      recipients,
      `[ICTU Calendar] Đã phê duyệt: ${event.title}`,
      (r) => this.buildEventHtml(event, {
        recipient: r,
        attachments,
        badge: { text: 'Đã phê duyệt', bg: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' },
        intro: 'Sự kiện bạn tham dự dưới đây đã được phê duyệt và chính thức có hiệu lực.',
      }),
      attachments,
    );
  }

  private async sendBulk(
    recipients: MailRecipient[],
    subject: string,
    htmlFactory: (r: MailRecipient) => string,
    attachments: EventAttachment[] = [],
  ): Promise<void> {
    if (!this.transporter) return;
    const from = `"ICTU Calendar" <${this.configService.get('MAIL_USER')}>`;

    // File lưu trên MinIO, không có local path — chỉ hiển thị tên file trong body email
    const mailAttachments: nodemailer.Attachment[] = [];

    const results = await Promise.allSettled(
      recipients.map((r) =>
        this.transporter!.sendMail({
          from,
          to: `"${r.name}" <${r.email}>`,
          subject,
          html: htmlFactory(r),
          encoding: 'utf-8',
          attachments: mailAttachments,
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
      this.logger.log(`Đã gửi mail thông báo tới ${recipients.length} người`);
    }
  }

  private buildEventHtml(
    event: Event,
    opts: { recipient?: MailRecipient; badge: MailBadge; intro: string; attachments?: EventAttachment[]; extraHtml?: string },
  ): string {
    const { recipient, badge, intro, attachments = [], extraHtml = '' } = opts;
    const appUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const formatDate = (d: Date | string) =>
      new Date(d).toLocaleDateString('vi-VN', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      });

    const fmt = (t?: string | null) => t?.slice(0, 5) ?? null;
    const timeStr = event.allDay
      ? 'Cả ngày'
      : [fmt(event.startTime), fmt(event.endTime)].filter(Boolean).join(' – ');

    const timeValue = `${timeStr ? esc(timeStr) + ' | ' : ''}${formatDate(event.eventDate)}`;

    // Highlight block: Thời gian + Địa điểm nổi bật ở trên
    const highlightBlock = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;border-radius:8px;overflow:hidden;border:1.5px solid #bfdbfe">
        <tr>
          <td width="50%" style="background:#1d4ed8;padding:12px 16px;vertical-align:top">
            <div style="font-size:10px;font-weight:700;color:#bfdbfe;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">&#128197; Thời gian</div>
            <div style="font-size:13px;color:#ffffff;font-weight:700;line-height:1.5">${timeValue}</div>
          </td>
          <td width="50%" style="background:#1e40af;padding:12px 16px;vertical-align:top;border-left:1px solid #3b82f6">
            <div style="font-size:10px;font-weight:700;color:#bfdbfe;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">&#128205; Địa điểm</div>
            <div style="font-size:13px;color:#ffffff;font-weight:700;line-height:1.5">${esc(event.location ?? '—')}</div>
          </td>
        </tr>
      </table>`;

    // Các trường còn lại (không có Thời gian, Địa điểm)
    const detailRows: [string, string][] = ([
      ['Đơn vị chủ trì', esc(event.organizingUnit ?? '')],
      ['ĐU/BGH Chỉ đạo', esc(event.supervisor     ?? '')],
      ['Thành phần',     esc(event.participants   ?? '')],
    ] as [string, string][]).filter(([, v]) => v !== '');

    const mkCell = (label: string, value: string, borderRight = false) =>
      `<td style="padding:8px 14px;vertical-align:top;${borderRight ? 'border-right:1px solid #e2e8f0;' : ''}width:50%">
        <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
        <div style="font-size:13px;color:#1e293b;line-height:1.5;font-weight:500">${value}</div>
      </td>`;

    const pairs: [string, string][][] = [];
    for (let i = 0; i < detailRows.length; i += 2) pairs.push(detailRows.slice(i, i + 2));

    const detailTableRows = pairs.map((pair, pi) => {
      const isLast = pi === pairs.length - 1;
      const bg = pi % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `<tr style="${isLast ? '' : 'border-bottom:1px solid #e2e8f0;'}background:${bg}">
        ${mkCell(pair[0][0], pair[0][1], pair.length > 1)}
        ${pair[1] ? mkCell(pair[1][0], pair[1][1]) : '<td></td>'}
      </tr>`;
    }).join('');

    const detailTable = detailRows.length > 0
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:7px;overflow:hidden;margin-bottom:10px">
          ${detailTableRows}
         </table>`
      : '';

    const notesBlock = event.notes
      ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:8px 14px;margin-top:10px">
           <span style="font-size:13px;color:#713f12;line-height:1.5"><strong>Ghi chú:</strong> ${esc(event.notes)}</span>
         </div>`
      : '';

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // File đính kèm: chỉ hiển thị tên + size dạng text gọn, không giả vờ có thể click
    const attachmentsBlock = attachments.length > 0
      ? `<div style="margin-top:10px;padding:8px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">
           <span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px">
             &#128206; File đính kèm (${attachments.length}) — xem file trong hệ thống
           </span>
           <div style="margin-top:5px;font-size:12px;color:#64748b;line-height:1.8">
             ${attachments.map(a => `${esc(a.originalName)} <span style="color:#94a3b8">(${formatSize(Number(a.size))})</span>`).join(' &nbsp;·&nbsp; ')}
           </div>
         </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:20px 12px">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px">

      <!-- Header -->
      <tr>
        <td style="background:#0f2d5e;border-radius:10px 10px 0 0;padding:16px 22px">
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#7dd3fc;letter-spacing:2px;text-transform:uppercase">ICTU CALENDAR</p>
          <h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;line-height:1.3;word-break:break-word">${esc(event.title)}</h1>
        </td>
      </tr>

      <!-- Status + Greeting -->
      <tr>
        <td style="background:#ffffff;padding:12px 22px 8px">
          <span style="display:inline-block;padding:3px 10px;background:${badge.bg};color:${badge.color};border:1px solid ${badge.borderColor};border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase">${badge.text}</span>
          ${recipient ? `<span style="font-size:13px;color:#475569;margin-left:10px">Kính gửi <strong style="color:#1e293b">${esc(recipient.name)}</strong></span>` : ''}
        </td>
      </tr>

      <!-- Intro -->
      <tr>
        <td style="background:#ffffff;padding:0 22px 12px">
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6">${intro}</p>
        </td>
      </tr>

      <!-- Info -->
      <tr>
        <td style="background:#ffffff;padding:0 22px 18px">
          ${highlightBlock}
          ${detailTable}
          ${notesBlock}
          ${attachmentsBlock}
          ${extraHtml}
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#ffffff;padding:0 22px 18px;text-align:center">
          <p style="margin:0 0 10px;font-size:12px;color:#64748b">Để biết thêm chi tiết, vui lòng truy cập hệ thống:</p>
          <a href="${appUrl}" style="display:inline-block;padding:9px 24px;background:#1d4ed8;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.3px">Truy cập ICTU Calendar</a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 10px 10px;padding:10px 22px">
          <p style="margin:0 0 1px;font-size:11px;font-weight:600;color:#0f2d5e">Trường Đại học Công nghệ Thông tin và Truyền thông</p>
          <p style="margin:0;font-size:10px;color:#94a3b8">Đây là email tự động từ hệ thống ICTU Calendar. Vui lòng không trả lời email này.</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
  }
}
