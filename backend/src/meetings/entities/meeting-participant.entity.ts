import {
    Entity,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from '../../users/entities/user.entity';

@Entity('meeting_participants')
export class MeetingParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Meeting, (meeting) => meeting.participants, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'meeting_id' })
    meeting: Meeting;

    @ManyToOne(() => User, (user) => user.meetingParticipations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @CreateDateColumn({ name: 'joined_at' })
    joinedAt: Date;

    @Column({ name: 'left_at', type: 'timestamp', nullable: true })
    leftAt: Date;
}
