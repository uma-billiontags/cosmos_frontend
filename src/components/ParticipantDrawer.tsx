import React from 'react';
import { Drawer, List, Avatar, Tag, Button, Space, Typography, Popconfirm, Tooltip } from 'antd';
import {
  UserOutlined,
  AudioMutedOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  DesktopOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import CameraOffOutlined from './CameraOffIcon';
import type { UserRole } from '../types';

const { Text } = Typography;

export interface MeetingParticipant {
  identity: string;
  name: string;
  role: UserRole;
  isLocal: boolean;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
}

interface ParticipantDrawerProps {
  open: boolean;
  onClose: () => void;
  participants: MeetingParticipant[];
  currentUserRole?: UserRole;
  isCurrentUserHost?: boolean;
  onMuteParticipant?: (identity: string) => void;
  onRemoveParticipant?: (identity: string, name: string) => void;
}

export const ParticipantDrawer: React.FC<ParticipantDrawerProps> = ({
  open,
  onClose,
  participants,
  currentUserRole,
  isCurrentUserHost = false,
  onMuteParticipant,
  onRemoveParticipant,
}) => {
  // PRD Section 3: Admin or Host can remove a participant or mute others
  const canModerate = currentUserRole === 'Admin' || isCurrentUserHost;

  const roleColors: Record<UserRole, string> = {
    Admin: 'volcano',
    Employee: 'blue',
    Guest: 'gold',
  };

  return (
    <Drawer
      title={
        <Space>
          <span>Participants</span>
          <Tag color="blue">{participants.length}</Tag>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={360}
      styles={{
        body: { padding: '12px 16px' },
      }}
    >
      <List
        itemLayout="horizontal"
        dataSource={participants}
        renderItem={(item) => (
          <List.Item
            key={item.identity}
            actions={[
              <Space key="media-status" size={8}>
                {item.isScreenSharing && (
                  <Tooltip title="Sharing screen">
                    <DesktopOutlined style={{ color: '#1677ff' }} />
                  </Tooltip>
                )}
                <Tooltip title={item.isCameraOff ? 'Camera off' : 'Camera on'}>
                  {item.isCameraOff ? (
                    <CameraOffOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <VideoCameraOutlined style={{ color: '#52c41a' }} />
                  )}
                </Tooltip>
                <Tooltip title={item.isMuted ? 'Muted' : 'Speaking'}>
                  {item.isMuted ? (
                    <AudioMutedOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <AudioOutlined style={{ color: '#52c41a' }} />
                  )}
                </Tooltip>
              </Space>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  style={{
                    backgroundColor: item.isLocal ? '#1677ff' : item.isHost ? '#722ed1' : '#8c8c8c',
                  }}
                  icon={<UserOutlined />}
                >
                  {item.name ? item.name[0].toUpperCase() : 'U'}
                </Avatar>
              }
              title={
                <Space size={6} wrap>
                  <Text strong style={{ fontSize: 13 }}>
                    {item.name} {item.isLocal && '(You)'}
                  </Text>
                  {item.isHost && (
                    <Tag color="purple" icon={<CrownOutlined />} style={{ fontSize: 10 }}>
                      Host
                    </Tag>
                  )}
                  <Tag color={roleColors[item.role]} style={{ fontSize: 10, margin: 0 }}>
                    {item.role}
                  </Tag>
                </Space>
              }
              description={
                canModerate && !item.isLocal ? (
                  <Space size={4} style={{ marginTop: 4 }}>
                    {!item.isMuted && (
                      <Button
                        size="small"
                        type="link"
                        style={{ padding: 0, fontSize: 12 }}
                        onClick={() => onMuteParticipant?.(item.identity)}
                      >
                        Mute
                      </Button>
                    )}
                    <Popconfirm
                      title={`Remove ${item.name}?`}
                      description="Are you sure you want to remove this participant from the room?"
                      okText="Remove"
                      okType="danger"
                      cancelText="Cancel"
                      onConfirm={() => onRemoveParticipant?.(item.identity, item.name)}
                    >
                      <Button size="small" type="link" danger style={{ padding: 0, fontSize: 12 }}>
                        Remove
                      </Button>
                    </Popconfirm>
                  </Space>
                ) : null
              }
            />
          </List.Item>
        )}
      />
    </Drawer>
  );
};

export default ParticipantDrawer;
