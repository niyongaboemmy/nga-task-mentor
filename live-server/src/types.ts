// Socket.IO event types for WebRTC signaling

export interface Room {
  id: string;
  name: string;
  clients: Map<string, Client>;
  createdAt: Date;
}

export interface Client {
  id: string;
  socketId: string;
  userId?: string;
  username?: string;
  role: "host" | "participant";
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  joinedAt: Date;
}

// WebRTC Signaling Events
export interface JoinRoomPayload {
  roomId: string;
  userId?: string;
  username: string;
  role: "host" | "participant";
}

export interface LeaveRoomPayload {
  roomId: string;
  userId: string;
}

export interface OfferPayload {
  roomId: string;
  senderId: string;
  receiverId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerPayload {
  roomId: string;
  senderId: string;
  receiverId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  roomId: string;
  senderId: string;
  receiverId: string;
  candidate: RTCIceCandidateInit;
}

export interface RoomCreatedPayload {
  roomId: string;
  roomName: string;
}

export interface UserJoinedPayload {
  userId: string;
  username: string;
  role: "host" | "participant";
}

export interface UserLeftPayload {
  userId: string;
}

export interface RoomStatePayload {
  roomId: string;
  clients: Client[];
}

// Client-to-server events
export type ClientEvents =
  | "create-room"
  | "join-room"
  | "leave-room"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "toggle-audio"
  | "toggle-video"
  | "get-room-state";

// Server-to-client events
export type ServerEvents =
  | "room-created"
  | "room-joined"
  | "room-full"
  | "user-joined"
  | "user-left"
  | "room-state"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "user-toggled-audio"
  | "user-toggled-video"
  | "error";
