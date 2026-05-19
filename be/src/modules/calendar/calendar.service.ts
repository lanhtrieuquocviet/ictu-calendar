import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    const event = this.eventRepository.create({ ...dto, userId });
    return this.eventRepository.save(event);
  }

  async findAll(from?: string, to?: string): Promise<Event[]> {
    const where: any = {};
    if (from && to) {
      where.eventDate = Between(new Date(from), new Date(to));
    }
    return this.eventRepository.find({
      where,
      order: { eventDate: 'ASC', startTime: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) throw new NotFoundException(`Sự kiện #${id} không tồn tại`);
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    await this.findOne(id);
    await this.eventRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.eventRepository.delete(id);
  }
}
