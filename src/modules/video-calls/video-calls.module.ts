import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VideoCallsGateway } from './video-calls.gateway';
import { loadEnv } from '../../config/env.validation';

@Module({
  imports: [
    JwtModule.register({
      // Third copy of the same fallback secret before this change. There is
      // no default now: the value is required and validated at startup.
      secret: loadEnv().JWT_SECRET,
      signOptions: { expiresIn: loadEnv().JWT_ACCESS_EXPIRATION },
    }),
  ],
  providers: [VideoCallsGateway],
})
export class VideoCallsModule {}
