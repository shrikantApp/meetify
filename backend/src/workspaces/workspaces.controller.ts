/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto';
import { JoinWorkspaceDto } from './dto/join-workspace.dto';
import { CreateJoinRequestDto } from './dto/create-join-request.dto';
import { WorkspaceRole } from './entities/workspace-member.entity';
import { WorkspaceInvitationStatus } from './entities/workspace-invitation.entity';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(req.user.id, dto.name);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.workspacesService.getUserWorkspaces(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.workspacesService.getWorkspaceById(id, req.user.id);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(id, req.user.id, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.workspacesService.deleteWorkspace(id, req.user.id);
  }

  @Get(':id/members')
  members(
    @Req() req: any,
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('role') role?: WorkspaceRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workspacesService.getMembers(id, req.user.id, {
      search,
      role,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(
      id,
      userId,
      req.user.id,
      dto.role,
    );
  }

  @Delete(':id/members/me')
  leave(@Req() req: any, @Param('id') id: string) {
    return this.workspacesService.leaveWorkspace(id, req.user.id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.workspacesService.removeMember(id, userId, req.user.id);
  }

  @Post(':id/invitations')
  invite(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: InviteWorkspaceMemberDto,
  ) {
    return this.workspacesService.inviteMember(id, req.user.id, dto);
  }

  @Get(':id/invitations')
  invitations(
    @Req() req: any,
    @Param('id') id: string,
    @Query('status') status?: WorkspaceInvitationStatus,
  ) {
    return this.workspacesService.listInvitations(id, req.user.id, status);
  }

  @Post('join')
  joinByToken(@Req() req: any, @Body() dto: JoinWorkspaceDto) {
    return this.workspacesService.joinByToken(dto.inviteToken, req.user);
  }

  @Post(':id/join-requests')
  createJoinRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateJoinRequestDto,
  ) {
    return this.workspacesService.createJoinRequest(id, req.user, dto.message);
  }

  @Post(':id/join-requests/:requestId/approve')
  approveJoinRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body('role') role?: WorkspaceRole,
  ) {
    return this.workspacesService.approveJoinRequest(
      id,
      requestId,
      req.user.id,
      role,
    );
  }

  @Post(':id/join-requests/:requestId/reject')
  rejectJoinRequest(
    @Req() req: any,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
  ) {
    return this.workspacesService.rejectJoinRequest(id, requestId, req.user.id);
  }

  @Get(':id/activity')
  activity(
    @Req() req: any,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workspacesService.getActivity(
      id,
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 30,
    );
  }
}

@Controller('me/workspace-invitations')
@UseGuards(JwtAuthGuard)
export class MyWorkspaceInvitationsController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: WorkspaceInvitationStatus) {
    return this.workspacesService.getMyInvitations(
      req.user.id,
      req.user.email,
      status,
    );
  }

  @Post(':invitationId/accept')
  accept(@Req() req: any, @Param('invitationId') invitationId: string) {
    return this.workspacesService.acceptInvitation(invitationId, req.user);
  }

  @Post(':invitationId/reject')
  reject(@Req() req: any, @Param('invitationId') invitationId: string) {
    return this.workspacesService.rejectInvitation(invitationId, req.user);
  }
}
