import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { GoogleToken } from '../calendar/entities/google-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Department, GoogleToken])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
