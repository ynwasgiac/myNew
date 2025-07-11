// src/components/ui/Button.tsx
import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  className?: string;
  children?: React.ReactNode; // Made optional for icon-only buttons
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  title,
  className = '',
  children
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:hover:bg-blue-600',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 disabled:hover:bg-white',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:hover:bg-red-600',
  };

  const sizeClasses = {
    sm: children ? 'px-3 py-1.5 text-sm' : 'p-1.5', // Smaller padding for icon-only
    md: children ? 'px-4 py-2 text-sm' : 'p-2',
    lg: children ? 'px-6 py-3 text-base' : 'p-3',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading ? (
        <>
          <svg
            className={`animate-spin ${iconSizeClasses[size]} ${children ? 'mr-2' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {children && 'Loading...'}
        </>
      ) : (
        <>
          {icon && (
            <span className={`${children ? 'mr-2' : ''}`}>
              {React.cloneElement(icon as React.ReactElement, {
                className: iconSizeClasses[size]
              })}
            </span>
          )}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;