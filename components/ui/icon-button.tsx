'use client';

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  tooltip: string;
  iconClassName?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

const sizeClasses = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

const variantClasses = {
  default: 'bg-gray-700 text-gray-200 hover:bg-gray-600 hover:text-white',
  ghost: 'text-gray-400 hover:bg-gray-700 hover:text-white',
  outline: 'border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white',
};

export function IconButton({
  icon: Icon,
  tooltip,
  iconClassName,
  variant = 'ghost',
  size = 'md',
  tooltipSide = 'top',
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900',
              sizeClasses[size],
              variantClasses[variant],
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            disabled={disabled}
            {...props}
          >
            <Icon className={cn(iconSizeClasses[size], iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="bg-gray-800 text-white border-gray-700">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simple wrapper for adding tooltip to any element
interface WithTooltipProps {
  tooltip: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}

export function WithTooltip({ tooltip, side = 'top', children }: WithTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className="bg-gray-800 text-white border-gray-700">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
