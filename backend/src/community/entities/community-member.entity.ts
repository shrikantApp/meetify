import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Community } from './community.entity';
import { User } from '../../users/entities/user.entity';

export enum CommunityRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
}

export enum JoinStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('community_members')
@Index(['communityId', 'userId'], { unique: true })
export class CommunityMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: CommunityRole, default: CommunityRole.MEMBER })
  role: CommunityRole;

  @Column({
    name: 'join_status',
    type: 'enum',
    enum: JoinStatus,
    default: JoinStatus.APPROVED,
  })
  joinStatus: JoinStatus;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => Community, (c) => c.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
