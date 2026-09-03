import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The shape JwtStrategy.validate() attaches to the request. */
export interface RequestUser {
  sub: string;
  email: string;
  role: string;
}

type RequestWithUser = Request & { user?: RequestUser };

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return data ? request.user?.[data] : request.user;
  },
);
