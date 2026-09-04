import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated user's ID from the request.
 * The gateway/auth-middleware injects X-User-ID header.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Gateway injects X-User-ID after token verification
    return request.headers['x-user-id'] ?? '';
  },
);
