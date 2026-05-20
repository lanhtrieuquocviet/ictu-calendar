import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryType } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  async findAll(type?: CategoryType): Promise<Category[]> {
    const where = type ? { type, isActive: true } : { isActive: true };
    return this.repo.find({ where, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async findAllAdmin(type?: CategoryType): Promise<Category[]> {
    const where = type ? { type } : {};
    return this.repo.find({ where, order: { type: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.repo.findOne({ where: { type: dto.type, value: dto.value } });
    if (existing) throw new ConflictException('Danh mục đã tồn tại');
    const category = this.repo.create({ ...dto, sortOrder: dto.sortOrder ?? 0 });
    return this.repo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.repo.update(id, dto);
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException(`Category #${id} not found`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Category #${id} not found`);
    await this.repo.delete(id);
  }

  async seed(): Promise<void> {
    const defaults: { type: CategoryType; value: string; sortOrder: number }[] = [
      { type: CategoryType.LOCATION, value: 'Phòng họp số 1 ĐHTN', sortOrder: 0 },
      { type: CategoryType.LOCATION, value: 'Phòng họp số 2', sortOrder: 1 },
      { type: CategoryType.LOCATION, value: 'Phòng họp số 3', sortOrder: 2 },
      { type: CategoryType.LOCATION, value: 'Hội trường đa năng', sortOrder: 3 },
      { type: CategoryType.LOCATION, value: 'Hội trường tầng 5', sortOrder: 4 },
      { type: CategoryType.LOCATION, value: 'Phòng Lab Samsung', sortOrder: 5 },
      { type: CategoryType.LOCATION, value: 'Bộ GD&ĐT', sortOrder: 6 },
      { type: CategoryType.LOCATION, value: 'Công an tỉnh Thái Nguyên', sortOrder: 7 },
      { type: CategoryType.VEHICLE, value: 'Xe 00715', sortOrder: 0 },
      { type: CategoryType.VEHICLE, value: 'Xe 004.70', sortOrder: 1 },
      { type: CategoryType.MEDIA_UNIT, value: 'Truyền thông', sortOrder: 0 },
      { type: CategoryType.SUPERVISOR, value: 'PGS.TS. Phùng Trung Nghĩa', sortOrder: 0 },
      { type: CategoryType.SUPERVISOR, value: 'TS. Nguyễn Duy Minh', sortOrder: 1 },
      { type: CategoryType.SUPERVISOR, value: 'TS. Đỗ Đình Cường', sortOrder: 2 },
      { type: CategoryType.SUPERVISOR, value: 'TS. Nguyễn Văn Tào', sortOrder: 3 },
    ];

    for (const item of defaults) {
      const exists = await this.repo.findOne({ where: { type: item.type, value: item.value } });
      if (!exists) {
        await this.repo.save(this.repo.create(item));
      }
    }
  }
}
