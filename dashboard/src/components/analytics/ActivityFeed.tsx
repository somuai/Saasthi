"use client";

import React, { useEffect, useState } from 'react';
import { UserPlus, CheckCircle, GitBranch, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  type: 'registration' | 'visit' | 'referral' | 'alert';
  description: string;
  timestamp: Date;
}

const createInitialActivities = (): ActivityItem[] => [
  { id: '1', type: 'alert', description: 'Critical alert: Postpartum hemorrhage risk detected in Malad', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: '2', type: 'registration', description: 'New patient registered by Asha Worker #42', timestamp: new Date(Date.now() - 1000 * 60 * 15) },
  { id: '3', type: 'visit', description: 'Routine checkup completed in Andheri East', timestamp: new Date(Date.now() - 1000 * 60 * 45) },
  { id: '4', type: 'referral', description: 'Patient referred to District Hospital', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: '5', type: 'registration', description: 'New patient registered by Asha Worker #12', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
];

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>(createInitialActivities);

  useEffect(() => {
    const interval = setInterval(() => {
      const types: ('registration' | 'visit' | 'referral' | 'alert')[] = ['registration', 'visit', 'referral', 'alert'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      
      const newActivity: ActivityItem = {
        id: Math.random().toString(),
        type: randomType,
        description: `New ${randomType} event recorded in system`,
        timestamp: new Date()
      };

      setActivities(prev => [newActivity, ...prev].slice(0, 20));
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'registration': return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'visit': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'referral': return <GitBranch className="h-4 w-4 text-orange-500" />;
      case 'alert': return <ShieldAlert className="h-4 w-4 text-red-500" />;
      default: return <UserPlus className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <ScrollArea className="h-[300px] w-full pr-4">
      <div className="flex flex-col gap-4">
        {activities.map((item) => (
          <div key={item.id} className="flex items-start gap-4 text-sm">
            <div className="mt-0.5 bg-muted rounded-full p-1.5">
              {getIcon(item.type)}
            </div>
            <div className="flex-1 space-y-1">
              <p className="leading-none">{item.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
