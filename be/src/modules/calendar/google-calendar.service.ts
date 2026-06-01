import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { UsersService } from '../users/users.service';
import { Event, EventStatus } from './entities/event.entity';
import { PersonalEvent } from './entities/personal-event.entity';

export interface SyncResult {
  synced: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

export interface ImportResult {
  imported: number;
  updated: number;
  deleted: number;
  errors: string[];
}

@Injectable()
export class GoogleCalendarService {
  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(PersonalEvent)
    private personalEventRepo: Repository<PersonalEvent>,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  async syncEventsToGoogle(userId: string, events: Event[]): Promise<SyncResult> {
    const tokenRecord = await this.usersService.getGoogleToken(userId);
    if (!tokenRecord) {
      throw new BadRequestException('Bạn chưa đăng nhập bằng Google. Vui lòng đăng nhập lại bằng Google để đồng bộ lịch.');
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });

    if (tokenRecord.tokenExpiry && new Date() >= tokenRecord.tokenExpiry) {
      if (!tokenRecord.refreshToken) {
        throw new BadRequestException(
          'Phiên đăng nhập Google đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại bằng Google để đồng bộ lịch.',
        );
      }
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await this.usersService.saveGoogleTokens(
          userId,
          credentials.access_token!,
          credentials.refresh_token ?? null,
        );
        oauth2Client.setCredentials(credentials);
      } catch {
        throw new BadRequestException(
          'Không thể gia hạn phiên Google. Vui lòng đăng xuất rồi đăng nhập lại bằng Google.',
        );
      }
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const result: SyncResult = { synced: 0, skipped: 0, duplicates: 0, errors: [] };

    const approvedEvents = events.filter(e => e.status === EventStatus.APPROVED);

    for (const event of approvedEvents) {
      // Bỏ qua nếu đã được sync trước đó
      if (event.googleEventId) {
        result.duplicates++;
        continue;
      }

      try {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: this.buildGoogleEvent(event),
        });

