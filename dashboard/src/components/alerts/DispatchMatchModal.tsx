import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/types';
import { useNearbyWorkers, useDispatchAssign } from '@/hooks/useDispatch';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert | null;
  onAssign: (workerId: number) => void;
}

export function DispatchMatchModal({ isOpen, onClose, alert, onAssign }: Props) {
  const [assignedWorker, setAssignedWorker] = useState<number | null>(null);
  
  const { data: workers, isLoading } = useNearbyWorkers(
    alert?.patient.location?.lat || 0,
    alert?.patient.location?.lng || 0,
    10
  );
  
  const { mutate: assignWorker, isPending } = useDispatchAssign();

  if (!alert) return null;

  const handleAssign = (workerId: number) => {
    assignWorker({ alertId: alert.id, workerId }, {
      onSuccess: () => {
        setAssignedWorker(workerId);
        setTimeout(() => {
          onAssign(workerId);
          setAssignedWorker(null);
          onClose();
        }, 1500);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Nearest Worker</DialogTitle>
          <DialogDescription>
            Matching optimal worker for {alert.patient.name} ({alert.patient.village})
          </DialogDescription>
        </DialogHeader>

        {assignedWorker ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl">✓</div>
            <h3 className="text-xl font-bold">Worker Assigned!</h3>
            <p className="text-muted-foreground">They have been notified and are en route.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              workers?.map((candidate, index) => (
                <div 
                  key={candidate.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg ${index === 0 ? 'bg-green-50 border-green-200' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{candidate.name}</h4>
                        {index === 0 && <Badge className="bg-green-500 text-white hover:bg-green-600">Recommended</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <Badge variant="outline">{candidate.distance_km.toFixed(1)} km away</Badge>
                        <span>{candidate.active_patients} active patients</span>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${candidate.status === 'Online' ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span>{candidate.status}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Last sync: {formatDistanceToNow(new Date(candidate.last_sync_time), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Button 
                    className="bg-[#416CAF] hover:bg-[#2c4e8a]"
                    disabled={isPending}
                    onClick={() => handleAssign(candidate.id)}
                  >
                    Assign
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
