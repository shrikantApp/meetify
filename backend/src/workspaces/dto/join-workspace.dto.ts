import { IsString, Length } from 'class-validator';

export class JoinWorkspaceDto {
  @IsString()
  @Length(16, 200)
  inviteToken: string;
}
