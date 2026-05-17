import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '../entities/workspace-member.entity';

export class InviteWorkspaceMemberDto {
  @ValidateIf((dto) => !dto.email)
  @IsUUID()
  userId?: string;

  @ValidateIf((dto) => !dto.userId)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole.ADMIN | WorkspaceRole.MEMBER | WorkspaceRole.GUEST;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  message?: string;
}
