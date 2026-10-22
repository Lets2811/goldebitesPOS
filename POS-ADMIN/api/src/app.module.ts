import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminUsersRepository } from './auth/admin-users.repository';
import { AuthController } from './auth/auth.controller';
import { Public } from './auth/auth.decorators';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import adminConfig from './config';
import { DatabaseService } from './database.service';
import { EnvelopeInterceptor, ErrorFilter } from './http';
import { PosController } from './pos/pos.controller';
import { TuraController } from './tura/tura.controller';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [adminConfig] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    // Secrets are given per call (AuthService, AuthGuard), from the config.
    JwtModule.register({}),
  ],
  controllers: [HealthController, AuthController, PosController, TuraController],
  providers: [
    DatabaseService,
    AdminUsersRepository,
    AuthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
