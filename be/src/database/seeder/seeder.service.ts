import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../modules/users/users.service';
import { UserRole } from '../../modules/users/entities/user.entity';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedAdmin();
  }

  private async seedAdmin(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL', 'admin@ictu.edu.vn');
    const password = this.configService.get<string>('ADMIN_PASSWORD', 'Admin@123');
    const fullName = this.configService.get<string>('ADMIN_FULLNAME', 'Administrator');

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      this.logger.log(`Admin already exists: ${email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.usersService.create({
      email,
      password: hashedPassword,
      fullName,
      role: UserRole.ADMIN,
    });

    this.logger.log(`✅ Admin seeded — email: ${email} | password: ${password}`);
  }
}
