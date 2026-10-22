import React from 'react';

interface FundLeloLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon';
  showSubtitle?: boolean;
}

export function FundLeloLogo({
  className = '',
  size = 'md',
  variant = 'full',
  showSubtitle = false
}: FundLeloLogoProps) {
  // Height configurations
  const heightClasses = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
    xl: 'h-20'
  };

  const imageSrc = variant === 'icon' 
    ? '/fundlelo-icon.png' 
    : '/fundlelo-logo.png';

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <img
        src={imageSrc}
        alt="Fund Lelo"
        className={`${heightClasses[size]} w-auto object-contain transition-all duration-300 filter drop-shadow-sm`}
        loading="eager"
        decoding="async"
      />
      {showSubtitle && (
        <span className="text-[11px] font-semibold tracking-wider uppercase text-fuchsia-600 dark:text-fuchsia-400 mt-1">
          Collection CRM
        </span>
      )}
    </div>
  );
}

export default FundLeloLogo;
