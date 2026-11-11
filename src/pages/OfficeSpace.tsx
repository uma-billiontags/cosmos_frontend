import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Tag,
  Tooltip,
  Dropdown,
  Checkbox,
  message,
  Avatar,
  Modal,
  Input,
  Select,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  UserAddOutlined,
  EllipsisOutlined,
  MessageOutlined,
  AimOutlined,
  PlusOutlined,
  MinusOutlined,
  DownOutlined,
  FullscreenOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  BellOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  GlobalOutlined,
  ExportOutlined,
  CustomerServiceOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { presenceApi } from '../api/presence';
import { spacesApi } from '../api/spaces';
import DirectChatDrawer from '../components/DirectChatDrawer';
import CameraOffOutlined from '../components/CameraOffIcon';
import type { PresenceUpdate, User } from '../types';

// Exact floor plan zones matching user's Screenshots 3 & 5
const OFFICE_ZONES = [
  // Meeting Room 2 (Top Left)
  { id: 'meeting-2', name: 'Meeting Room 2', x: 180, y: 150, width: 220, height: 110, type: 'meeting' },

  // Stage Area (Top Right)
  { id: 'stage', name: 'Stage Area', x: 800, y: 150, width: 140, height: 60, type: 'stage' },

  // Daily Standup Table (Right side long conference table)
  { id: 'standup', name: 'Daily Standup', x: 850, y: 280, width: 180, height: 320, type: 'standup_table' },

  // Lounge with couch & plant (Center bottom)
  { id: 'lounge', name: 'Coffee Lounge', x: 620, y: 470, width: 120, height: 90, type: 'lounge' },

  // Desks Grid (Columns of 3 desks)
  { id: 'desk-4', name: 'Desk 4', x: 480, y: 280, width: 75, height: 50 },
  { id: 'desk-5', name: 'Desk 5', x: 580, y: 280, width: 75, height: 50 },
  { id: 'desk-6', name: 'Desk 6', x: 680, y: 280, width: 75, height: 50 },

  { id: 'desk-7', name: 'Desk 7', x: 180, y: 390, width: 75, height: 50 },
  { id: 'desk-8', name: 'Desk 8', x: 280, y: 390, width: 75, height: 50 },
  { id: 'desk-9', name: 'Desk 9', x: 380, y: 390, width: 75, height: 50 },

  { id: 'desk-10', name: 'Desk 10', x: 180, y: 530, width: 75, height: 50 },
  { id: 'desk-11', name: 'Desk 11', x: 280, y: 530, width: 75, height: 50 },
  { id: 'desk-12', name: 'Desk 12', x: 380, y: 530, width: 75, height: 50 },
];

