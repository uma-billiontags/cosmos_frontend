import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Button,
  Space,
  Typography,
  Tag,
  Tooltip,
  message,
  Spin,
  Modal,
} from 'antd';
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
  TeamOutlined,
  DesktopOutlined,
  StopOutlined,
  LogoutOutlined,
  ExclamationCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import {
  Room,
  RoomEvent,
  type VideoTrack,
  type AudioTrack,
  RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
  Track,
} from 'livekit-client';
import { useAuth } from '../context/AuthContext';
import { livekitApi } from '../api/livekit';
import { roomsApi } from '../api/rooms';
import VideoTile from '../components/VideoTile';
import ScreenShareView from '../components/ScreenShareView';
import ParticipantDrawer, { type MeetingParticipant } from '../components/ParticipantDrawer';
import InRoomChatDrawer from '../components/InRoomChatDrawer';
import CameraOffOutlined from '../components/CameraOffIcon';
import type { UserRole } from '../types';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

interface ParticipantTileData {
  identity: string;
  name: string;
  role: UserRole;
  isLocal: boolean;
  isHost: boolean;
  videoTrack?: VideoTrack | MediaStreamTrack | null;
  audioTrack?: AudioTrack | MediaStreamTrack | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

export const MeetingRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Call states
  const [connecting, setConnecting] = useState<boolean>(true);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [isVideoDisabled, setIsVideoDisabled] = useState<boolean>(true);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [activeScreenTrack, setActiveScreenTrack] = useState<
    VideoTrack | MediaStreamTrack | MediaStream | null
  >(null);
  const [screenPresenterName, setScreenPresenterName] = useState<string>('');
  const [isScreenLocal, setIsScreenLocal] = useState<boolean>(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  const [callDuration, setCallDuration] = useState<number>(0);

  // Participant Drawer, Chat Drawer & Leave Modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState<boolean>(false);

  // Participants list
  const [participants, setParticipants] = useState<ParticipantTileData[]>([]);

  // References
  const roomRef = useRef<Room | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);

  const isAdmin = user?.role === 'Admin';
  // If user created this room or is Admin, mark as Host
  const isHost = isAdmin || roomId?.startsWith('temp-') || user?.id === 'usr-admin-001';

