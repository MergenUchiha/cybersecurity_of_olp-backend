import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { TurnService } from './turn.service';

@ApiTags('video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('turn-credentials')
export class TurnController {
  constructor(private readonly turn: TurnService) {}

  @ApiOperation({
    summary: 'Short-lived ICE configuration for a call',
    description:
      'The TURN credentials expire after TURN_TTL_SECONDS. Ask for them when ' +
      'a call starts rather than caching them.',
  })
  @Get()
  getCredentials(@CurrentUser() user: RequestUser) {
    return this.turn.getIceConfig(user.sub);
  }
}
