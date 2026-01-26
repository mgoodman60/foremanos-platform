'use client';

import * as React from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface ActionItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  description?: string;
}

export interface ActionGroup {
  id: string;
  label: string;
  icon?: LucideIcon;
  items: ActionItem[];
  variant?: 'default' | 'primary' | 'outline';
}

interface HeaderActionMenuProps {
  groups: ActionGroup[];
  className?: string;
}

const variantStyles = {
  default: 'bg-[#2d333b] border-gray-600 text-gray-200 hover:bg-[#3d434b] hover:text-white',
  primary: 'bg-[#F97316] border-orange-600 text-white hover:bg-[#ea6a0a]',
  outline: 'bg-transparent border-gray-600 text-gray-300 hover:bg-[#2d333b] hover:text-white',
};

const itemVariantStyles = {
  default: 'text-gray-200 hover:bg-[#3d434b]',
  destructive: 'text-red-400 hover:bg-red-500/10 hover:text-red-300',
  success: 'text-green-400 hover:bg-green-500/10 hover:text-green-300',
  warning: 'text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300',
};

export function HeaderActionMenu({ groups, className }: HeaderActionMenuProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {groups.map((group) => (
        <DropdownMenu key={group.id}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'flex items-center gap-1.5 border',
                variantStyles[group.variant || 'default']
              )}
            >
              {group.icon && <group.icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{group.label}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-[#2d333b] border-gray-700"
          >
            {group.items.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && item.variant === 'destructive' && (
                  <DropdownMenuSeparator className="bg-gray-700" />
                )}
                <DropdownMenuItem
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    itemVariantStyles[item.variant || 'default'],
                    item.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="text-xs text-gray-500">{item.description}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  );
}

// Single dropdown button for quick actions
interface QuickActionMenuProps {
  label: string;
  icon?: LucideIcon;
  items: ActionItem[];
  variant?: 'default' | 'primary' | 'outline';
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function QuickActionMenu({ 
  label, 
  icon: Icon, 
  items, 
  variant = 'default',
  className,
  align = 'end'
}: QuickActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'flex items-center gap-1.5 border',
            variantStyles[variant],
            className
          )}
        >
          {Icon && <Icon className="h-4 w-4" />}
          <span className="hidden sm:inline">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align={align} 
        className="w-56 bg-[#2d333b] border-gray-700"
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && item.variant === 'destructive' && (
              <DropdownMenuSeparator className="bg-gray-700" />
            )}
            <DropdownMenuItem
              onClick={item.onClick}
              disabled={item.disabled}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                itemVariantStyles[item.variant || 'default'],
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              <div className="flex flex-col">
                <span>{item.label}</span>
                {item.description && (
                  <span className="text-xs text-gray-500">{item.description}</span>
                )}
              </div>
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
