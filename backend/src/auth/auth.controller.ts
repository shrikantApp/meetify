import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    // Protected route – returns the currently logged-in user's profile
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req: ExpressRequest & { user: any }) {
        const { password, ...safeUser } = req.user;
        return safeUser;
    }
}
