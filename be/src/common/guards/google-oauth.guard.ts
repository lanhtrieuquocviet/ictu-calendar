import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    if (request.query.error === 'access_denied') {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:4200';
      response.redirect(`${frontendUrl}/auth/login`);
      return false;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
