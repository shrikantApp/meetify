import React from 'react';
import styles from './Button.module.css';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button: React.FC<Props> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const buttonClass = `
    ${styles.button} 
    ${styles[variant]} 
    ${styles[size]} 
    ${isLoading ? styles.loading : ''} 
    ${className}
  `.trim();

  return (
    <button 
      className={buttonClass} 
      disabled={disabled || isLoading} 
      {...props}
    >
      {isLoading ? <span className={styles.spinner} /> : children}
    </button>
  );
};