        // Lưu Google event ID vào DB để chống trùng lần sau
        await this.eventRepo.update(event.id, { googleEventId: response.data.id! });
        result.synced++;
      } catch (err: any) {
        result.errors.push(`${event.title}: ${err.message}`);
        result.skipped++;
      }
    }

    return result;
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_CALLBACK_URL'),
    );
  }

  async importFromGoogle(userId: string, from?: string, to?: string): Promise<ImportResult> {
    const tokenRecord = await this.usersService.getGoogleToken(userId);
    if (!tokenRecord) {
      throw new BadRequestException('Bạn chưa đăng nhập bằng Google. Vui lòng đăng nhập lại bằng Google để đồng bộ lịch.');
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });

    if (tokenRecord.tokenExpiry && new Date() >= tokenRecord.tokenExpiry) {
      if (!tokenRecord.refreshToken) {
        throw new BadRequestException('Phiên đăng nhập Google đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại bằng Google.');
      }
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await this.usersService.saveGoogleTokens(userId, credentials.access_token!, credentials.refresh_token ?? null);
        oauth2Client.setCredentials(credentials);
      } catch {
        throw new BadRequestException('Không thể gia hạn phiên Google. Vui lòng đăng xuất rồi đăng nhập lại bằng Google.');
      }
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const result: ImportResult = { imported: 0, updated: 0, deleted: 0, errors: [] };

    // Mặc định tháng hiện tại
    if (!from || !to) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      from = `${y}-${m}-01`;
      to = `${y}-${m}-${lastDay}`;
    }

    let googleEvents: any[] = [];
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(`${from}T00:00:00+07:00`).toISOString(),
        timeMax: new Date(`${to}T23:59:59+07:00`).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 500,
      });
      googleEvents = response.data.items ?? [];
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy dữ liệu từ Google Calendar: ${err.message}`);
    }

    // Lọc bỏ sự kiện do hệ thống này sync lên (tránh vòng lặp)
    const externalEvents = googleEvents.filter(
      (e) => !e.description?.includes('Nguồn: ICTU Calendar'),
    );

    const googleIds = externalEvents.map((e) => e.id as string);

    // Xóa các personal_events không còn trong Google nữa (trong khoảng ngày đang sync)
    const existingInRange = await this.personalEventRepo
      .createQueryBuilder('pe')
      .where('pe.userId = :userId', { userId })
      .andWhere('pe.eventDate >= :from', { from })
      .andWhere('pe.eventDate <= :to', { to })
      .getMany();

    for (const existing of existingInRange) {
      if (!googleIds.includes(existing.googleEventId)) {
        await this.personalEventRepo.delete(existing.id);
        result.deleted++;
      }
    }

    const syncedAt = new Date();

    for (const gEvent of externalEvents) {
      try {
        const parsed = this.parseGoogleEvent(gEvent);
        if (!parsed) continue;

        const existing = await this.personalEventRepo.findOne({
          where: { userId, googleEventId: gEvent.id },
        });

        if (existing) {
          await this.personalEventRepo.update(existing.id, { ...parsed, syncedAt });
          result.updated++;
        } else {
          await this.personalEventRepo.save({ ...parsed, userId, googleEventId: gEvent.id, syncedAt });
          result.imported++;
        }
      } catch (err: any) {
        result.errors.push(`${gEvent.summary ?? '(no title)'}: ${err.message}`);
      }
    }

    return result;
  }

  async getPersonalEvents(userId: string, from: string, to: string): Promise<PersonalEvent[]> {
    return this.personalEventRepo
      .createQueryBuilder('pe')
      .where('pe.userId = :userId', { userId })
      .andWhere('pe.eventDate >= :from', { from })
      .andWhere('pe.eventDate <= :to', { to })
      .orderBy('pe.eventDate', 'ASC')
      .addOrderBy('pe.startTime', 'ASC')
      .getMany();
  }

  async deletePersonalEvent(id: string, userId: string): Promise<void> {
    await this.personalEventRepo.delete({ id, userId });
  }

  private parseGoogleEvent(gEvent: any): Partial<PersonalEvent> | null {
    const summary = gEvent.summary?.trim();
    if (!summary) return null;

    const startRaw = gEvent.start?.dateTime ?? gEvent.start?.date;
    if (!startRaw) return null;

    const allDay = !gEvent.start?.dateTime;
    const eventDate = startRaw.slice(0, 10);

    let startTime: string | null = null;
    let endTime: string | null = null;

    if (!allDay) {
      // dateTime format: "2026-06-01T09:00:00+07:00" — lấy HH:MM
      startTime = startRaw.slice(11, 16);
      const endRaw = gEvent.end?.dateTime;
      if (endRaw) endTime = endRaw.slice(11, 16);
    }

    // Màu: Google dùng colorId (1–11), chuyển sang hex đơn giản
    const colorMap: Record<string, string> = {
      '1': '#ac725e', '2': '#d06b64', '3': '#f83a22', '4': '#fa573c',
      '5': '#ff7537', '6': '#ffad46', '7': '#42d692', '8': '#16a765',
      '9': '#7bd148', '10': '#b3dc6c', '11': '#fbe983',
    };
    const color = gEvent.colorId ? (colorMap[gEvent.colorId] ?? '#4285f4') : '#4285f4';

    return {
      title: summary,
      eventDate: new Date(eventDate + 'T00:00:00'),
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
      allDay,
      location: gEvent.location ?? null,
      description: gEvent.description ?? null,
      color,
    };
  }

  private buildGoogleEvent(event: Event): object {
    const dateStr = typeof event.eventDate === 'string'
      ? event.eventDate
      : event.eventDate.toISOString().split('T')[0];

    const hasTime = !!event.startTime;

    // MySQL time type returns "HH:MM:SS" — use directly, no extra ":00"
    const start = hasTime
      ? { dateTime: `${dateStr}T${event.startTime}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' }
      : { date: dateStr };

    const end = hasTime && event.endTime
      ? { dateTime: `${dateStr}T${event.endTime}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' }
      : hasTime
        ? { dateTime: `${dateStr}T${event.startTime}+07:00`, timeZone: 'Asia/Ho_Chi_Minh' }
        : { date: dateStr };

    const description = [
      event.organizingUnit ? `Đơn vị chủ trì: ${event.organizingUnit}` : '',
      event.participants ? `Thành phần: ${event.participants}` : '',
      event.notes ? `Ghi chú: ${event.notes}` : '',
      `Nguồn: ICTU Calendar`,
    ].filter(Boolean).join('\n');

    return {
      summary: event.title,
      location: event.location ?? '',
      description,
      start,
      end,
    };
  }
}
