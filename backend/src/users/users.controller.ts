import { Body, Controller, Get, Patch, Query, Request, UseGuards } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  async updateProfile(
    @Request() req: ExpressRequest & { user: { id: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(req.user.id, dto);
    const { password, ...safeUser } = user as any;
    return safeUser;
  }

  @Get('search')
  async searchUsers(@Query('q') q: string) {
    if (!q || q.length < 2) return [];
    
    const users = await this.usersService.searchUsers(q);
    
    return users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl
    }));
  }
}
