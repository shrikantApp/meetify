/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Workspace } from './entities/workspace.entity';
import {
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';
import {
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
} from './entities/workspace-invitation.entity';
import {
  WorkspaceJoinRequest,
  WorkspaceJoinRequestStatus,
} from './entities/workspace-join-request.entity';
import {
  WorkspaceActivityAction,
  WorkspaceActivityLog,
} from './entities/workspace-activity-log.entity';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

const ADMIN_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMembersRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationsRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(WorkspaceJoinRequest)
    private readonly joinRequestsRepository: Repository<WorkspaceJoinRequest>,
    @InjectRepository(WorkspaceActivityLog)
    private readonly activityRepository: Repository<WorkspaceActivityLog>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private slugify(name: string) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || 'workspace'
    );
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async uniqueSlug(baseName: string) {
    const base = this.slugify(baseName);
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}-${i}`;
      const exists = await this.workspacesRepository.exists({
        where: { slug: candidate },
      });
      if (!exists) return candidate;
    }
    return `${base}-${crypto.randomBytes(4).toString('hex')}`;
  }

  async getMembership(workspaceId: string, userId: string) {
    return this.workspaceMembersRepository.findOne({
      where: { workspaceId, userId },
    });
  }

  async getMembershipsForUser(userId: string) {
    return this.workspaceMembersRepository.find({ where: { userId } });
  }

  async assertMember(workspaceId: string, userId: string) {
    const member = await this.getMembership(workspaceId, userId);
    if (!member)
      throw new ForbiddenException('You are not a member of this workspace');
    return member;
  }

  async assertAdmin(workspaceId: string, userId: string) {
    const member = await this.assertMember(workspaceId, userId);
    if (!ADMIN_ROLES.includes(member.role))
      throw new ForbiddenException('Workspace admin access required');
    return member;
  }

  async assertOwner(workspaceId: string, userId: string) {
    const member = await this.assertMember(workspaceId, userId);
    if (member.role !== WorkspaceRole.OWNER)
      throw new ForbiddenException('Workspace owner access required');
    return member;
  }

  private async logActivity(data: {
    workspaceId: string;
    actorId?: string | null;
    targetUserId?: string | null;
    action: WorkspaceActivityAction;
    metadata?: Record<string, any> | null;
  }) {
    return this.activityRepository.save(this.activityRepository.create(data));
  }

  async createWorkspace(userId: string, name: string): Promise<Workspace> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const slug = await this.uniqueSlug(name);
    return this.dataSource.transaction(async (manager) => {
      const workspace = await manager.save(
        manager.create(Workspace, { name, slug, ownerId: userId }),
      );
      await manager.save(
        manager.create(WorkspaceMember, {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        }),
      );
      await manager.save(
        manager.create(WorkspaceActivityLog, {
          workspaceId: workspace.id,
          actorId: userId,
          action: WorkspaceActivityAction.WORKSPACE_CREATED,
          metadata: { name },
        }),
      );
      return workspace;
    });
  }

  async getUserWorkspaces(userId: string) {
    const members = await this.workspaceMembersRepository.find({
      where: { userId },
      relations: ['workspace'],
      order: { joinedAt: 'ASC' },
    });

    return Promise.all(
      members
        .filter((m) => m.workspace)
        .map(async (m) => ({
          ...m.workspace,
          currentUserRole: m.role,
          memberCount: await this.workspaceMembersRepository.count({
            where: { workspaceId: m.workspaceId },
          }),
        })),
    );
  }

  async getWorkspaceById(id: string, userId: string) {
    await this.assertMember(id, userId);
    const workspace = await this.workspacesRepository.findOne({
      where: { id },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async updateWorkspace(
    id: string,
    userId: string,
    data: { name?: string; slug?: string; avatarUrl?: string },
  ) {
    await this.assertAdmin(id, userId);
    const workspace = await this.workspacesRepository.findOne({
      where: { id },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (data.slug && data.slug !== workspace.slug) {
      const exists = await this.workspacesRepository.exists({
        where: { slug: data.slug },
      });
      if (exists) throw new ConflictException('Workspace slug already exists');
      workspace.slug = data.slug;
    }
    if (data.name) workspace.name = data.name;
    if (data.avatarUrl !== undefined) workspace.avatarUrl = data.avatarUrl || null;
    const saved = await this.workspacesRepository.save(workspace);
    await this.logActivity({
      workspaceId: id,
      actorId: userId,
      action: WorkspaceActivityAction.WORKSPACE_UPDATED,
      metadata: data,
    });
    return saved;
  }

  async deleteWorkspace(id: string, userId: string) {
    await this.assertOwner(id, userId);
    await this.workspacesRepository.softDelete(id);
    return { success: true };
  }

  async getMembers(
    workspaceId: string,
    actorId: string,
    query: {
      search?: string;
      role?: WorkspaceRole;
      page?: number;
      limit?: number;
    },
  ) {
    await this.assertMember(workspaceId, actorId);
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
    const qb = this.workspaceMembersRepository
      .createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .where('member.workspaceId = :workspaceId', { workspaceId });
    if (query.role) qb.andWhere('member.role = :role', { role: query.role });
    if (query.search) {
      qb.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    const [items, total] = await qb
      .orderBy('member.joinedAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit, hasMore: page * limit < total };
  }

  async ensureUsersAreWorkspaceMembers(
    workspaceId: string,
    actorId: string,
    userIds: string[],
    role: WorkspaceRole = WorkspaceRole.MEMBER,
  ) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueUserIds.length) return [];

    await this.assertMember(workspaceId, actorId);
    const existingMembers = await this.workspaceMembersRepository.find({
      where: uniqueUserIds.map((userId) => ({ workspaceId, userId })),
    });
    const existingUserIds = new Set(
      existingMembers.map((member) => member.userId),
    );
    const missingUserIds = uniqueUserIds.filter(
      (userId) => !existingUserIds.has(userId),
    );

    if (!missingUserIds.length) return existingMembers;

    await this.assertAdmin(workspaceId, actorId);

    const users = await this.usersRepository.findByIds(missingUserIds);
    if (users.length !== missingUserIds.length) {
      throw new NotFoundException('One or more selected users were not found');
    }

    const newMembers = this.workspaceMembersRepository.create(
      missingUserIds.map((userId) => ({
        workspaceId,
        userId,
        role,
      })),
    );
    const savedMembers = await this.workspaceMembersRepository.save(newMembers);

    await Promise.all(
      savedMembers.map((member) =>
        this.logActivity({
          workspaceId,
          actorId,
          targetUserId: member.userId,
          action: WorkspaceActivityAction.MEMBER_INVITED,
          metadata: { source: 'channel_create', role },
        }),
      ),
    );

    return [...existingMembers, ...savedMembers];
  }

  async inviteMember(
    workspaceId: string,
    actorId: string,
    dto: InviteWorkspaceMemberDto,
  ) {
    await this.assertAdmin(workspaceId, actorId);
    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    const role = dto.role ?? WorkspaceRole.MEMBER;
    const invitee = dto.userId
      ? await this.usersRepository.findOne({ where: { id: dto.userId } })
      : dto.email
        ? await this.usersRepository.findOne({ where: { email: dto.email } })
        : null;
    const inviteeUserId = invitee?.id ?? dto.userId ?? null;
    const inviteeEmail = dto.email ?? invitee?.email ?? null;
    if (!inviteeUserId && !inviteeEmail)
      throw new BadRequestException('Invite requires a userId or email');
    if (
      inviteeUserId &&
      (await this.getMembership(workspaceId, inviteeUserId))
    ) {
      throw new ConflictException('User is already a workspace member');
    }

    const duplicateWhere: FindOptionsWhere<WorkspaceInvitation>[] = [];
    if (inviteeUserId)
      duplicateWhere.push({
        workspaceId,
        inviteeUserId,
        status: WorkspaceInvitationStatus.PENDING,
      });
    if (inviteeEmail)
      duplicateWhere.push({
        workspaceId,
        inviteeEmail,
        status: WorkspaceInvitationStatus.PENDING,
      });
    const duplicate = duplicateWhere.length
      ? await this.invitationsRepository.findOne({ where: duplicateWhere })
      : null;
    if (duplicate)
      throw new ConflictException('A pending invitation already exists');

    const token = crypto.randomBytes(32).toString('base64url');
    const invitation = await this.invitationsRepository.save(
      this.invitationsRepository.create({
        workspaceId,
        inviterId: actorId,
        inviteeUserId,
        inviteeEmail,
        role,
        message: dto.message ?? null,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    await this.logActivity({
      workspaceId,
      actorId,
      targetUserId: inviteeUserId,
      action: WorkspaceActivityAction.MEMBER_INVITED,
      metadata: { invitationId: invitation.id, inviteeEmail, role },
    });

    if (inviteeUserId) {
      await this.notificationsService.createNotification({
        userId: inviteeUserId,
        type: NotificationType.WORKSPACE_INVITE,
        title: `Workspace invitation: ${workspace.name}`,
        body: dto.message || `You were invited to join ${workspace.name}.`,
        referenceId: invitation.id,
        referenceType: 'workspace_invitation',
        metadata: { workspaceId, workspaceName: workspace.name, role },
      });
    }

    return { ...invitation, inviteToken: token };
  }

  async listInvitations(
    workspaceId: string,
    actorId: string,
    status?: WorkspaceInvitationStatus,
  ) {
    await this.assertAdmin(workspaceId, actorId);
    return this.invitationsRepository.find({
      where: { workspaceId, ...(status ? { status } : {}) },
      relations: ['inviter', 'inviteeUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMyInvitations(
    userId: string,
    email: string,
    status?: WorkspaceInvitationStatus,
  ) {
    return this.invitationsRepository.find({
      where: [
        { inviteeUserId: userId, ...(status ? { status } : {}) },
        { inviteeEmail: email, ...(status ? { status } : {}) },
      ],
      relations: ['workspace', 'inviter'],
      order: { createdAt: 'DESC' },
    });
  }

  async acceptInvitation(invitationId: string, user: User) {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['workspace'],
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== WorkspaceInvitationStatus.PENDING)
      throw new BadRequestException('Invitation is not pending');
    if (invitation.expiresAt.getTime() < Date.now())
      throw new BadRequestException('Invitation has expired');
    if (invitation.inviteeUserId && invitation.inviteeUserId !== user.id)
      throw new ForbiddenException('Invitation belongs to another user');
    if (
      invitation.inviteeEmail &&
      invitation.inviteeEmail !== user.email.toLowerCase()
    )
      throw new ForbiddenException('Invitation belongs to another email');

    await this.dataSource.transaction(async (manager) => {
      invitation.status = WorkspaceInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      invitation.inviteeUserId = user.id;
      await manager.save(invitation);
      const existing = await manager.findOne(WorkspaceMember, {
        where: { workspaceId: invitation.workspaceId, userId: user.id },
      });
      if (!existing) {
        await manager.save(
          manager.create(WorkspaceMember, {
            workspaceId: invitation.workspaceId,
            userId: user.id,
            role: invitation.role,
          }),
        );
      }
      await manager.save(
        manager.create(WorkspaceActivityLog, {
          workspaceId: invitation.workspaceId,
          actorId: user.id,
          targetUserId: user.id,
          action: WorkspaceActivityAction.INVITATION_ACCEPTED,
          metadata: { invitationId },
        }),
      );
    });

    return {
      workspace: invitation.workspace,
      membership: await this.getMembership(invitation.workspaceId, user.id),
    };
  }

  async rejectInvitation(invitationId: string, user: User) {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['workspace'],
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== WorkspaceInvitationStatus.PENDING)
      throw new BadRequestException('Invitation is not pending');
    if (invitation.inviteeUserId && invitation.inviteeUserId !== user.id)
      throw new ForbiddenException('Invitation belongs to another user');
    if (
      invitation.inviteeEmail &&
      invitation.inviteeEmail !== user.email.toLowerCase()
    )
      throw new ForbiddenException('Invitation belongs to another email');
    invitation.status = WorkspaceInvitationStatus.REJECTED;
    invitation.rejectedAt = new Date();
    await this.invitationsRepository.save(invitation);
    await this.logActivity({
      workspaceId: invitation.workspaceId,
      actorId: user.id,
      targetUserId: user.id,
      action: WorkspaceActivityAction.INVITATION_REJECTED,
      metadata: { invitationId },
    });
    return invitation;
  }

  async joinByToken(token: string, user: User) {
    const invitation = await this.invitationsRepository.findOne({
      where: {
        tokenHash: this.hashToken(token),
        status: WorkspaceInvitationStatus.PENDING,
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    return this.acceptInvitation(invitation.id, user);
  }

  async createJoinRequest(workspaceId: string, user: User, message?: string) {
    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (await this.getMembership(workspaceId, user.id))
      throw new ConflictException('Already a workspace member');
    const existing = await this.joinRequestsRepository.findOne({
      where: {
        workspaceId,
        requesterId: user.id,
        status: WorkspaceJoinRequestStatus.PENDING,
      },
    });
    if (existing) return existing;
    const request = await this.joinRequestsRepository.save(
      this.joinRequestsRepository.create({
        workspaceId,
        requesterId: user.id,
        message: message ?? null,
      }),
    );
    await this.logActivity({
      workspaceId,
      actorId: user.id,
      action: WorkspaceActivityAction.JOIN_REQUEST_CREATED,
      metadata: { requestId: request.id },
    });
    const admins = await this.workspaceMembersRepository.find({
      where: [
        { workspaceId, role: WorkspaceRole.OWNER },
        { workspaceId, role: WorkspaceRole.ADMIN },
      ],
    });
    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.createNotification({
          userId: admin.userId,
          type: NotificationType.WORKSPACE_JOIN_REQUEST,
          title: `Join request: ${workspace.name}`,
          body: `${user.name} requested to join ${workspace.name}.`,
          referenceId: request.id,
          referenceType: 'workspace_join_request',
          metadata: {
            workspaceId,
            workspaceName: workspace.name,
            requesterId: user.id,
          },
        }),
      ),
    );
    return request;
  }

  async approveJoinRequest(
    workspaceId: string,
    requestId: string,
    actorId: string,
    role: WorkspaceRole = WorkspaceRole.MEMBER,
  ) {
    await this.assertAdmin(workspaceId, actorId);
    const request = await this.joinRequestsRepository.findOne({
      where: { id: requestId, workspaceId },
    });
    if (!request) throw new NotFoundException('Join request not found');
    if (request.status !== WorkspaceJoinRequestStatus.PENDING)
      throw new BadRequestException('Join request is not pending');
    const safeRole =
      role === WorkspaceRole.ADMIN || role === WorkspaceRole.GUEST
        ? role
        : WorkspaceRole.MEMBER;
    request.status = WorkspaceJoinRequestStatus.APPROVED;
    request.reviewedBy = actorId;
    request.reviewedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.save(request);
      const existing = await manager.findOne(WorkspaceMember, {
        where: { workspaceId, userId: request.requesterId },
      });
      if (!existing)
        await manager.save(
          manager.create(WorkspaceMember, {
            workspaceId,
            userId: request.requesterId,
            role: safeRole,
          }),
        );
      await manager.save(
        manager.create(WorkspaceActivityLog, {
          workspaceId,
          actorId,
          targetUserId: request.requesterId,
          action: WorkspaceActivityAction.JOIN_REQUEST_APPROVED,
          metadata: { requestId, role: safeRole },
        }),
      );
    });
    return this.getMembership(workspaceId, request.requesterId);
  }

  async rejectJoinRequest(
    workspaceId: string,
    requestId: string,
    actorId: string,
  ) {
    await this.assertAdmin(workspaceId, actorId);
    const request = await this.joinRequestsRepository.findOne({
      where: { id: requestId, workspaceId },
    });
    if (!request) throw new NotFoundException('Join request not found');
    request.status = WorkspaceJoinRequestStatus.REJECTED;
    request.reviewedBy = actorId;
    request.reviewedAt = new Date();
    await this.joinRequestsRepository.save(request);
    await this.logActivity({
      workspaceId,
      actorId,
      targetUserId: request.requesterId,
      action: WorkspaceActivityAction.JOIN_REQUEST_REJECTED,
      metadata: { requestId },
    });
    return request;
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    actorId: string,
    role: WorkspaceRole,
  ) {
    await this.assertAdmin(workspaceId, actorId);
    if (role === WorkspaceRole.OWNER)
      throw new BadRequestException(
        'Ownership transfer is not supported by this endpoint',
      );
    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === WorkspaceRole.OWNER)
      throw new BadRequestException('Cannot change owner role');
    target.role = role;
    const saved = await this.workspaceMembersRepository.save(target);
    await this.logActivity({
      workspaceId,
      actorId,
      targetUserId,
      action: WorkspaceActivityAction.MEMBER_ROLE_UPDATED,
      metadata: { role },
    });
    return saved;
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actorId: string,
  ) {
    await this.assertAdmin(workspaceId, actorId);
    const target = await this.getMembership(workspaceId, targetUserId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === WorkspaceRole.OWNER)
      throw new BadRequestException('Cannot remove workspace owner');
    await this.workspaceMembersRepository.delete({
      workspaceId,
      userId: targetUserId,
    });
    await this.logActivity({
      workspaceId,
      actorId,
      targetUserId,
      action: WorkspaceActivityAction.MEMBER_REMOVED,
    });
    return { success: true };
  }

  async leaveWorkspace(workspaceId: string, userId: string) {
    const member = await this.assertMember(workspaceId, userId);
    if (member.role === WorkspaceRole.OWNER) {
      const ownerCount = await this.workspaceMembersRepository.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });
      if (ownerCount <= 1)
        throw new BadRequestException(
          'Transfer ownership before leaving this workspace',
        );
    }
    await this.workspaceMembersRepository.delete({ workspaceId, userId });
    await this.logActivity({
      workspaceId,
      actorId: userId,
      targetUserId: userId,
      action: WorkspaceActivityAction.MEMBER_LEFT,
    });
    return { success: true };
  }

  async getActivity(workspaceId: string, userId: string, page = 1, limit = 30) {
    await this.assertMember(workspaceId, userId);
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const [items, total] = await this.activityRepository.findAndCount({
      where: { workspaceId },
      relations: ['actor', 'targetUser'],
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      hasMore: safePage * safeLimit < total,
    };
  }
}
