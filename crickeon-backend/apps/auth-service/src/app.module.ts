import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { PrismaService } from './infra/prisma/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService]
})
export class AppModule {}
