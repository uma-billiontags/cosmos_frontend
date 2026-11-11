import React from 'react';

interface CameraOffIconProps {
  style?: React.CSSProperties;
  className?: string;
}

export const CameraOffOutlined: React.FC<CameraOffIconProps> = ({ style, className }) => {
  return (
    <span role="img" aria-label="camera-off" className={`anticon ${className || ''}`} style={style}>
      <svg
        viewBox="0 0 24 24"
        width="1.15em"
        height="1.15em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ verticalAlign: '-0.15em' }}
      >
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h5a2 2 0 0 1 2 2v3m4-4v10l-4-3" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </svg>
    </span>
  );
};

export default CameraOffOutlined;
