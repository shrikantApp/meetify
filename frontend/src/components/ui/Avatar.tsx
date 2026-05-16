import React from 'react';
import styles from './Avatar.module.css';

interface Props {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
}

export const Avatar: React.FC<Props> = ({ 
  name = '?', 
  src, 
  size = 'md', 
  status, 
  className = '' 
}) => {
  const avatarClass = `${styles.avatar} ${styles[size]} ${className}`.trim();
  
  return (
    <div className={avatarClass}>
      {src ? (
        <img src={src} alt={name} className={styles.image} />
      ) : (
        <div className={styles.placeholder}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {status && (
        <span className={`${styles.status} ${styles[status]}`} />
      )}
    </div>
  );
};
