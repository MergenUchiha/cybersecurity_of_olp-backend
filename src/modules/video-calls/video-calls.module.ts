import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VideoCallsGateway } from './video-calls.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
      signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '15m') as any },
    }),
  ],
  providers: [VideoCallsGateway],
})
export class VideoCallsModule {}
