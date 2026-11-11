import apiClient from './client';
import type { Room, RoomType } from '../types';

export interface CreateRoomPayload {
  name: string;
  type: RoomType;
  capacity: number;
  description?: string;
}

export interface RoomWithParticipants extends Room {
  active_participants?: {
    id: string;
    name: string;
    avatar_url?: string;
    role: string;
  }[];
}

export const roomsApi = {
  // Fetch all visible office rooms
  getRooms: async (): Promise<RoomWithParticipants[]> => {
    const response = await apiClient.get<RoomWithParticipants[]>('/rooms/');
    return response.data;
  },

  // Get a single room's details
  getRoomById: async (roomId: string): Promise<RoomWithParticipants> => {
    const response = await apiClient.get<RoomWithParticipants>(`/rooms/${roomId}/`);
    return response.data;
  },

  // Create a new permanent (Admin) or temporary (Employee) room
  createRoom: async (payload: CreateRoomPayload): Promise<RoomWithParticipants> => {
    const response = await apiClient.post<RoomWithParticipants>('/rooms/', payload);
    return response.data;
  },

  // Delete a room
  deleteRoom: async (roomId: string): Promise<void> => {
    await apiClient.delete(`/rooms/${roomId}/`);
  },

  // End a room session for all participants (PRD Step 3)
  endRoom: async (roomId: string): Promise<void> => {
    await apiClient.post(`/rooms/${roomId}/end/`);
  },

  // Moderate participant (mute or remove)
  moderateParticipant: async (roomId: string, identity: string, action: 'mute' | 'remove'): Promise<void> => {
    await apiClient.post(`/rooms/${roomId}/participants/${identity}/${action}/`);
  },
};

export default roomsApi;
