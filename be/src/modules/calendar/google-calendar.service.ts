import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { UsersService } from '../users/users.service';
import { Event, EventStatus } from './entities/event.entity';

export interface SyncResult {
  synced: number;
  skipped: number;
  duplicates: number;
  errors: string[];
}

@Injectable()
export class GoogleCalendarService {
  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
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
