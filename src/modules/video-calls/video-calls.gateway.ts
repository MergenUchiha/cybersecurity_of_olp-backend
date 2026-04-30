import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface RoomParticipant {
  socketId: string;
  userId: string;
  userName: string;
  userRole: string;
  isMuted: boolean;
  isCameraOff: boolean;
}

interface Room {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  /** Set of user IDs that are allowed to join. Empty = creator only. */
  allowedUserIds: Set<string>;
  participants: Map<string, RoomParticipant>;
  isGroupCall: boolean;
  createdAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'https://localhost:5173',
      'http://localhost:5002',
      'http://172.20.10.3:5173',
      'https://172.20.10.3:5173',
      'http://TURN_SERVER_HOST:5002',
      'http://TURN_SERVER_HOST:5173',
    ],
    credentials: true,
  },
  path: '/video-socket',
})
export class VideoCallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VideoCallsGateway.name);
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();
  private socketToUser = new Map<string, AuthenticatedUser>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Connection rejected (no token): ${client.id}`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ sub: string; email: string; role: string }>(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, isBlocked: true },
      });

      if (!user || !user.isActive || user.isBlocked) {
        this.logger.warn(`Connection rejected (user inactive/blocked): ${client.id}, userId=${payload.sub}`);
        client.emit('error', { message: 'Account is not active or has been blocked' });
        client.disconnect(true);
        return;
      }

      this.socketToUser.set(client.id, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });

      this.logger.log(`Authenticated connection: ${client.id} (${user.email})`);

      // Notify client that auth is complete — client must wait for this before emitting events
      client.emit('authenticated', {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
      });
    } catch (err) {
      this.logger.warn(`Connection rejected (invalid token): ${client.id} — ${err.message}`);
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.socketToUser.get(client.id);
    this.logger.log(`Client disconnected: ${client.id} (${user?.email || 'unknown'})`);

    const roomId = this.socketToRoom.get(client.id);
    if (roomId) {
      this.leaveRoom(client, roomId);
    }
    this.socketToUser.delete(client.id);
  }

  private getUser(client: Socket): AuthenticatedUser | null {
    const user = this.socketToUser.get(client.id);
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      return null;
    }
    return user;
  }

  /** Check whether a user is allowed to enter a room */
  private isUserAllowed(room: Room, userId: string): boolean {
    // Creator always allowed
    if (room.createdBy === userId) return true;
    // Must be in the allowed list
    return room.allowedUserIds.has(userId);
  }

  // ─── Search users (for invite picker) ────────────────────
  @SubscribeMessage('search-users')
  async handleSearchUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { query: string },
  ) {
    const user = this.getUser(client);
    if (!user) return;

    const query = (data.query || '').trim();
    if (query.length < 2) {
      client.emit('users-search-result', []);
      return;
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        isBlocked: false,
        id: { not: user.id },
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      take: 20,
    });

    client.emit('users-search-result', users);
  }

  // ─── Create room ─────────────────────────────────────────
  @SubscribeMessage('create-room')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomName: string; isGroupCall: boolean; allowedUserIds?: string[] },
  ) {
    const user = this.getUser(client);
    if (!user) return;

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const allowedSet = new Set<string>(data.allowedUserIds || []);

    const room: Room = {
      id: roomId,
      name: data.roomName,
      createdBy: user.id,
      createdByName: `${user.firstName} ${user.lastName}`,
      allowedUserIds: allowedSet,
      participants: new Map(),
      isGroupCall: data.isGroupCall,
      createdAt: new Date(),
    };
    this.rooms.set(roomId, room);

    this.logger.log(`Room created: ${roomId} by ${user.email}, allowed: [${[...allowedSet].join(',')}]`);
    client.emit('room-created', { roomId, roomName: data.roomName });
  }

  // ─── Join room (access check) ────────────────────────────
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = this.getUser(client);
    if (!user) return;

    const room = this.rooms.get(data.roomId);
    if (!room) {
      client.emit('error', { message: 'Room not found' });
      return;
    }

    // *** ACCESS CONTROL — reject and disconnect unauthorized users ***
    if (!this.isUserAllowed(room, user.id)) {
      this.logger.warn(`Access denied: ${user.email} tried to join room ${data.roomId}`);
      client.emit('error', { message: 'Access denied — you are not invited to this room' });
      client.disconnect(true);
      return;
    }

    // Prevent the same user from joining twice
    for (const p of room.participants.values()) {
      if (p.userId === user.id) {
        client.emit('error', { message: 'You are already in this room' });
        return;
      }
    }

    if (!room.isGroupCall && room.participants.size >= 2) {
      client.emit('error', { message: 'Room is full (1-on-1 call)' });
      return;
    }

    if (room.isGroupCall && room.participants.size >= 10) {
      client.emit('error', { message: 'Room is full (max 10 participants)' });
      return;
    }

    const participant: RoomParticipant = {
      socketId: client.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      isMuted: false,
      isCameraOff: false,
    };

    const existingParticipants = Array.from(room.participants.values());

    room.participants.set(client.id, participant);
    this.socketToRoom.set(client.id, data.roomId);
    client.join(data.roomId);

    this.logger.log(`${user.email} joined room ${data.roomId}`);

    client.emit('existing-participants', existingParticipants);
    client.to(data.roomId).emit('user-joined', participant);
  }

  /** Verify that both sender and target are in the same room */
  private areInSameRoom(senderSocketId: string, targetSocketId: string): boolean {
    const senderRoom = this.socketToRoom.get(senderSocketId);
    const targetRoom = this.socketToRoom.get(targetSocketId);
    return !!senderRoom && senderRoom === targetRoom;
  }

  // ─── Signaling (only between peers in the same room) ────
  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; sdp: RTCSessionDescriptionInit },
  ) {
    if (!this.getUser(client)) return;
    if (!this.areInSameRoom(client.id, data.targetSocketId)) return;
    this.server.to(data.targetSocketId).emit('offer', { sdp: data.sdp, fromSocketId: client.id });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; sdp: RTCSessionDescriptionInit },
  ) {
    if (!this.getUser(client)) return;
    if (!this.areInSameRoom(client.id, data.targetSocketId)) return;
    this.server.to(data.targetSocketId).emit('answer', { sdp: data.sdp, fromSocketId: client.id });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; candidate: RTCIceCandidateInit },
  ) {
    if (!this.getUser(client)) return;
    if (!this.areInSameRoom(client.id, data.targetSocketId)) return;
    this.server.to(data.targetSocketId).emit('ice-candidate', { candidate: data.candidate, fromSocketId: client.id });
  }

  // ─── Media toggles ──────────────────────────────────────
  @SubscribeMessage('toggle-mute')
  handleToggleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isMuted: boolean },
  ) {
    if (!this.getUser(client)) return;
    const room = this.rooms.get(data.roomId);
    if (room) {
      const participant = room.participants.get(client.id);
      if (participant) {
        participant.isMuted = data.isMuted;
        client.to(data.roomId).emit('user-toggle-mute', { socketId: client.id, isMuted: data.isMuted });
      }
    }
  }

  @SubscribeMessage('toggle-camera')
  handleToggleCamera(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isCameraOff: boolean },
  ) {
    if (!this.getUser(client)) return;
    const room = this.rooms.get(data.roomId);
    if (room) {
      const participant = room.participants.get(client.id);
      if (participant) {
        participant.isCameraOff = data.isCameraOff;
        client.to(data.roomId).emit('user-toggle-camera', { socketId: client.id, isCameraOff: data.isCameraOff });
      }
    }
  }

  // ─── Leave ───────────────────────────────────────────────
  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!this.getUser(client)) return;
    this.leaveRoom(client, data.roomId);
  }

  // ─── Room list (only rooms user has access to) ──────────
  @SubscribeMessage('get-rooms')
  handleGetRooms(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user) return;

    const roomList: any[] = [];
    for (const room of this.rooms.values()) {
      if (this.isUserAllowed(room, user.id)) {
        roomList.push({
          id: room.id,
          name: room.name,
          participantCount: room.participants.size,
          isGroupCall: room.isGroupCall,
          createdBy: room.createdBy,
          createdByName: room.createdByName,
          allowedCount: room.allowedUserIds.size,
          createdAt: room.createdAt,
        });
      }
    }
    client.emit('rooms-list', roomList);
  }

  private leaveRoom(client: Socket, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(client.id);
    room.participants.delete(client.id);
    this.socketToRoom.delete(client.id);
    client.leave(roomId);

    if (participant) {
      client.to(roomId).emit('user-left', {
        socketId: client.id,
        userId: participant.userId,
        userName: participant.userName,
      });
    }

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      this.logger.log(`Room ${roomId} deleted (empty)`);
    }
  }
}
