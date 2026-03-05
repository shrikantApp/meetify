import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { EventsGateway } from './events.gateway';

type MockSocket = Socket & {
  toEmit: jest.Mock;
};

type GatewayInternals = EventsGateway & {
  participants: Map<
    string,
    {
      mediaState: {
        camera: boolean;
      };
    }
  >;
};

function createMockSocket(id: string, userId: string): MockSocket {
  const toEmit = jest.fn();
  const socket = {
    id,
    handshake: { auth: {} },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: toEmit }),
    user: { sub: userId },
    toEmit,
  };

  return socket as unknown as MockSocket;
}

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;
  let participants: () => GatewayInternals['participants'];

  beforeEach(() => {
    const jwtService = {
      verify: jest.fn().mockReturnValue({ sub: 'auth-user' }),
    } as unknown as JwtService;
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'test-secret';
        return 'false';
      }),
    } as unknown as ConfigService;

    gateway = new EventsGateway(jwtService, configService);
    serverEmit = jest.fn();
    serverTo = jest.fn().mockReturnValue({ emit: serverEmit });
    Reflect.set(gateway, 'server', { to: serverTo });
    participants = () => (gateway as unknown as GatewayInternals).participants;
  });

  it('joins and leaves room while notifying peers', () => {
    const client = createMockSocket('socket-a', 'user-a');

    gateway.handleJoinRoom(client, { roomId: 'room-1', userName: 'Alice' });
    expect(client.join as jest.Mock).toHaveBeenCalledWith('room-1');
    expect(client.emit as jest.Mock).toHaveBeenCalledWith('room-participants', []);

    gateway.handleLeaveRoom(client);
    expect(client.leave as jest.Mock).toHaveBeenCalledWith('room-1');
    expect(client.toEmit).toHaveBeenCalledWith('user-left', {
      socketId: 'socket-a',
      userId: 'user-a',
      userName: 'Alice',
    });
    expect(participants().has('socket-a')).toBe(false);
  });

  it('does not broadcast media state for mismatched room payload', () => {
    const client = createMockSocket('socket-a', 'user-a');
    gateway.handleJoinRoom(client, { roomId: 'room-1', userName: 'Alice' });
    client.toEmit.mockClear();

    gateway.handleMediaStateChange(client, {
      roomId: 'other-room',
      type: 'camera',
      enabled: true,
    });

    expect(client.toEmit).not.toHaveBeenCalled();
    expect(participants().get('socket-a')?.mediaState.camera).toBe(false);
  });

  it('broadcasts camera toggle updates after join', () => {
    const sender = createMockSocket('socket-a', 'user-a');
    const receiver = createMockSocket('socket-b', 'user-b');
    gateway.handleJoinRoom(sender, { roomId: 'room-1', userName: 'Alice' });
    gateway.handleJoinRoom(receiver, { roomId: 'room-1', userName: 'Bob' });
    sender.toEmit.mockClear();

    gateway.handleMediaStateChange(sender, {
      roomId: 'room-1',
      type: 'camera',
      enabled: false,
    });
    gateway.handleMediaStateChange(sender, {
      roomId: 'room-1',
      type: 'camera',
      enabled: true,
    });

    expect(sender.toEmit).toHaveBeenCalledWith('participant-media-state', {
      socketId: 'socket-a',
      type: 'camera',
      enabled: false,
    });
    expect(sender.toEmit).toHaveBeenCalledWith('participant-media-state', {
      socketId: 'socket-a',
      type: 'camera',
      enabled: true,
    });
    expect(participants().get('socket-a')?.mediaState.camera).toBe(true);
  });

  it('blocks cross-room signaling and forwards in-room renegotiation requests', () => {
    const sender = createMockSocket('socket-a', 'user-a');
    const targetSameRoom = createMockSocket('socket-b', 'user-b');
    const targetOtherRoom = createMockSocket('socket-c', 'user-c');

    gateway.handleJoinRoom(sender, { roomId: 'room-1', userName: 'Alice' });
    gateway.handleJoinRoom(targetSameRoom, {
      roomId: 'room-1',
      userName: 'Bob',
    });
    gateway.handleJoinRoom(targetOtherRoom, {
      roomId: 'room-2',
      userName: 'Charlie',
    });

    gateway.handleOffer(sender, {
      targetSocketId: 'socket-c',
      sdp: { type: 'offer', sdp: 'fake-sdp' },
    });
    expect(serverTo).not.toHaveBeenCalledWith('socket-c');

    gateway.handleRenegotiateRequest(sender, { targetSocketId: 'socket-b' });
    expect(serverTo).toHaveBeenCalledWith('socket-b');
    expect(serverEmit).toHaveBeenCalledWith('renegotiate-request', {
      fromSocketId: 'socket-a',
    });
  });
});
