import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@Req() req: any, @Body('name') name: string) {
    return this.workspacesService.createWorkspace(req.user.id, name);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.workspacesService.getUserWorkspaces(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.workspacesService.getWorkspaceById(id, req.user.id);
  }
}
