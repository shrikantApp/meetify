import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

export type AuthenticatedSocket = Socket & { userId: string; userEmail: string };

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

    if (!token) {
      client.disconnect();
      return false;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      (client as AuthenticatedSocket).userId = payload.sub;
      (client as AuthenticatedSocket).userEmail = payload.email;
      return true;
    } catch {
      client.disconnect();
      return false;
    }
  }
}
