
import { MeetingParticipant } from 'src/meetings/entities/meeting-participant.entity';
import { Meeting } from 'src/meetings/entities/meeting.entity';
import { User } from 'src/users/entities/user.entity';
import { MeetingRecording } from 'src/meetings/entities/meeting-recording.entity';
// Chat entities
import { Conversation } from 'src/chat/entities/conversation.entity';
import { ConversationMember } from 'src/chat/entities/conversation-member.entity';
import { Message } from 'src/chat/entities/message.entity';
import { MessageStatus } from 'src/chat/entities/message-status.entity';
import { MessageReaction } from 'src/chat/entities/message-reaction.entity';
import { MessageAttachment } from 'src/chat/entities/message-attachment.entity';
// Community entities
import { Community } from 'src/community/entities/community.entity';
import { CommunityMember } from 'src/community/entities/community-member.entity';
import { CommunityGroup } from 'src/community/entities/community-group.entity';
// Notification entities
import { Notification } from 'src/notifications/entities/notification.entity';

const Entities = [
  User, Meeting, MeetingParticipant, MeetingRecording,
  Conversation, ConversationMember, Message, MessageStatus, MessageReaction, MessageAttachment,
  Community, CommunityMember, CommunityGroup,
  Notification,
];
export default Entities;