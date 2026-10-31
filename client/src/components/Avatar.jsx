import { initials } from '../lib/format.js';

export default function Avatar({ user, size = 48, className = '' }) {
  if (!user) return null;
  if (user.avatarUrl) {
    return <img className={`avatar av-${size} ${className}`} src={user.avatarUrl} alt="" width={size} height={size} loading="lazy" decoding="async" />;
  }
  return (
    <span className={`avatar av-${size} ${className}`} style={{ background: user.avatarColor }} aria-hidden="true">
      {initials(user.name)}
    </span>
  );
}
