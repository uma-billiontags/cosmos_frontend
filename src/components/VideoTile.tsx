import React, { useEffect, useRef } from 'react';
import { Card, Avatar, Tag, Space } from 'antd';
import { UserOutlined, AudioMutedOutlined, CrownOutlined } from '@ant-design/icons';
import type { Track } from 'livekit-client';

interface VideoTileProps {
  participantName: string;
  isLocal?: boolean;
  videoTrack?: Track | MediaStreamTrack | null;
  audioTrack?: Track | MediaStreamTrack | null;
  isMuted?: boolean;
  isCameraOff?: boolean;
  role?: string;
  isHost?: boolean;
  isActiveSpeaker?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participantName,
  isLocal = false,
  videoTrack,
  isMuted = false,
  isCameraOff = false,
  role = 'Employee',
  isHost = false,
  isActiveSpeaker = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isLocal) {
      videoEl.muted = true;
      videoEl.defaultMuted = true;
    }
    videoEl.playsInline = true;

    if (videoTrack && !isCameraOff) {
      if ('attach' in videoTrack && typeof (videoTrack as any).attach === 'function') {
        // LiveKit RemoteVideoTrack or LocalVideoTrack
        (videoTrack as any).attach(videoEl);
        return () => {
          (videoTrack as any).detach(videoEl);
        };
      } else {
        // Native browser MediaStream or MediaStreamTrack fallback
        const stream =
          videoTrack instanceof MediaStream
            ? videoTrack
            : new MediaStream([videoTrack as MediaStreamTrack]);

        videoEl.srcObject = stream;
        videoEl.play().catch(() => {});
        return () => {
          videoEl.srcObject = null;
        };
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [videoTrack, isCameraOff, isLocal]);

  // Generate consistent background color based on name
  const getAvatarBg = (name: string) => {
    const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#4f46e5'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Card
      style={{
        background: '#161b22',
        borderColor: isActiveSpeaker ? '#22c55e' : '#30363d',
        borderWidth: isActiveSpeaker ? 2 : 1,
        boxShadow: isActiveSpeaker
          ? '0 0 16px rgba(34, 197, 94, 0.45)'
          : '0 4px 12px rgba(0, 0, 0, 0.25)',
        borderRadius: 14,
        overflow: 'hidden',
        height: '100%',
        minHeight: 240,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      styles={{
        body: {
          padding: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local video playback to prevent audio feedback
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: isCameraOff || !videoTrack ? 'none' : 'block',
          transform: isLocal ? 'scaleX(-1)' : 'none', // Mirror local camera
        }}
      />

      {/* Avatar Fallback when camera is disabled (Cosmos Video UX) */}
      {(isCameraOff || !videoTrack) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at center, #1f293d 0%, #0d1117 100%)',
          }}
        >
          <Avatar
            size={80}
            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(participantName)}`}
            style={{
              backgroundColor: getAvatarBg(participantName),
              border: isActiveSpeaker ? '3px solid #22c55e' : '3px solid #334155',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            }}
            icon={<UserOutlined />}
          >
            {participantName ? participantName[0].toUpperCase() : 'U'}
          </Avatar>
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: '#f1f5f9', fontSize: 16, fontWeight: 600 }}>
              {participantName} {isLocal && '(You)'}
            </span>
          </div>
        </div>
      )}

      {/* Top overlay tags */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          gap: 6,
          zIndex: 2,
        }}
      >
        {isHost && (
          <Tag color="purple" icon={<CrownOutlined />} style={{ borderRadius: 6 }}>
            Host
          </Tag>
        )}
        {isMuted && (
          <Tag color="error" icon={<AudioMutedOutlined />} style={{ borderRadius: 6 }}>
            Muted
          </Tag>
        )}
      </div>

      {/* Bottom overlay: Participant Info */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: 8,
          zIndex: 2,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Space size={6}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {participantName} {isLocal && '(You)'}
          </span>
          <Tag
            color={role === 'Admin' ? 'volcano' : 'blue'}
            style={{ margin: 0, fontSize: 10, borderRadius: 4 }}
          >
            {role}
          </Tag>
        </Space>
      </div>
    </Card>
  );
};

export default VideoTile;
