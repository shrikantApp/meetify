import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Use this guard on any route that requires authentication.
// It will execute JwtStrategy.validate() and attach user to request.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
