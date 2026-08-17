import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SystemHealthStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  services: SystemHealthStatus[];
}

export function SystemHealthPanel({ services }: Props) {
  // Determine overall status
  const hasDown = services.some(s => s.status === 'down');
  const hasDegraded = services.some(s => s.status === 'degraded');
  
  let overallText = 'All Systems Operational';
  let overallColor = 'bg-green-100 text-green-800 border-green-200';
  let overallIcon = 'bg-green-500 animate-pulse';

  if (hasDown) {
    overallText = 'Service Disruption';
    overallColor = 'bg-red-100 text-red-800 border-red-200';
    overallIcon = 'bg-red-500';
  } else if (hasDegraded) {
    overallText = 'Some Services Degraded';
    overallColor = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    overallIcon = 'bg-yellow-500';
  }

  return (
    <div className="space-y-6">
      {/* Overall Banner */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${overallColor}`}>
        <div className={`w-3 h-3 rounded-full ${overallIcon}`}></div>
        <h3 className="font-semibold text-lg">{overallText}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service, idx) => {
          let dotColor = 'bg-green-500 animate-pulse';
          let badgeVariant: "default" | "secondary" | "destructive" = 'default';
          
          if (service.status === 'down') {
            dotColor = 'bg-red-500';
            badgeVariant = 'destructive';
          } else if (service.status === 'degraded') {
            dotColor = 'bg-yellow-500';
            badgeVariant = 'secondary';
          }

          let latencyColor = 'text-green-600';
          if (service.latency_ms > 200) latencyColor = 'text-red-600';
          else if (service.latency_ms > 100) latencyColor = 'text-yellow-600';

          return (
            <Card key={idx}>
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                    <span className="font-semibold">{service.service}</span>
                  </div>
                  <Badge variant={badgeVariant} className="uppercase text-[10px]">
                    {service.status}
                  </Badge>
                </div>
                
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className={`font-medium ${latencyColor}`}>{service.latency_ms} ms</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last checked:</span>
                  <span>{formatDistanceToNow(new Date(service.last_check), { addSuffix: true })}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
