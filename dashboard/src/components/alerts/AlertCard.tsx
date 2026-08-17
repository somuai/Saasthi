import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onAssign?: (id: string) => void;
  onResolve?: (id: string) => void;
}

export function AlertCard({ alert, onAcknowledge, onAssign, onResolve }: Props) {
  let borderColor = 'border-l-blue-500';
  let badgeColor = 'bg-blue-500';
  let pulse = false;

  if (alert.severity === 'CRITICAL') {
    borderColor = 'border-l-red-500';
    badgeColor = 'bg-red-500';
    pulse = true;
  } else if (alert.severity === 'HIGH') {
    borderColor = 'border-l-orange-500';
    badgeColor = 'bg-orange-500';
  } else if (alert.severity === 'MEDIUM') {
    borderColor = 'border-l-yellow-500';
    badgeColor = 'bg-yellow-500 hover:bg-yellow-600';
  }

  return (
    <Card className={`border-l-4 ${borderColor} ${pulse ? 'animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}`}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <Badge className={`${badgeColor} text-white`}>{alert.severity}</Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
          </span>
        </div>
        
        <div>
          <h4 className="font-semibold text-lg">{alert.patient.name}, {alert.patient.age}</h4>
          <p className="text-sm text-muted-foreground">{alert.patient.village}</p>
        </div>
        
        <p className="text-sm font-medium">{alert.condition_summary}</p>
        
        {alert.assigned_worker && (
          <Badge variant="outline" className="w-max">Worker Assigned: {alert.assigned_worker.name}</Badge>
        )}

        <div className="flex gap-2 mt-2">
          {alert.status === 'ACTIVE' && onAcknowledge && (
            <Button variant="outline" size="sm" onClick={() => onAcknowledge(alert.id)}>Acknowledge</Button>
          )}
          {(alert.status === 'ACTIVE' || alert.status === 'IN_PROGRESS') && onAssign && (
            <Button variant="outline" size="sm" onClick={() => onAssign(alert.id)}>Assign Worker</Button>
          )}
          {alert.status === 'IN_PROGRESS' && onResolve && (
            <Button variant="outline" size="sm" onClick={() => onResolve(alert.id)}>Resolve</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
