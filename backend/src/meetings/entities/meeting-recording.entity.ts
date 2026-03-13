import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Meeting } from './meeting.entity';

@Entity('meeting_recordings')
export class MeetingRecording {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    meetingId: string;

    @Column()
    hostId: string;

    @Column()
    filePath: string;

    @Column({ type: 'bigint' })
    fileSize: number;

    @Column({ type: 'int' })
    duration: number; // in seconds

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Meeting)
    @JoinColumn({ name: 'meetingId' })
    meeting: Meeting;
}
