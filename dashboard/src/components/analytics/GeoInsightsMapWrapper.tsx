"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const GeoInsightsMap = dynamic(
  () => import('./GeoInsightsMap'),
  { 
    ssr: false,
    loading: () => <Skeleton className="w-full h-[500px] rounded-xl" />
  }
);

export function GeoInsightsMapWrapper() {
  return <GeoInsightsMap />;
}
