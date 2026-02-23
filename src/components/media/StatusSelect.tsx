'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getStatusLabel, getStatusColor, cn } from '@/lib/utils';
import type { MediaStatus } from '@/types';

const statuses: MediaStatus[] = [
  'planned',
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'rewatching',
  'archived',
];

interface StatusSelectProps {
  value: MediaStatus;
  onChange: (status: MediaStatus) => void;
  className?: string;
}

export function StatusSelect({ value, onChange, className }: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('w-[160px]', className)}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              getStatusColor(value)
            )}
          />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  getStatusColor(status)
                )}
              />
              <span>{getStatusLabel(status)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
