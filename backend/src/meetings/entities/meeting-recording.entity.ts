import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('meeting_recordings')
export class MeetingRecording {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'meeting_id' })
    meetingId: string;

    @Column({ name: 'host_id' })
    hostId: string;

    @Column({ name: 'file_path' })
    filePath: string;

    @Column({ name: 'file_size', type: 'bigint' })
    fileSize: number;

    @Column({ name: 'duration', type: 'int' })
    duration: number; // in seconds

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => Meeting)
    @JoinColumn({ name: 'meeting_id' })
    meeting: Meeting;
}
