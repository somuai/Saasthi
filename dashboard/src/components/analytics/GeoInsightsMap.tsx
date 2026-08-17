"use client";

import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAnalyticsOverview } from '@/hooks/useAnalytics';
import { H3HeatmapLayer } from './H3HeatmapLayer';

export default function GeoInsightsMap() {
  const { data, isLoading } = useAnalyticsOverview();
  
  if (isLoading || !data) {
    return <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-muted/20 animate-pulse">Loading map...</div>;
  }

  return (
    <div className="w-full h-[500px] relative rounded-xl overflow-hidden border">
      <MapContainer 
        center={[19.076, 72.877]} 
        zoom={12} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        <H3HeatmapLayer cells={data.h3_heatmap} />
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur border p-3 rounded-lg shadow-lg z-[1000] text-sm">
        <h4 className="font-semibold mb-2">Risk Density</h4>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-[#ef4444] opacity-70 rounded"></div>
          <span>High (70-100%)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-[#eab308] opacity-50 rounded"></div>
          <span>Medium (30-69%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#22c55e] opacity-30 rounded"></div>
          <span>Low (0-29%)</span>
        </div>
      </div>
    </div>
  );
}
