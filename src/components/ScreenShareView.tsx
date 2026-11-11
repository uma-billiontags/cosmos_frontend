import React, { useEffect, useRef } from 'react';
import { Card, Button, Typography, Space, Tooltip } from 'antd';
import { DesktopOutlined, StopOutlined, FullscreenOutlined } from '@ant-design/icons';
import type { Track } from 'livekit-client';

const { Text } = Typography;

interface ScreenShareViewProps {
  presenterName: string;
  isLocal: boolean;
  track: Track | MediaStreamTrack | MediaStream | null;
  onStopSharing: () => void;
}

export const ScreenShareView: React.FC<ScreenShareViewProps> = ({
  presenterName,
  isLocal,
  track,
  onStopSharing,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !track) return;

    // Explicitly configure DOM properties to guarantee Chrome/Edge autoplay without audio stalls
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('autoplay', '');

    // Extract underlying MediaStreamTrack if available from LiveKit track or MediaStream
    const mst: MediaStreamTrack | null =
      (track as any)?.mediaStreamTrack ||
      (track instanceof MediaStreamTrack ? track : null) ||
      (track instanceof MediaStream ? track.getVideoTracks()[0] : null);

    if (mst) {
      const stream = new MediaStream([mst]);
      videoEl.srcObject = stream;

      const playStream = () => {
        if (videoEl && videoEl.srcObject) {
          videoEl.play().catch((err) => {
            console.warn('Screen share autoplay stalled:', err);
          });
        }
      };

      videoEl.onloadedmetadata = playStream;
      videoEl.onloadeddata = playStream;
      videoEl.oncanplay = playStream;
      mst.onunmute = playStream;
      playStream();

      return () => {
        videoEl.onloadedmetadata = null;
        videoEl.onloadeddata = null;
        videoEl.oncanplay = null;
        mst.onunmute = null;
        videoEl.srcObject = null;
      };
    } else if ('attach' in track && typeof (track as any).attach === 'function') {
      try {
        (track as any).attach(videoEl);
        videoEl.play().catch((err) => console.warn('Autoplay caught:', err));
      } catch (e) {
        console.warn('Track attach error:', e);
      }
      return () => {
        try {
          (track as any).detach(videoEl);
        } catch (e) {}
      };
    } else {
      let streamToPlay: MediaStream;
      if (track instanceof MediaStream) {
        streamToPlay = track;
      } else if (track instanceof MediaStreamTrack) {
        streamToPlay = new MediaStream([track]);
      } else if ('getTracks' in (track as any) && typeof (track as any).getTracks === 'function') {
        streamToPlay = new MediaStream((track as any).getTracks());
      } else {
        streamToPlay = new MediaStream([track as any]);
      }

      videoEl.srcObject = streamToPlay;

      const playStream = () => {
        if (videoEl && videoEl.srcObject) {
          videoEl.play().catch((err) => {
            console.warn('Screen share autoplay stalled:', err);
          });
        }
      };

      videoEl.onloadedmetadata = playStream;
      videoEl.onloadeddata = playStream;
      videoEl.oncanplay = playStream;

      const vTracks = streamToPlay.getVideoTracks();
      if (vTracks.length > 0) {
        vTracks[0].onunmute = playStream;
      }

      playStream();

      return () => {
        videoEl.onloadedmetadata = null;
        videoEl.onloadeddata = null;
        videoEl.oncanplay = null;
        if (vTracks.length > 0) {
          vTracks[0].onunmute = null;
        }
        videoEl.srcObject = null;
      };
    }
  }, [track]);

  return (
    <Card
      style={{
        width: '100%',
        height: '100%',
        minHeight: 480,
        background: '#090d16',
        borderColor: '#1f293d',
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
      styles={{
        body: {
          padding: 0,
          flex: 1,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        },
      }}
    >
      {/* Screen video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          maxHeight: 'calc(100vh - 220px)',
          objectFit: 'contain',
          backgroundColor: '#090d16',
          display: 'block',
        }}
      />

      {/* Top Banner overlay */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '6px 14px',
          borderRadius: 8,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Space size={8}>
          <DesktopOutlined style={{ color: '#38bdf8', fontSize: 16 }} />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {isLocal ? 'You are sharing your screen' : `${presenterName} is presenting`}
          </Text>
        </Space>

        <Space size={8}>
          {isLocal && (
            <Button
              type="primary"
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={onStopSharing}
              style={{ borderRadius: 6 }}
            >
              Stop Sharing
            </Button>
          )}

          <Tooltip title="Fullscreen">
            <Button
              type="text"
              size="small"
              icon={<FullscreenOutlined style={{ color: '#94a3b8' }} />}
              onClick={() => {
                const el = videoRef.current;
                if (el) {
                  if (!document.fullscreenElement) {
                    el.requestFullscreen().catch(() => {});
                  } else {
                    document.exitFullscreen().catch(() => {});
                  }
                }
              }}
            />
          </Tooltip>
        </Space>
      </div>
    </Card>
  );
};

export default ScreenShareView;
