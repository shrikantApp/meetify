import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { Meeting } from './meeting.entity';
import { User } from '../../users/entities/user.entity';

export enum RecordingStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

@Entity('meeting_recordings')
export class MeetingRecording {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Meeting, (meeting) => meeting.recordings, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'meeting_id' })
    meeting: Meeting;

    @ManyToOne(() => User, (user) => user.recordings, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'host_id' })
    host: User;

    @Column({ name: 'file_path', nullable: true })
    filePath: string;

    @Column({ name: 'file_size', type: 'bigint', nullable: true })
    fileSize: number;

    @Column({ nullable: true })
    duration: number; // in seconds

    @Column({
        type: 'enum',
        enum: RecordingStatus,
        default: RecordingStatus.IN_PROGRESS
    })
    status: RecordingStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
