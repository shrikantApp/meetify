import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Meeting } from '../../meetings/entities/meeting.entity';
import { MeetingParticipant } from '../../meetings/entities/meeting-participant.entity';
import { MeetingRecording } from '../../meetings/entities/meeting-recording.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'full_name', nullable: true, type: 'varchar' })
  fullName!: string | null;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash', select: false }) // select: false ensures we don't accidentally leak it
  password!: string;

  @Column({ name: 'title', nullable: true, type: 'varchar' })
  title!: string | null;

  @Column({ name: 'designation', nullable: true, type: 'varchar' })
  designation!: string | null;

  @Column({ name: 'phone_number', nullable: true, type: 'varchar' })
  phoneNumber!: string | null;

  @Column({ name: 'date_of_birth', nullable: true, type: 'date' })
  dateOfBirth!: string | null;

  @Column({ nullable: true, type: 'varchar' })
  avatarUrl!: string | null;

  @Column({ name: 'is_online', default: false })
  isOnline!: boolean;

  @Column({ name: 'last_seen', nullable: true, type: 'timestamp' })
  lastSeen!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Meeting, (meeting) => meeting.host)
  hostedMeetings!: Meeting[];

  @OneToMany(() => MeetingParticipant, (participant) => participant.user)
  meetingParticipations!: MeetingParticipant[];

  @OneToMany(() => MeetingRecording, (recording) => recording.host)
  recordings!: MeetingRecording[];
}
