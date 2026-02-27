import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

// This strategy validates the JWT on every protected request.
// It reads the token from the Authorization: Bearer header,
// verifies it using the JWT_SECRET, and loads the user from DB.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private usersService: UsersService,
        private configService: ConfigService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET')!,
        });
    }

    async validate(payload: { sub: string; email: string }) {
        // payload.sub is the user id stored when the token was signed
        const user = await this.usersService.findOne(payload.sub);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user; // Attached to request.user
    }
}
