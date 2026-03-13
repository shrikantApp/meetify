
import { MeetingParticipant } from 'src/meetings/entities/meeting-participant.entity';
import { Meeting } from 'src/meetings/entities/meeting.entity';
import { User } from 'src/users/entities/user.entity';
import { MeetingRecording } from 'src/meetings/entities/meeting-recording.entity';
const Entities = [User, Meeting, MeetingParticipant, MeetingRecording];
export default Entities;