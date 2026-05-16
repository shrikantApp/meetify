import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CommunityMember } from './community-member.entity';
import { CommunityGroup } from './community-group.entity';

export enum CommunityVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

@Entity('communities')
export class Community {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'cover_url', nullable: true })
  coverUrl: string;

  @Column({
    type: 'enum',
    enum: CommunityVisibility,
    default: CommunityVisibility.PUBLIC,
  })
  visibility: CommunityVisibility;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'invite_link', nullable: true, unique: true })
  inviteLink: string;

  @Column({ name: 'require_approval', default: false })
  requireApproval: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CommunityMember, (m) => m.community, { cascade: true })
  members: CommunityMember[];

  @OneToMany(() => CommunityGroup, (g) => g.community, { cascade: true })
  groups: CommunityGroup[];
}
