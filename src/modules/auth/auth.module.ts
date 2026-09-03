import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { loadEnv } from '../../config/env.validation';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      // No fallback on purpose: a default secret in a public repository lets
      // anyone sign their own admin token. Validated at startup.
      secret: loadEnv().JWT_SECRET,
      signOptions: { expiresIn: loadEnv().JWT_ACCESS_EXPIRATION },
    }),
    SecurityEventsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
