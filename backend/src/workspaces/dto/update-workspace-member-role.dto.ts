import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '../entities/workspace-member.entity';

export class UpdateWorkspaceMemberRoleDto {
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole.ADMIN | WorkspaceRole.MEMBER | WorkspaceRole.GUEST;
}
