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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false }) // select: false ensures we don't accidentally leak it
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Meeting, (meeting) => meeting.host)
  hostedMeetings: Meeting[];

  @OneToMany(() => MeetingParticipant, (participant) => participant.user)
  meetingParticipations: MeetingParticipant[];
}
