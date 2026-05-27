import { Module } from '@nestjs/common';
import { SeederService } from './seeder.service';
import { UsersModule } from '../../modules/users/users.module';
import { DepartmentsModule } from '../../modules/departments/departments.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../../modules/departments/entities/department.entity';
import { Category } from '../../modules/categories/entities/category.entity';

@Module({
  imports: [UsersModule, DepartmentsModule, TypeOrmModule.forFeature([Department, Category])],
  providers: [SeederService],
})
export class SeederModule {}
