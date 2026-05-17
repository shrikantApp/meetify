import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';
import { WorkspaceJoinRequest } from './entities/workspace-join-request.entity';
import { WorkspaceActivityLog } from './entities/workspace-activity-log.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from './workspaces.service';
import { MyWorkspaceInvitationsController, WorkspacesController } from './workspaces.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceMember,
      WorkspaceInvitation,
      WorkspaceJoinRequest,
      WorkspaceActivityLog,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [WorkspacesController, MyWorkspaceInvitationsController],
  providers: [WorkspacesService],
  exports: [WorkspacesService]
})
export class WorkspacesModule { }