export const OfficeSpace: React.FC = () => {
  const { spaceId } = useParams<{ spaceId: string }>();
  const currentSpace = spaceId || 'billiontags-team';
  const { user, loginAsGuest, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isGuestQuery = searchParams.get('guest') === 'true';
  const isGuest = isGuestQuery || user?.role === 'Guest';

  // Invite Modals state matching Screenshots 1, 2, 3
  const [inviteModalVisible, setInviteModalVisible] = useState<boolean>(false);
  const [inviteType, setInviteType] = useState<'members' | 'guests'>('members');
  const [guestJoinRoom, setGuestJoinRoom] = useState<string>(searchParams.get('room') || 'Cowork Desk');
  const [startCallInGalleryView, setStartCallInGalleryView] = useState<boolean>(false);
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<SpaceMember[]>([]);
  const [invitingMember, setInvitingMember] = useState<boolean>(false);
  const [showPremiumBanner, setShowPremiumBanner] = useState<boolean>(true);

  // Sidebar state matching Screenshots 1 & 2
  const [roomsExpanded, setRoomsExpanded] = useState<boolean>(true);
  const [channelsExpanded, setChannelsExpanded] = useState<boolean>(true);
  const [teamExpanded, setTeamExpanded] = useState<boolean>(true);
  const [offlineExpanded, setOfflineExpanded] = useState<boolean>(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState<string>('tv-room');

  // Mode switcher matching Screenshots 3 vs 4: 'space' (2D floor plan) vs 'call' (video/3D avatar stage)
  const [viewMode, setViewMode] = useState<'space' | 'call'>('space');

  // Media dock states
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(true);
  const [isHandRaised, setIsHandRaised] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [selectedContact, setSelectedContact] = useState<User | null>(null);

  // Avatar position on 2D map
  const [myPos, setMyPos] = useState<{ x: number; y: number }>({ x: 550, y: 570 });
  const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(0.38); // 38% matching screenshot

  // Step 6: Live Presence list of other teammates
  const [presences, setPresences] = useState<PresenceUpdate[]>([
    {
      user_id: 'c1',
      user_name: 'Charu Latha',
      status: 'online',
      current_desk: 'Desk 8',
      x: 300,
      y: 400,
    },
    {
      user_id: 'c2',
      user_name: 'Alex Rivera',
      status: 'online',
      current_desk: 'Daily Standup',
      x: 900,
      y: 350,
    },
  ]);

  // Sync own position with backend presence (Step 6 Presence)
  const syncPresence = useCallback(
    async (x: number, y: number, desk?: string) => {
      try {
        await presenceApi.updatePresence({
          x,
          y,
          desk,
          space: currentSpace,
          status: 'online',
        });
      } catch {
        // Local state
      }
    },
    [currentSpace]
  );

  // Poll active presences from backend every 6s
  useEffect(() => {
    const fetchPresences = async () => {
      try {
        const data = await presenceApi.getPresences(currentSpace);
        if (data && data.length > 0) {
          setPresences(data.filter((p) => p.user_id !== user?.id));
        }
      } catch {
        // Backend offline
      }
    };
    fetchPresences();
    const interval = setInterval(fetchPresences, 6000);
    return () => clearInterval(interval);
  }, [currentSpace, user]);

  // Handle auto-joining via member link and instant guest entry
  useEffect(() => {
    const handleEntry = async () => {
      // 1. If guest link and unauthenticated: log in as Guest automatically
      if (isGuestQuery && (!user || user.role !== 'Guest')) {
        try {
          const guestUser = await loginAsGuest(undefined, currentSpace);
          message.success(`Entered as ${guestUser.name}!`);
        } catch {
          // fallback
        }
      }

      // 2. If member join link (?join=member) and user is logged in
      const joinParam = searchParams.get('join');
      if (joinParam === 'member' && user && user.role !== 'Guest') {
        try {
          const res = await spacesApi.joinSpace(currentSpace);
          message.success(`You have joined ${res.space_name || currentSpace} as a member!`);
        } catch {
          // Already a member or error
        }
      }

      // 3. Load space members for the invite modal
      try {
        const members = await spacesApi.getMembers(currentSpace);
        setTeamMembers(members);
      } catch {
        // Space might be local
      }
    };

    handleEntry();
  }, [currentSpace, isGuestQuery, user, loginAsGuest, searchParams]);

  // Initial avatar position when joined to a specific room/zone
  useEffect(() => {
    const targetRoom = searchParams.get('room');
    if (targetRoom) {
      if (targetRoom.toLowerCase().includes('cowork')) {
        setMyPos({ x: 580, y: 320 });
      } else if (targetRoom.toLowerCase().includes('stage')) {
        setMyPos({ x: 800, y: 180 });
      } else if (targetRoom.toLowerCase().includes('reception')) {
        setMyPos({ x: 620, y: 480 });
      } else if (targetRoom.toLowerCase().includes('meeting')) {
        setMyPos({ x: 220, y: 180 });
      }
    }
  }, [searchParams]);

  // Handle guest leaving the space cleanly (Screenshot 4)
  const handleGuestLeave = async () => {
    try {
      await presenceApi.updatePresence({
        space: currentSpace,
        status: 'offline',
      });
    } catch {}
    setPresences((prev) => prev.filter((p) => p.user_id !== user?.id));
    logout();
    message.info('You have left the space.');
    navigate('/login');
  };

  // Invite member by email or name (Screenshot 1)
  const handleInviteMember = async () => {
    if (!searchMemberQuery.trim()) return;
    setInvitingMember(true);
    try {
      await spacesApi.inviteMember(currentSpace, { email: searchMemberQuery.trim(), role: 'member' });
      message.success(`Invited ${searchMemberQuery.trim()} to ${currentSpace}!`);
      setSearchMemberQuery('');
      const updated = await spacesApi.getMembers(currentSpace);
      setTeamMembers(updated);
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to invite member.');
    } finally {
      setInvitingMember(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} copied to clipboard!`);
  };

  // Smooth walk animation towards targetPos
  useEffect(() => {
    if (!targetPos) return;

    const interval = setInterval(() => {
      setMyPos((prev) => {
        const dx = targetPos.x - prev.x;
        const dy = targetPos.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 6) {
          setTargetPos(null);
          syncPresence(targetPos.x, targetPos.y);
          return targetPos;
        }

        const speed = 10;
        return {
          x: prev.x + (dx / dist) * speed,
          y: prev.y + (dy / dist) * speed,
        };
      });
    }, 16);

    return () => clearInterval(interval);
  }, [targetPos, syncPresence]);

  // Zone detection
  useEffect(() => {
    const found = OFFICE_ZONES.find((z) => {
      return (
        myPos.x >= z.x - 15 &&
        myPos.x <= z.x + z.width + 15 &&
        myPos.y >= z.y - 15 &&
        myPos.y <= z.y + z.height + 15
      );
    });

    if (found?.name !== activeZone) {
      setActiveZone(found?.name || null);
      if (found) {
        syncPresence(myPos.x, myPos.y, found.name);
      }
    }
  }, [myPos, activeZone, syncPresence]);

  // Keyboard navigation (WASD & Arrow keys)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const step = 20;
      setTargetPos(null);

      setMyPos((prev) => {
        let nx = prev.x;
        let ny = prev.y;

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') ny -= step;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') ny += step;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') nx -= step;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') nx += step;

        nx = Math.max(80, Math.min(1200, nx));
        ny = Math.max(80, Math.min(750, ny));

        syncPresence(nx, ny);
        return { x: nx, y: ny };
      });
    },
    [syncPresence]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFloorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;
    setTargetPos({ x: Math.round(clickX), y: Math.round(clickY) });
  };

  const spaceMenuItems: MenuProps['items'] = [
    {
      key: 'billion',
      label: 'billion',
      onClick: () => navigate('/v/billion/office'),
    },
    { type: 'divider' },
    {
      key: 'dashboard',
      label: 'Back to Spaces Dashboard',
      onClick: () => navigate('/dashboard'),
    },
  ];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c0f17',
        color: '#ffffff',
        overflow: 'hidden',
        fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
      }}
    >
      {/* 1. TOP HEADER (Matching Screenshots 1 & 4) */}
      <header
        style={{
          height: 50,
          backgroundColor: '#0c0e18',
          borderBottom: '1px solid #1a1d2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 30,
        }}
      >
        {/* Left: Space Dropdown with Cosmos Gradient Orb */}
        <Dropdown menu={{ items: spaceMenuItems }} trigger={['click']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              color: '#fff',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #38bdf8 100%)',
                boxShadow: '0 2px 6px rgba(244, 63, 94, 0.4)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 7,
                  left: 7,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#0c0e18',
                }}
              />
            </div>
            <span>{currentSpace === 'billiontags-team' ? 'Billiontags_Team' : currentSpace}</span>
            <DownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
          </div>
        </Dropdown>

        {/* Center: Top Mode Switcher (Space vs Call matching Screenshot 4) */}
        <div
          style={{
            backgroundColor: '#202330',
            borderRadius: 24,
            padding: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Space Button */}
          <button
            onClick={() => setViewMode('space')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 16px',
              borderRadius: 20,
              backgroundColor: viewMode === 'space' ? '#ffffff' : 'transparent',
              color: viewMode === 'space' ? '#0f172a' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 13 }}>🪐</span>
            <span>Space</span>
            <CustomerServiceOutlined style={{ fontSize: 13, color: viewMode === 'space' ? '#0f172a' : '#94a3b8' }} />
            <SoundOutlined style={{ fontSize: 13, color: viewMode === 'space' ? '#0f172a' : '#94a3b8' }} />
          </button>

          {/* Call Button */}
          <button
            onClick={() => setViewMode('call')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 16px',
              borderRadius: 20,
              backgroundColor: viewMode === 'call' ? '#ffffff' : 'transparent',
              color: viewMode === 'call' ? '#0f172a' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              transition: 'all 0.2s',
            }}
          >
            <VideoCameraOutlined style={{ fontSize: 14 }} />
            <span>Call</span>
          </button>
        </div>

        {/* Right: Window & Fullscreen Controls (Screenshot 4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ExportOutlined
            style={{ color: '#94a3b8', fontSize: 15, cursor: 'pointer' }}
            onClick={() => message.info('Pop out window')}
            title="Pop out"
          />
          <FullscreenOutlined
            style={{ color: '#94a3b8', fontSize: 15, cursor: 'pointer' }}
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            title="Fullscreen"
          />
        </div>
      </header>

      {/* 2. BODY: LEFT SIDEBAR + MAIN CANVAS */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* LEFT COLLAPSIBLE SIDEBAR (Matching Screenshots 1 & 2) */}
        <aside
          style={{
            width: 240,
            backgroundColor: '#f8f9fa',
            color: '#1e293b',
            borderRight: '1px solid #eef0f4',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '14px 10px',
            fontSize: 13,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {/* 1. Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              cursor: 'pointer',
              marginBottom: 12,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
            }}
            onClick={() => message.info('Search spaces, messages or teammates (⌘ K)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SearchOutlined style={{ color: '#64748b', fontSize: 14 }} />
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Search</span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: '#64748b',
                fontWeight: 600,
                backgroundColor: '#f1f5f9',
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid #e2e8f0',
              }}
            >
              ⌘ K
            </span>
          </div>

          {/* Unlock Premium Features Banner (Screenshots 2 & 3) */}
          {showPremiumBanner && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 12,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Unlock Premium Features</span>
                <CloseOutlined
                  onClick={() => setShowPremiumBanner(false)}
                  style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
                />
              </div>
              <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 10px 0', lineHeight: 1.45 }}>
                HD calls, 4K screen sharing & bigger video calls with a 14-day free trial!
              </p>
              <Button
                type="primary"
                size="small"
                style={{
                  backgroundColor: '#4f46e5',
                  borderColor: '#4f46e5',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  height: 30,
                  padding: '0 14px',
                }}
                onClick={() => message.info('Free trial started!')}
              >
                Start Trial
              </Button>
            </div>
          )}

          {/* 2. Top Navigation Links (Screenshot 1) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            {[
              { id: 'activities', label: 'Activities', icon: <BellOutlined style={{ fontSize: 15 }} /> },
              { id: 'past-chats', label: 'Past Meeting Chats', icon: <ClockCircleOutlined style={{ fontSize: 15 }} /> },
              { id: 'replays', label: 'Replays', icon: <VideoCameraOutlined style={{ fontSize: 15 }} /> },
              { id: 'calendar', label: "Today's Calendar", icon: <CalendarOutlined style={{ fontSize: 15 }} /> },
            ].map((item) => {
              const isActive = activeSidebarItem === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveSidebarItem(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '7px 10px',
                    borderRadius: 6,
                    color: isActive ? '#0f172a' : '#475569',
                    backgroundColor: isActive ? '#eef2f6' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ color: '#475569', display: 'flex' }}>{item.icon}</span>
                  <span style={{ fontSize: 13.5 }}>{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* 3. Rooms Section (Screenshot 1) */}
          <div style={{ marginTop: 8 }}>
            <div
              onClick={() => setRoomsExpanded(!roomsExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 6px',
                color: '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {roomsExpanded ? (
                <CaretDownOutlined style={{ fontSize: 10, color: '#64748b' }} />
              ) : (
                <CaretRightOutlined style={{ fontSize: 10, color: '#64748b' }} />
              )}
              <span>Rooms</span>
            </div>

            {roomsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                {/* Start New Call */}
                <div
                  onClick={() => message.info('Starting new call...')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    borderRadius: 6,
                    color: '#475569',
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <VideoCameraOutlined style={{ fontSize: 15, color: '#64748b' }} />
                  <span>Start New Call</span>
                </div>

                {/* TV Room (Active room with green vertical indicator) */}
                <div
                  onClick={() => setActiveSidebarItem('tv-room')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 6,
                    backgroundColor: activeSidebarItem === 'tv-room' ? '#eef2f6' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 3.5,
                        height: 16,
                        backgroundColor: '#10b981',
                        borderRadius: 2,
                        marginRight: 8,
                      }}
                    />
                    <DesktopOutlined style={{ fontSize: 15, color: '#334155', marginRight: 8 }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>TV Room</span>
                  </div>
                  <Avatar
                    size={20}
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.name || 'Guest 552'}`}
                    style={{ border: '1.5px solid #ffffff' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Channels Section (Screenshots 1 & 2) */}
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 6px',
                color: '#334155',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <div
                onClick={() => setChannelsExpanded(!channelsExpanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                {channelsExpanded ? (
                  <CaretDownOutlined style={{ fontSize: 10, color: '#64748b' }} />
                ) : (
                  <CaretRightOutlined style={{ fontSize: 10, color: '#64748b' }} />
                )}
                <span>Channels</span>
              </div>
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined style={{ fontSize: 11, color: '#475569' }} />}
                onClick={() => message.info('Create channel modal')}
                style={{ width: 22, height: 22, minWidth: 22, padding: 0 }}
              />
            </div>

            {channelsExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                {/* Threads */}
                <div
                  onClick={() => {
                    setActiveSidebarItem('threads');
                    setIsChatOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 6,
                    color: activeSidebarItem === 'threads' ? '#0f172a' : '#475569',
                    backgroundColor: activeSidebarItem === 'threads' ? '#eef2f6' : 'transparent',
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (activeSidebarItem !== 'threads') e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (activeSidebarItem !== 'threads') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <MessageOutlined style={{ fontSize: 14, color: '#64748b' }} />
                  <span>Threads</span>
                </div>

                {/* Channel List from Screenshots 1 & 2 */}
                {[
                  'announcements',
                  'billionmedia',
                  'general',
                  'introductions',
                  'random',
                  'welcome',
                ].map((channelName) => {
                  const channelId = `ch-${channelName}`;
                  const isActive = activeSidebarItem === channelId;
                  return (
                    <div
                      key={channelId}
                      onClick={() => setActiveSidebarItem(channelId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '6px 10px',
                        borderRadius: 6,
                        color: isActive ? '#0f172a' : '#475569',
                        backgroundColor: isActive ? '#eef2f6' : 'transparent',
                        fontSize: 13.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', width: 14, textAlign: 'center' }}>
                        #
                      </span>
                      <span>{channelName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Team Section (Screenshot 2) */}
          <div style={{ marginTop: 12 }}>
            <div
              onClick={() => setTeamExpanded(!teamExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 6px',
                color: '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {teamExpanded ? (
                <CaretDownOutlined style={{ fontSize: 10, color: '#64748b' }} />
              ) : (
                <CaretRightOutlined style={{ fontSize: 10, color: '#64748b' }} />
              )}
              <span>Team</span>
            </div>

            {teamExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: '#ffffff',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar
                      size={30}
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.name || 'Guest 552'}`}
                      style={{ backgroundColor: '#1e293b' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b',
                        border: '1.5px solid #ffffff',
                      }}
                    />
                  </div>
                  <div style={{ lineHeight: 1.25, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {user?.name || 'Guest 552'}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>(me)</span>
                      <GlobalOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {activeZone || 'TV Room'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. Offline Section (Screenshot 2) */}
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <div
              onClick={() => setOfflineExpanded(!offlineExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 6px',
                color: '#64748b',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {offlineExpanded ? (
                <CaretDownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
              ) : (
                <CaretRightOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
              )}
              <span>Offline</span>
            </div>
          </div>
        </aside>

        {/* MAIN STAGE: Space (2D Canvas) OR Call (3D Stage) */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {viewMode === 'space' ? (
            /* ======================================================== */
            /* VIEW A: 2D Interactive Office Map (Screenshots 3 & 5)    */
            /* ======================================================== */
            <div
              onClick={handleFloorClick}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                cursor: 'crosshair',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Transformable Canvas with exact dot-grid background */}
              <div
                style={{
                  width: 1400,
                  height: 900,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  marginLeft: -700,
                  marginTop: -450,
                  backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
                  backgroundSize: '24px 24px',
                  backgroundColor: '#ffffff',
                }}
              >
                {/* Render Desks & Zones matching Screenshots 3 & 5 */}
                {OFFICE_ZONES.map((zone) => {
                  const isCurrentZone = activeZone === zone.name;

                  // Daily Standup Table
                  if (zone.type === 'standup_table') {
                    return (
                      <div
                        key={zone.id}
                        style={{
                          position: 'absolute',
                          left: zone.x,
                          top: zone.y,
                          width: zone.width,
                          height: zone.height,
                          border: isCurrentZone ? '2px dashed #3b82f6' : '1px dashed #cbd5e1',
                          borderRadius: 20,
                          backgroundColor: isCurrentZone ? 'rgba(59, 130, 246, 0.05)' : '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            width: '80%',
                            height: '80%',
                            border: '1.5px solid #94a3b8',
                            borderRadius: 16,
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Tag color="cyan">👥 {zone.name}</Tag>
                        </div>
                      </div>
                    );
                  }

                  // Meeting Room 2
                  if (zone.type === 'meeting') {
                    return (
                      <div
                        key={zone.id}
                        style={{
                          position: 'absolute',
                          left: zone.x,
                          top: zone.y,
                          width: zone.width,
                          height: zone.height,
                          border: '1.5px solid #0f172a',
                          borderRadius: 12,
                          backgroundColor: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Tag color="geekblue" style={{ fontWeight: 600 }}>
                          {zone.name}
                        </Tag>
                      </div>
                    );
                  }

                  // Stage Area
                  if (zone.type === 'stage') {
                    return (
                      <div
                        key={zone.id}
                        style={{
                          position: 'absolute',
                          left: zone.x,
                          top: zone.y,
                          width: zone.width,
                          height: zone.height,
                          border: '2px solid #7c3aed',
                          borderRadius: 8,
                          backgroundColor: 'rgba(124, 58, 237, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Tag color="purple">🎭 {zone.name}</Tag>
                      </div>
                    );
                  }

                  // Coffee Lounge
                  if (zone.type === 'lounge') {
                    return (
                      <div
                        key={zone.id}
                        style={{
                          position: 'absolute',
                          left: zone.x,
                          top: zone.y,
                          width: zone.width,
                          height: zone.height,
                          border: '1px solid #fde047',
                          borderRadius: 16,
                          backgroundColor: '#fefce8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 12, color: '#ca8a04', fontWeight: 600 }}>
                          ☕ {zone.name}
                        </span>
                      </div>
                    );
                  }

                  // Standard Work Desks with black pill label
                  return (
                    <div
                      key={zone.id}
                      style={{
                        position: 'absolute',
                        left: zone.x,
                        top: zone.y,
                        width: zone.width,
                        height: zone.height,
                        border: isCurrentZone ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: 8,
                        backgroundColor: isCurrentZone ? '#eff6ff' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 4,
                          backgroundColor: '#64748b',
                          borderRadius: 2,
                          marginBottom: 4,
                        }}
                      />
                      <div
                        style={{
                          backgroundColor: isCurrentZone ? '#2563eb' : '#0f172a',
                          color: '#ffffff',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 10,
                        }}
                      >
                        {zone.name}
                      </div>
                    </div>
                  );
                })}

                {/* Render Other Online Teammates (Step 6 Presence) */}
                {presences.map((p) => (
                  <Tooltip title={`Message ${p.user_name}`} key={p.user_id}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContact({
                          id: p.user_id,
                          name: p.user_name || 'Teammate',
                          email: `${(p.user_name || 'teammate').toLowerCase().replace(/\s+/g, '.')}@billiontags.com`,
                          role: 'Employee',
                          status: p.status,
                        });
                        setIsChatOpen(true);
                      }}
                      style={{
                        position: 'absolute',
                        left: (p.x || 300) - 18,
                        top: (p.y || 400) - 18,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        zIndex: 15,
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          fontWeight: 700,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                      >
                        {p.user_name ? p.user_name[0] : 'U'}
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          color: '#fff',
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 8,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.user_name}
                      </div>
                    </div>
                  </Tooltip>
                ))}

                {/* Local User Avatar Token (Guest 470) - Matching Screenshot 3 & 5 */}
                <div
                  style={{
                    position: 'absolute',
                    left: myPos.x - 24,
                    top: myPos.y - 24,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 20,
                    pointerEvents: 'none',
                    transition: 'transform 0.05s linear',
                  }}
                >
                  <Avatar
                    size={48}
                    src="https://api.dicebear.com/7.x/bottts/svg?seed=Guest470"
                    style={{
                      border: '3px solid #f59e0b',
                      backgroundColor: '#1e293b',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.5)',
                    }}
                  />
                  <div
                    style={{
                      marginTop: 3,
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    }}
                  >
                    {user?.name || (isGuest ? 'Guest 552' : 'Guest 470')}
                  </div>
                </div>
              </div>

              {/* Floating Canvas Controls matching Screenshot 5 */}
              <div
                style={{
                  position: 'absolute',
                  right: 20,
                  bottom: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  zIndex: 20,
                }}
              >
                {/* 1. Recenter Button */}
                <Tooltip title="Recenter Avatar" placement="left">
                  <div
                    onClick={() => {
                      setMyPos({ x: 550, y: 570 });
                      setTargetPos(null);
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <AimOutlined style={{ fontSize: 20, color: '#0f172a' }} />
                  </div>
                </Tooltip>

                {/* 2. Zoom Pill */}
                <div
                  style={{
                    width: 44,
                    padding: '10px 0',
                    borderRadius: 22,
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                  }}
                >
                  <Tooltip title="Zoom In" placement="left">
                    <PlusOutlined
                      onClick={() => setZoom((z) => Math.min(1.2, +(z + 0.05).toFixed(2)))}
                      style={{ fontSize: 16, color: '#0f172a', cursor: 'pointer', padding: '4px' }}
                    />
                  </Tooltip>

                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', userSelect: 'none' }}>
                    {Math.round(zoom * 100)}%
                  </span>

                  <Tooltip title="Zoom Out" placement="left">
                    <MinusOutlined
                      onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.05).toFixed(2)))}
                      style={{ fontSize: 16, color: '#0f172a', cursor: 'pointer', padding: '4px' }}
                    />
                  </Tooltip>
                </div>

                {/* 3. Help Button (Scalloped Badge matching Screenshot 4 & 10) */}
                <Tooltip title="Help & Tutorials" placement="left">
                  <div
                    onClick={() => message.info('Help and tutorials')}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                    }}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2.2a2.8 2.8 0 0 0-2 .8 2.8 2.8 0 0 0-3.9 0 2.8 2.8 0 0 0-2 .8 2.8 2.8 0 0 0 0 3.9 2.8 2.8 0 0 0-.8 2 2.8 2.8 0 0 0 0 3.9 2.8 2.8 0 0 0 .8 2 2.8 2.8 0 0 0 0 3.9 2.8 2.8 0 0 0 3.9 0 2.8 2.8 0 0 0 2-.8 2.8 2.8 0 0 0 3.9 0 2.8 2.8 0 0 0 2 .8 2.8 2.8 0 0 0 3.9 0 2.8 2.8 0 0 0 0-3.9 2.8 2.8 0 0 0 .8-2 2.8 2.8 0 0 0 0-3.9 2.8 2.8 0 0 0-.8-2 2.8 2.8 0 0 0 0-3.9 2.8 2.8 0 0 0-3.9 0 2.8 2.8 0 0 0-2-.8z" />
                      <path d="M9.5 9a2.5 2.5 0 0 1 4.8.8c0 1.6-2.3 2.2-2.3 3.2" />
                      <line x1="12" y1="16.5" x2="12.01" y2="16.5" strokeWidth="2.4" />
                    </svg>
                  </div>
                </Tooltip>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* VIEW B: Call Mode / 3D Avatar Stage (Screenshot 4)       */
            /* ======================================================== */
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#090d16',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Full-Screen Stage Card matching Screenshot 4 */}
              <div
                style={{
                  width: '85%',
                  maxWidth: 800,
                  height: '75%',
                  maxHeight: 600,
                  backgroundColor: '#fcd34d', // Authentic warm yellow background
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                }}
              >
                {/* 3D Character Illustration */}
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=Guest470"
                  alt="Avatar"
                  style={{
                    width: 340,
                    height: 340,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.25))',
                  }}
                />

                {/* Bottom Left Name & Mute Badge matching Screenshot 4 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    padding: '6px 14px',
                    borderRadius: 24,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  }}
                >
                  <AudioMutedOutlined style={{ color: '#ef4444', fontSize: 14 }} />
                  <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 14 }} />
                  <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 13 }}>
                    {user?.name || 'Guest 470'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. BOTTOM CALL CONTROLS DOCK (Matching all 3 screenshots) */}
      <footer
        style={{
          height: 64,
          backgroundColor: '#0c0e18',
          borderTop: '1px solid #1a1d2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          zIndex: 30,
        }}
      >
        {/* Left: User Avatar & Mic/Cam/Share controls (Screenshot 2) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* User profile with online badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              <Avatar
                size={28}
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.name || 'Guest 552'}`}
                style={{ backgroundColor: '#1e293b' }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#f59e0b',
                  border: '1.5px solid #0c0e18',
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 600, marginTop: 3 }}>
              {user?.name || 'Guest 552'}
            </span>
          </div>

          {/* Unmute with dropdown caret */}
          <div
            onClick={() => setIsMuted(!isMuted)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {isMuted ? (
                <AudioMutedOutlined style={{ fontSize: 18, color: '#f43f5e' }} />
              ) : (
                <AudioOutlined style={{ fontSize: 18, color: '#10b981' }} />
              )}
              <DownOutlined style={{ fontSize: 8, color: '#94a3b8' }} />
            </div>
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>
              {isMuted ? 'Unmute' : 'Mute'}
            </span>
          </div>

          {/* Camera */}
          <div style={{ textAlign: 'center' }}>
            <Button
              shape="circle"
              size="large"
              type={isCameraOff ? 'default' : 'primary'}
              danger={isCameraOff}
              icon={isCameraOff ? <CameraOffOutlined /> : <VideoCameraOutlined />}
              onClick={() => {
                setIsCameraOff(!isCameraOff);
                message.info(isCameraOff ? 'Camera turned on' : 'Camera turned off');
              }}
              style={{ width: 44, height: 44 }}
            />
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Camera</div>
          </div>

          {/* Share */}
          <div
            onClick={() => message.info('Screen share ready!')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <DesktopOutlined style={{ fontSize: 18, color: '#ffffff' }} />
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>Share</span>
          </div>
        </div>

        {/* Center: Invite, Record, Hand, React, Move, More (Screenshot 3) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
          {/* Invite */}
          <div
            onClick={() => {
              setInviteType('members');
              setInviteModalVisible(true);
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <UserAddOutlined style={{ fontSize: 18, color: '#ffffff' }} />
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>Invite</span>
          </div>

          {/* Record */}
          <div
            onClick={() => message.info('Recording ready')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: '#f43f5e',
                display: 'inline-block',
                marginTop: 2,
                marginBottom: 2,
              }}
            />
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>Record</span>
          </div>

          {/* Hand */}
          <div
            onClick={() => setIsHandRaised(!isHandRaised)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={isHandRaised ? '#38bdf8' : 'none'}
              stroke={isHandRaised ? '#38bdf8' : '#ffffff'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v8a7 7 0 0 0 14 0v-3a2 2 0 0 0-4 0" />
            </svg>
            <span style={{ fontSize: 11, color: isHandRaised ? '#38bdf8' : '#f8fafc', fontWeight: 500, marginTop: 3 }}>
              Hand
            </span>
          </div>

          {/* React */}
          <div
            onClick={() => message.success('Reaction 👍')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 16 }}>👍</span>
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>React</span>
          </div>

          {/* Move */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'not-allowed',
              opacity: 0.45,
            }}
          >
            <span style={{ fontSize: 16 }}>🚶</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 3 }}>Move</span>
          </div>

          {/* More */}
          <div
            onClick={() => message.info('More settings')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <EllipsisOutlined style={{ fontSize: 18, color: '#ffffff' }} />
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>More</span>
          </div>
        </div>

        {/* Right: Chat, Apps, Set Home / Leave (Screenshot 3 & 4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Chat */}
          <div
            onClick={() => setIsChatOpen(true)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <MessageOutlined style={{ fontSize: 18, color: '#ffffff' }} />
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>Chat</span>
          </div>

          {/* Apps */}
          <div
            onClick={() => message.info('Apps panel')}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.5 13H19a2 2 0 0 1-2-2 2 2 0 0 1 2-2h1.5a1.5 1.5 0 0 0 0-3H19a2 2 0 0 1-2-2 2 2 0 0 1 2-2V2.5A1.5 1.5 0 0 0 17.5 1H14a2 2 0 0 1-2 2 2 2 0 0 1-2-2H6.5A1.5 1.5 0 0 0 5 2.5V4a2 2 0 0 1 2 2 2 2 0 0 1-2 2H3.5A1.5 1.5 0 0 0 2 9.5V13a2 2 0 0 1 2 2 2 2 0 0 1-2 2v1.5A1.5 1.5 0 0 0 3.5 20H7a2 2 0 0 1 2-2 2 2 0 0 1 2 2h3.5a1.5 1.5 0 0 0 1.5-1.5V17a2 2 0 0 1-2-2 2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
            </svg>
            <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>Apps</span>
          </div>

          {/* Leave Button in Red for Guests matching Screenshot 4, or Set Home matching Screenshot 3 & 5 */}
          {isGuest ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
              onClick={handleGuestLeave}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span style={{ fontSize: 11, marginTop: 3, color: '#ef4444', fontWeight: 600 }}>Leave</span>
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => message.success('Home desk set!')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8H4z" />
                <circle cx="12" cy="18" r="1.5" fill="#ffffff" />
              </svg>
              <span style={{ fontSize: 11, color: '#f8fafc', fontWeight: 500, marginTop: 3 }}>Set Home</span>
            </div>
          )}
        </div>
      </footer>

      {/* Direct Messages Drawer */}
      <DirectChatDrawer
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        selectedContact={selectedContact}
      />

      {/* 1. Modal: Invite People (Members) - Matching Screenshot 1 */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Invite People</span>}
        open={inviteModalVisible && inviteType === 'members'}
        onCancel={() => setInviteModalVisible(false)}
        footer={null}
        width={460}
      >
        <div style={{ marginTop: 12 }}>
          {/* Input & Invite button */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder="Enter names"
              value={searchMemberQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchMemberQuery(e.target.value)}
              onPressEnter={handleInviteMember}
              style={{ height: 40, borderRadius: 6 }}
            />
            <Button
              type="primary"
              loading={invitingMember}
              onClick={handleInviteMember}
              style={{
                backgroundColor: '#1e293b',
                borderColor: '#1e293b',
                height: 40,
                borderRadius: 6,
                fontWeight: 600,
                padding: '0 20px',
              }}
            >
              Invite
            </Button>
          </div>

          {/* Member List (matching Screenshot 1: Guest 552 with yellow dot) */}
          <div
            style={{
              marginTop: 16,
              border: '1px solid #f1f5f9',
              borderRadius: 8,
              padding: '12px 16px',
              minHeight: 120,
              maxHeight: 180,
              overflowY: 'auto',
            }}
          >
            {teamMembers.length > 0 ? (
              teamMembers.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid #f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#eab308',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
                      {m.name}
                    </span>
                  </div>
                  <Tag style={{ borderRadius: 6, fontSize: 11 }}>{m.role}</Tag>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#eab308',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
                  {user?.name || 'Guest 552'}
                </span>
              </div>
            )}
          </div>

          {/* Invite link for call */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              Invite link for call
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 12px',
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: '#475569',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${window.location.origin}/v/${currentSpace}/office?join=member`}
              </div>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyToClipboard(
                    `${window.location.origin}/v/${currentSpace}/office?join=member`,
                    'Invite link'
                  )
                }
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <Checkbox
                checked={startCallInGalleryView}
                onChange={(e) => setStartCallInGalleryView(e.target.checked)}
              >
                <span style={{ fontSize: 13, color: '#475569' }}>Start call in gallery view</span>
              </Checkbox>
            </div>
          </div>

          {/* Bottom link to switch to External Guest invite (Screenshot 1) */}
          <div style={{ marginTop: 24, textAlign: 'left' }}>
            <a
              onClick={() => setInviteType('guests')}
              style={{ fontSize: 13, color: '#2563eb', fontWeight: 500, textDecoration: 'none', cursor: 'pointer' }}
            >
              Invite guests to rooms
            </a>
          </div>
        </div>
      </Modal>

      {/* 2. Modal: Invite External Guests - Matching Screenshots 2 & 3 */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>Invite External Guests</span>}
        open={inviteModalVisible && inviteType === 'guests'}
        onCancel={() => setInviteModalVisible(false)}
        footer={null}
        width={480}
      >
        <div style={{ marginTop: 12 }}>
          {/* Guests join in Dropdown (Screenshots 2 & 3) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              Guests join in
            </div>
            <Select
              value={guestJoinRoom}
              onChange={setGuestJoinRoom}
              style={{ width: '100%', height: 40 }}
              options={[
                { value: 'Cowork Desk', label: 'Cowork Desk' },
                { value: 'Reception area', label: 'Reception area' },
                { value: 'Stage Area', label: 'Stage Area' },
                { value: 'Meeting Room 1', label: 'Meeting Room 1' },
                { value: 'Meeting Room 2', label: 'Meeting Room 2' },
              ]}
            />
          </div>

          {/* Call link for external guests */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
              Call link for external guests
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '8px 12px',
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: '#475569',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {`${window.location.origin}/v/${currentSpace}/office?guest=true&room=${encodeURIComponent(
                  guestJoinRoom
                )}`}
              </div>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyToClipboard(
                    `${window.location.origin}/v/${currentSpace}/office?guest=true&room=${encodeURIComponent(
                      guestJoinRoom
                    )}`,
                    'Guest call link'
                  )
                }
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <Checkbox
                checked={startCallInGalleryView}
                onChange={(e) => setStartCallInGalleryView(e.target.checked)}
              >
                <span style={{ fontSize: 13, color: '#475569' }}>Start call in gallery view</span>
              </Checkbox>
            </div>
          </div>

          {/* Info callout exactly matching Screenshot 2 */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: 8,
              padding: '14px 16px',
              marginTop: 16,
              border: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <InfoCircleOutlined style={{ fontSize: 16, color: '#64748b', marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  Anyone with a link can join Cosmos spaces. To add members visit "manage members", or to change
                  access settings visit "space access settings"
                </p>
                <p style={{ margin: 0 }}>
                  Invite links don't expire. Please note that guests can move between different rooms once they
                  are in the Cosmos space. You can kick guests by pressing "kick" from the user list in the sidebar.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Link (Screenshot 2) */}
          <div style={{ marginTop: 20, textAlign: 'left' }}>
            <span
              onClick={() => message.info('Space access is set to link-accessible')}
              style={{ fontSize: 13, color: '#2563eb', cursor: 'pointer', textDecoration: 'none' }}
            >
              Space access settings
            </span>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default OfficeSpace;
