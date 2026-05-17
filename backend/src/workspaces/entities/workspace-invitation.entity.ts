import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceRole } from './workspace-member.entity';

export enum WorkspaceInvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('workspace_invitations')
@Index(['workspaceId', 'status'])
@Index(['inviteeUserId', 'status'])
@Index(['inviteeEmail', 'status'])
@Index(['tokenHash'], { unique: true })
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @Column({ name: 'inviter_id', type: 'uuid' })
  inviterId!: string;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'inviter_id' })
  inviter!: User;

  @Column({ name: 'invitee_user_id', type: 'uuid', nullable: true })
  inviteeUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'invitee_user_id' })
  inviteeUser!: User | null;

  @Column({ name: 'invitee_email', type: 'varchar', nullable: true })
  inviteeEmail!: string | null;

  @Column({ type: 'enum', enum: WorkspaceRole, default: WorkspaceRole.MEMBER })
  role!: WorkspaceRole;

  @Column({ type: 'enum', enum: WorkspaceInvitationStatus, default: WorkspaceInvitationStatus.PENDING })
  status!: WorkspaceInvitationStatus;

  @Column({ name: 'token_hash', type: 'varchar', nullable: true })
  tokenHash!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ nullable: true, type: 'text' })
  message!: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
