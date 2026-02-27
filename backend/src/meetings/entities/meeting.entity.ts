import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MeetingParticipant } from './meeting-participant.entity';

@Entity('meetings')
export class Meeting {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'meeting_code', unique: true })
    meetingCode: string;

    @Column()
    title: string;

    @ManyToOne(() => User, (user) => user.hostedMeetings)
    @JoinColumn({ name: 'host_id' })
    host: User;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(() => MeetingParticipant, (participant) => participant.meeting)
    participants: MeetingParticipant[];
}
