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
import { MeetingRecording } from './meeting-recording.entity';

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

    @Column({ name: 'lobby_enabled', default: true })
    lobbyEnabled: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(() => MeetingParticipant, (participant) => participant.meeting)
    participants: MeetingParticipant[];

    @OneToMany(() => MeetingRecording, (recording) => recording.meeting)
    recordings: MeetingRecording[];
}
