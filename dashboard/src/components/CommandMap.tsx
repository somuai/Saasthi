"use client";

import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { apiClient } from "@/lib/api/client";

// Fix for default leaflet icons not loading properly in React
type LeafletDefaultIconPrototype = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface WorkerLocation {
  id: number;
  latitude: number;
  longitude: number;
  name?: string;
}

type WorkerLocationPayload = Partial<WorkerLocation> & {
  location?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  lat?: number;
  lng?: number;
};

function normalizeWorkerLocations(payload: unknown): WorkerLocation[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { results?: unknown[] })?.results)
      ? (payload as { results: unknown[] }).results
      : [];

  return rows.reduce<WorkerLocation[]>((locations, row, index) => {
      const worker = row as WorkerLocationPayload;
      const latitude = worker.latitude ?? worker.lat ?? worker.location?.latitude ?? worker.location?.lat;
      const longitude = worker.longitude ?? worker.lng ?? worker.location?.longitude ?? worker.location?.lng;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return locations;
      locations.push({
        id: Number(worker.id ?? index + 1),
        latitude: Number(latitude),
        longitude: Number(longitude),
        name: worker.name,
      });
      return locations;
    }, []);
}

export default function CommandMap() {
  const [workers, setWorkers] = useState<WorkerLocation[]>([]);
  
  useEffect(() => {
    // Fetch nearby workers or active dispatches from the backend
    const fetchLocations = async () => {
      try {
        const res = await apiClient.get("/location/nearby-workers/?lat=20.5937&lng=78.9629&radius_ring=10");
        setWorkers(normalizeWorkerLocations(res.data));
      } catch {
        setWorkers([]);
      }
    };
    
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full min-h-[400px] w-full rounded-xl overflow-hidden border shadow-sm">
      <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {workers.map((worker) => (
          <Marker key={worker.id} position={[worker.latitude, worker.longitude]}>
            <Popup>
              {worker.name || `Worker #${worker.id}`}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
