// client/src/Avatar.tsx

import './styles.css';
import { nameToHslColor, getInitials } from './utils';
import { SOCKET_SERVER_URL } from './config';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
}

function Avatar({ name, avatarUrl }: AvatarProps) {
  if (!name) return null;

  if (avatarUrl) {
    const fullAvatarUrl = avatarUrl.startsWith('http') ? avatarUrl : `${SOCKET_SERVER_URL}${avatarUrl}`;
    return (
      <div className="avatar avatar-image-container">
        <img src={fullAvatarUrl} alt={`${name}'s avatar`} className="avatar-image" />
      </div>
    );
  }

  const initials = getInitials(name);
  const backgroundColor = nameToHslColor(name);
  const avatarStyle = {
    backgroundColor: backgroundColor,
  };

  return (
    <div className="avatar" style={avatarStyle}>
      <span className="avatar-initials">{initials}</span>
    </div>
  );
}

export default Avatar;