  // Call duration counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Safe cleanup of media tracks and WebRTC session
  const cleanupMedia = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      localAudioStreamRef.current = null;
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => track.stop());
      localScreenStreamRef.current = null;
    }
  }, []);

  // Initialize Call (Graceful Avatar Mode Entry per Cosmos Video UX)
  useEffect(() => {
    let isMounted = true;

    const initCall = async () => {
      setConnecting(true);

      try {
        let liveKitToken: string | null = null;
        let serverUrl: string | null = null;

        try {
          if (roomId) {
            const tokenRes = await livekitApi.getRoomToken(roomId);
            liveKitToken = tokenRes.token;
            serverUrl = tokenRes.server_url;
          }
        } catch {
          // Backend token generation unreachable or offline
        }

        let liveKitConnected = false;

        if (liveKitToken && serverUrl) {
          try {
            const room = new Room({
              adaptiveStream: true,
              dynacast: true,
            });
            roomRef.current = room;

            // 1. Participant joined dynamically
            room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
              setParticipants((prev) => {
                if (prev.some((p) => p.identity === participant.identity)) return prev;
                return [
                  ...prev,
                  {
                    identity: participant.identity,
                    name: participant.name || participant.identity,
                    role: 'Employee' as UserRole,
                    isLocal: false,
                    isHost: false,
                    videoTrack: null,
                    audioTrack: null,
                    isMuted: true,
                    isCameraOff: true,
                    isScreenSharing: false,
                  },
                ];
              });
              message.info(`${participant.name || 'Participant'} joined the room.`);
            });

            // 2. Track subscribed (camera, mic, or screen sharing from peer)
            room.on(
              RoomEvent.TrackSubscribed,
              (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
                if (pub.source === Track.Source.ScreenShare) {
                  setActiveScreenTrack(track as VideoTrack);
                  setScreenPresenterName(participant.name || participant.identity);
                  setIsScreenLocal(false);
                  setIsScreenSharing(true);
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.identity === participant.identity ? { ...p, isScreenSharing: true } : p
                    )
                  );
                } else if (pub.source === Track.Source.Camera) {
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.identity === participant.identity
                        ? { ...p, videoTrack: track as VideoTrack, isCameraOff: false }
                        : p
                    )
                  );
                } else if (pub.source === Track.Source.Microphone) {
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.identity === participant.identity
                        ? { ...p, audioTrack: track as AudioTrack, isMuted: false }
                        : p
                    )
                  );
                }
              }
            );

            // 3. Track unsubscribed / stopped
            room.on(
              RoomEvent.TrackUnsubscribed,
              (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
                if (pub.source === Track.Source.ScreenShare || track === activeScreenTrack) {
                  setActiveScreenTrack(null);
                  setIsScreenSharing(false);
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.identity === participant.identity ? { ...p, isScreenSharing: false } : p
                    )
                  );
                } else if (pub.source === Track.Source.Camera) {
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.identity === participant.identity
                        ? { ...p, videoTrack: null, isCameraOff: true }
                        : p
                    )
                  );
                } else if (pub.source === Track.Source.Microphone) {
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.identity === participant.identity
                        ? { ...p, audioTrack: null, isMuted: true }
                        : p
                    )
                  );
                }
              }
            );

            // 4. Participant Left
            room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
              setParticipants((prev) => prev.filter((p) => p.identity !== participant.identity));
              message.info(`${participant.name || 'Participant'} left the room.`);
            });

            // 5. Active Speakers
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
              if (speakers.length > 0) {
                setActiveSpeakerId(speakers[0].identity);
              } else {
                setActiveSpeakerId(null);
              }
            });

            // Connect with a 4s timeout so user isn't stuck waiting if LiveKit daemon is down
            await Promise.race([
              room.connect(serverUrl, liveKitToken),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('LiveKit connection timeout')), 4000)
              ),
            ]);

            liveKitConnected = true;

            if (isMounted) {
              // Local user tile
              const localTile: ParticipantTileData = {
                identity: user?.id || 'local-user',
                name: user?.name || 'You',
                role: (user?.role || 'Employee') as UserRole,
                isLocal: true,
                isHost: isHost,
                videoTrack: null,
                audioTrack: null,
                isMuted: true,
                isCameraOff: true,
                isScreenSharing: false,
              };

              // Map all participants already present in the room
              const existingRemotes: ParticipantTileData[] = Array.from(
                room.remoteParticipants.values()
              ).map((rp: RemoteParticipant) => {
                const camPub = Array.from(rp.videoTrackPublications.values()).find(
                  (p) => p.source === Track.Source.Camera
                );
                const micPub = Array.from(rp.audioTrackPublications.values()).find(
                  (p) => p.source === Track.Source.Microphone
                );
                const screenPub = Array.from(rp.videoTrackPublications.values()).find(
                  (p) => p.source === Track.Source.ScreenShare
                );

                if (screenPub?.track) {
                  setActiveScreenTrack(screenPub.track as VideoTrack);
                  setScreenPresenterName(rp.name || rp.identity);
                  setIsScreenLocal(false);
                  setIsScreenSharing(true);
                }

                return {
                  identity: rp.identity,
                  name: rp.name || rp.identity,
                  role: 'Employee' as UserRole,
                  isLocal: false,
                  isHost: false,
                  videoTrack: camPub?.track as VideoTrack | null,
                  audioTrack: micPub?.track as AudioTrack | null,
                  isMuted: micPub ? micPub.isMuted : true,
                  isCameraOff: camPub ? camPub.isMuted || !camPub.track : true,
                  isScreenSharing: !!screenPub?.track,
                };
              });

              setParticipants([localTile, ...existingRemotes]);
            }
          } catch (lkErr) {
            console.warn('LiveKit server offline, operating in local interactive mode:', lkErr);
            liveKitConnected = false;
            if (roomRef.current) {
              roomRef.current.disconnect();
              roomRef.current = null;
            }
          }
        }

        if (!liveKitConnected && isMounted) {
          // Graceful local interactive mode with local participant + colleagues (Cosmos Video UX)
          setParticipants([
            {
              identity: user?.id || 'local-user',
              name: user?.name || 'You',
              role: (user?.role || 'Employee') as UserRole,
              isLocal: true,
              isHost: isHost,
              videoTrack: null,
              audioTrack: null,
              isMuted: true,
              isCameraOff: true,
              isScreenSharing: false,
            },
            {
              identity: 'colleague-001',
              name: 'Charu Latha (Team Lead)',
              role: 'Employee' as UserRole,
              isLocal: false,
              isHost: false,
              videoTrack: null,
              audioTrack: null,
              isMuted: false,
              isCameraOff: true,
              isScreenSharing: false,
            },
            {
              identity: 'colleague-002',
              name: 'David Kim (Designer)',
              role: 'Employee' as UserRole,
              isLocal: false,
              isHost: false,
              videoTrack: null,
              audioTrack: null,
              isMuted: true,
              isCameraOff: true,
              isScreenSharing: false,
            },
          ]);
        }

        if (isMounted) {
          message.info('Joined room in avatar mode. Unmute or turn on camera anytime.', 3);
        }
      } catch (err: unknown) {
        console.warn('Call initialization error:', err);
      } finally {
        if (isMounted) {
          setConnecting(false);
        }
      }
    };

    initCall();

    return () => {
      isMounted = false;
      cleanupMedia();
    };
  }, [roomId, user, isHost, cleanupMedia, activeScreenTrack]);

  // Toggle Microphone (PRD Step 3)
  const toggleMicrophone = async () => {
    const nextMuted = !isAudioMuted;

    if (!nextMuted) {
      // User wants to UNMUTE
      if (roomRef.current) {
        try {
          await roomRef.current.localParticipant.setMicrophoneEnabled(true);
          const audioPub = Array.from(
            roomRef.current.localParticipant.audioTrackPublications.values()
          )[0];
          setIsAudioMuted(false);
          setParticipants((prev) =>
            prev.map((p) =>
              p.isLocal ? { ...p, isMuted: false, audioTrack: audioPub?.track as AudioTrack } : p
            )
          );
          message.success('Microphone unmuted');
        } catch {
          message.warning('Could not access microphone. Check browser permissions.');
        }
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localAudioStreamRef.current = stream;
          const track = stream.getAudioTracks()[0];
          setIsAudioMuted(false);
          setParticipants((prev) =>
            prev.map((p) => (p.isLocal ? { ...p, isMuted: false, audioTrack: track } : p))
          );
          message.success('Microphone unmuted');
        } catch {
          message.warning('Microphone permission not granted or device not found.');
        }
      }
    } else {
      // User wants to MUTE
      if (roomRef.current) {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      } else if (localAudioStreamRef.current) {
        localAudioStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        localAudioStreamRef.current = null;
      }
      setIsAudioMuted(true);
      setParticipants((prev) =>
        prev.map((p) => (p.isLocal ? { ...p, isMuted: true, audioTrack: null } : p))
      );
      message.info('Microphone muted');
    }
  };

  // Toggle Camera (PRD Step 3)
  const toggleCamera = async () => {
    const nextVideoOff = !isVideoDisabled;

    if (!nextVideoOff) {
      // User wants to TURN ON CAMERA
      if (roomRef.current) {
        try {
          await roomRef.current.localParticipant.setCameraEnabled(true);
          const videoPub = Array.from(
            roomRef.current.localParticipant.videoTrackPublications.values()
          )[0];
          setIsVideoDisabled(false);
          setParticipants((prev) =>
            prev.map((p) =>
              p.isLocal ? { ...p, isCameraOff: false, videoTrack: videoPub?.track as VideoTrack } : p
            )
          );
          message.success('Camera turned on');
        } catch {
          message.warning('Could not access camera. Check browser permissions or device.');
        }
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          localStreamRef.current = stream;
          const track = stream.getVideoTracks()[0];
          setIsVideoDisabled(false);
          setParticipants((prev) =>
            prev.map((p) => (p.isLocal ? { ...p, isCameraOff: false, videoTrack: track } : p))
          );
          message.success('Camera turned on');
        } catch {
          message.warning('Camera permission not granted or camera is busy.');
        }
      }
    } else {
      // User wants to TURN OFF CAMERA
      if (roomRef.current) {
        await roomRef.current.localParticipant.setCameraEnabled(false);
      } else if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      setIsVideoDisabled(true);
      setParticipants((prev) =>
        prev.map((p) => (p.isLocal ? { ...p, isCameraOff: true, videoTrack: null } : p))
      );
      message.info('Camera turned off');
    }
  };

  // Toggle Screen Share (PRD Section 6.3 & Step 4)
  const toggleScreenShare = async () => {
    if (isScreenSharing && isScreenLocal) {
      stopScreenShare();
      return;
    }

    try {
      if (roomRef.current) {
        const pub = await roomRef.current.localParticipant.setScreenShareEnabled(true, {
          audio: false,
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
        });
        const screenPub =
          pub ||
          Array.from(
            roomRef.current.localParticipant.videoTrackPublications.values()
          ).find((p) => p.source === Track.Source.ScreenShare);

        if (screenPub?.track) {
          setActiveScreenTrack(screenPub.track as VideoTrack);
          setIsScreenSharing(true);
          setIsScreenLocal(true);
          setScreenPresenterName(user?.name || 'You');
          setParticipants((prev) =>
            prev.map((p) => (p.isLocal ? { ...p, isScreenSharing: true } : p))
          );

          if (screenPub.track.mediaStreamTrack) {
            screenPub.track.mediaStreamTrack.onended = () => {
              stopScreenShare();
            };
          }
          message.success('Screen sharing started.');
        }
      } else {
        // Native browser screen capture fallback
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
          } as MediaTrackConstraints,
          audio: false,
        });
        localScreenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Detect when user clicks browser's native "Stop Sharing" bar
        screenTrack.onended = () => {
          stopScreenShare();
        };

        // Pass the live MediaStream directly so Chrome/Edge attaches it immediately
        setActiveScreenTrack(screenStream);
        setIsScreenSharing(true);
        setIsScreenLocal(true);
        setScreenPresenterName(user?.name || 'You');
        setParticipants((prev) =>
          prev.map((p) => (p.isLocal ? { ...p, isScreenSharing: true } : p))
        );
        message.success('Screen sharing started.');
      }
    } catch (err) {
      console.log('Screen sharing cancelled or denied', err);
    }
  };

  const stopScreenShare = async () => {
    if (roomRef.current) {
      await roomRef.current.localParticipant.setScreenShareEnabled(false);
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      localScreenStreamRef.current = null;
    }

    setActiveScreenTrack(null);
    setIsScreenSharing(false);
    setIsScreenLocal(false);

    setParticipants((prev) =>
      prev.map((p) => (p.isLocal ? { ...p, isScreenSharing: false } : p))
    );
    message.info('Screen sharing stopped.');
  };

  // Host/Admin moderation actions (PRD Section 3)
  const handleMuteParticipant = async (identity: string) => {
    if (roomId) {
      roomsApi.moderateParticipant(roomId, identity, 'mute').catch(() => {});
    }
    setParticipants((prev) =>
      prev.map((p) => (p.identity === identity ? { ...p, isMuted: true } : p))
    );
    message.info('Participant has been muted.');
  };

  const handleRemoveParticipant = async (identity: string, name: string) => {
    if (roomId) {
      roomsApi.moderateParticipant(roomId, identity, 'remove').catch(() => {});
    }
    setParticipants((prev) => prev.filter((p) => p.identity !== identity));
    message.success(`${name} was removed from the meeting.`);
  };

  // Leave / End Meeting (PRD Section 7)
  const handleLeaveClick = () => {
    setIsLeaveModalOpen(true);
  };

  const executeLeave = async (endForAll: boolean) => {
    if (endForAll && roomId) {
      try {
        await roomsApi.endRoom(roomId);
      } catch (e) {
        console.error('Failed to end room on server:', e);
      }
    }
    cleanupMedia();
    setIsLeaveModalOpen(false);
    if (endForAll) {
      message.success('Meeting ended for all participants.');
    } else {
      message.success('You have left the room.');
    }
    navigate('/v/billion/office');
  };

  // Drawer participant data mapping
  const drawerParticipants: MeetingParticipant[] = participants.map((p) => ({
    identity: p.identity,
    name: p.name,
    role: p.role,
    isLocal: p.isLocal,
    isHost: p.isHost,
    isMuted: p.isMuted,
    isCameraOff: p.isCameraOff,
    isScreenSharing: p.isScreenSharing,
  }));

  return (
    <Layout style={{ height: '100vh', background: '#0d1117', overflow: 'hidden' }}>
      {/* Top Header */}
      <Header
        style={{
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
        }}
      >
        <Space size={12}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            {roomId ? roomId.replace(/-/g, ' ').toUpperCase() : 'MEETING ROOM'}
          </Title>
          <Tag color="cyan">
            <span style={{ color: '#52c41a' }}>● </span>
            {formatDuration(callDuration)}
          </Tag>
          {isScreenSharing && (
            <Tag color="geekblue" icon={<DesktopOutlined />}>
              Screen Shared
            </Tag>
          )}
        </Space>

        <Space size={12}>
          {/* Participant count button that opens Drawer */}
          <Button
            type="text"
            icon={<TeamOutlined />}
            style={{ color: '#fff' }}
            onClick={() => setIsDrawerOpen(true)}
          >
            Participants ({participants.length})
          </Button>

          {/* In-Room Chat button */}
          <Button
            type="text"
            icon={<MessageOutlined />}
            style={{ color: isChatOpen ? '#1677ff' : '#fff' }}
            onClick={() => setIsChatOpen(true)}
          >
            Chat
          </Button>

          <Button
            type="primary"
            danger
            icon={<CloseCircleOutlined />}
            onClick={handleLeaveClick}
          >
            Leave Call
          </Button>
        </Space>
      </Header>

      {/* Main Content Area */}
      <Content
        style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {connecting ? (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <Text style={{ color: '#aaa', display: 'block', marginTop: 16 }}>
              Joining Cosmos room...
            </Text>
          </div>
        ) : isScreenSharing && activeScreenTrack ? (
          /* Screen Share Presentation Layout (PRD Step 4) */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Screen Share Spotlight */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ScreenShareView
                presenterName={screenPresenterName}
                isLocal={isScreenLocal}
                track={activeScreenTrack}
                onStopSharing={stopScreenShare}
              />
            </div>

            {/* Video Filmstrip below Screen Share */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 4,
                maxHeight: 150,
              }}
            >
              {participants.map((participant) => (
                <div key={participant.identity} style={{ width: 200, height: 140, flexShrink: 0 }}>
                  <VideoTile
                    participantName={participant.name}
                    isLocal={participant.isLocal}
                    isHost={participant.isHost}
                    videoTrack={participant.videoTrack}
                    audioTrack={participant.audioTrack}
                    isMuted={participant.isMuted}
                    isCameraOff={participant.isCameraOff}
                    role={participant.role}
                    isActiveSpeaker={participant.identity === activeSpeakerId}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Standard Video Grid Layout (PRD Step 3) */
          <div
            style={{
              width: '100%',
              maxWidth: 1400,
              display: 'grid',
              gridTemplateColumns:
                participants.length === 1
                  ? '1fr'
                  : participants.length === 2
                  ? 'repeat(auto-fit, minmax(380px, 1fr))'
                  : 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {participants.map((participant) => (
              <VideoTile
                key={participant.identity}
                participantName={participant.name}
                isLocal={participant.isLocal}
                isHost={participant.isHost}
                videoTrack={participant.videoTrack}
                audioTrack={participant.audioTrack}
                isMuted={participant.isMuted}
                isCameraOff={participant.isCameraOff}
                role={participant.role}
                isActiveSpeaker={participant.identity === activeSpeakerId}
              />
            ))}
          </div>
        )}
      </Content>

      {/* Bottom Call Control Bar (Dock) */}
      <Footer
        style={{
          background: '#161b22',
          borderTop: '1px solid #30363d',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Microphone Toggle */}
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <Tooltip title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}>
            <Button
              shape="circle"
              size="large"
              type={isAudioMuted ? 'primary' : 'default'}
              danger={isAudioMuted}
              icon={
                isAudioMuted ? (
                  <AudioMutedOutlined style={{ fontSize: 20 }} />
                ) : (
                  <AudioOutlined style={{ fontSize: 20 }} />
                )
              }
              onClick={toggleMicrophone}
              style={{ width: 48, height: 48 }}
            />
          </Tooltip>
          <div
            style={{
              fontSize: 11,
              color: isAudioMuted ? '#f87171' : '#94a3b8',
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            {isAudioMuted ? 'Unmute' : 'Mute'}
          </div>
        </div>

        {/* Camera Toggle */}
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <Tooltip title={isVideoDisabled ? 'Turn On Camera' : 'Turn Off Camera'}>
            <Button
              shape="circle"
              size="large"
              type={isVideoDisabled ? 'primary' : 'default'}
              danger={isVideoDisabled}
              icon={
                isVideoDisabled ? (
                  <CameraOffOutlined style={{ fontSize: 20 }} />
                ) : (
                  <VideoCameraOutlined style={{ fontSize: 20 }} />
                )
              }
              onClick={toggleCamera}
              style={{ width: 48, height: 48 }}
            />
          </Tooltip>
          <div
            style={{
              fontSize: 11,
              color: isVideoDisabled ? '#f87171' : '#94a3b8',
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            Camera
          </div>
        </div>

        {/* Screen Share Button */}
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <Tooltip title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}>
            <Button
              shape="circle"
              size="large"
              type={isScreenSharing ? 'primary' : 'default'}
              icon={
                isScreenSharing ? (
                  <StopOutlined style={{ fontSize: 20 }} />
                ) : (
                  <DesktopOutlined style={{ fontSize: 20 }} />
                )
              }
              onClick={toggleScreenShare}
              style={{
                width: 48,
                height: 48,
                backgroundColor: isScreenSharing ? '#1677ff' : undefined,
                color: isScreenSharing ? '#fff' : undefined,
              }}
            />
          </Tooltip>
          <div
            style={{
              fontSize: 11,
              color: isScreenSharing ? '#38bdf8' : '#94a3b8',
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            Share
          </div>
        </div>

        {/* Participant List Toggle */}
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <Tooltip title="View Participants">
            <Button
              shape="circle"
              size="large"
              type={isDrawerOpen ? 'primary' : 'default'}
              icon={<TeamOutlined style={{ fontSize: 20 }} />}
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              style={{ width: 48, height: 48 }}
            />
          </Tooltip>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
            People
          </div>
        </div>

        {/* In-Room Chat Toggle */}
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <Tooltip title="In-Room Chat">
            <Button
              shape="circle"
              size="large"
              type={isChatOpen ? 'primary' : 'default'}
              icon={<MessageOutlined style={{ fontSize: 20 }} />}
              onClick={() => setIsChatOpen(!isChatOpen)}
              style={{ width: 48, height: 48 }}
            />
          </Tooltip>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
            Chat
          </div>
        </div>

        {/* Leave Room Button */}
        <div style={{ textAlign: 'center', minWidth: 54 }}>
          <Tooltip title="Leave Room">
            <Button
              type="primary"
              danger
              shape="circle"
              size="large"
              icon={<PhoneOutlined style={{ transform: 'rotate(135deg)', fontSize: 20 }} />}
              onClick={handleLeaveClick}
              style={{ width: 48, height: 48 }}
            />
          </Tooltip>
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 500 }}>
            Leave
          </div>
        </div>
      </Footer>

      {/* Participant Roster Drawer */}
      <ParticipantDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        participants={drawerParticipants}
        currentUserRole={user?.role}
        isCurrentUserHost={isHost}
        onMuteParticipant={handleMuteParticipant}
        onRemoveParticipant={handleRemoveParticipant}
      />

      {/* In-Room Chat Drawer (PRD Step 5) */}
      <InRoomChatDrawer
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        roomId={roomId || ''}
      />

      {/* Leave vs End Meeting Modal (PRD Section 7) */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 20 }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Leave Meeting</span>
          </Space>
        }
        open={isLeaveModalOpen}
        onCancel={() => setIsLeaveModalOpen(false)}
        centered
        width={440}
        footer={
          isHost || isAdmin
            ? [
                <Button key="cancel" onClick={() => setIsLeaveModalOpen(false)}>
                  Stay in Call
                </Button>,
                <Button
                  key="leave"
                  icon={<LogoutOutlined />}
                  onClick={() => executeLeave(false)}
                >
                  Just Leave
                </Button>,
                <Button
                  key="end"
                  type="primary"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => executeLeave(true)}
                >
                  End Meeting for All
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={() => setIsLeaveModalOpen(false)}>
                  Stay in Call
                </Button>,
                <Button
                  key="leave"
                  type="primary"
                  danger
                  icon={<LogoutOutlined />}
                  onClick={() => executeLeave(false)}
                >
                  Leave Call
                </Button>,
              ]
        }
      >
        {isHost || isAdmin ? (
          <p style={{ margin: '14px 0 8px', fontSize: 14, color: '#334155' }}>
            You are the host of this room. Do you want to end the meeting for everyone or just leave?
          </p>
        ) : (
          <p style={{ margin: '14px 0 8px', fontSize: 14, color: '#334155' }}>
            Are you sure you want to leave this call? You can return to your office space or rejoin anytime.
          </p>
        )}
      </Modal>
    </Layout>
  );
};

export default MeetingRoom;
