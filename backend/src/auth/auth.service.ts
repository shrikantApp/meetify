import {
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * JWT Flow:
 * 1. User registers -> password hashed with bcrypt, stored in DB
 * 2. User logs in -> password verified -> JWT signed with user id+email
 * 3. Subsequent requests include JWT in Authorization: Bearer header
 * 4. JwtStrategy validates token and attaches user to request
 */
@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const existing = await this.usersService.findByEmail(dto.email);
        if (existing) {
            throw new ConflictException('Email already in use');
        }

        // Hash password with bcrypt (saltRounds = 10)
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.usersService.create({
            name: dto.name,
            email: dto.email,
            password: passwordHash,
        });

        return this.signToken(user.id, user.email);
    }

    async login(dto: LoginDto) {
        // Load user with password field (it has select:false by default)
        const user = await this.usersService.findByEmailWithPassword(dto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordMatches = await bcrypt.compare(dto.password, user.password);
        if (!passwordMatches) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.signToken(user.id, user.email);
    }

    private signToken(userId: string, email: string) {
        const payload = { sub: userId, email };
        return {
            access_token: this.jwtService.sign(payload),
            token_type: 'Bearer',
        };
    }
}
