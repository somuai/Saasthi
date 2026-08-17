"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { WorkerMapInnerProps } from './WorkerMapInner';

// Dynamically import the map component with ssr disabled
// Leaflet requires the window object, which isn't available during server-side rendering
const WorkerMapInner = dynamic(
  () => import('./WorkerMapInner'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-md border shadow-sm bg-slate-50 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin mb-2 text-[#416CAF]" />
        <p>Loading interactive map...</p>
      </div>
    )
  }
);

export function WorkerMap(props: WorkerMapInnerProps) {
  return <WorkerMapInner {...props} />;
}
