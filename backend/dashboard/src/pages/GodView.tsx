import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cellToBoundary } from "h3-js";
import { useAuth } from "../contexts/AuthContext";

type LocationUpdate = {
  worker_id: number;
  worker_name: string;
  lat: number;
  lng: number;
  h3_cell: string;
  timestamp: string;
};

export function GodView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const workersLayer = useRef<L.LayerGroup | null>(null);
  const h3Layer = useRef<L.LayerGroup | null>(null);
  
  const [workers, setWorkers] = useState<Record<number, LocationUpdate>>({});
  const { token } = useAuth(); // Assuming useAuth exposes the JWT token

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) return;

    // Default center to India / block center if known
    mapInstance.current = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstance.current);

    workersLayer.current = L.layerGroup().addTo(mapInstance.current);
    h3Layer.current = L.layerGroup().addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Initialize WebSocket
  useEffect(() => {
    if (!token) return;
    
    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/location/?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "location_update") {
          setWorkers((prev) => ({
            ...prev,
            [data.worker_id]: data,
          }));
        }
      } catch (e) {
        console.error("WS Message Error:", e);
      }
    };

    return () => ws.close();
  }, [token]);

  // Update map markers
  useEffect(() => {
    if (!workersLayer.current || !h3Layer.current) return;
    
    workersLayer.current.clearLayers();
    h3Layer.current.clearLayers();

    const h3Counts: Record<string, number> = {};

    Object.values(workers).forEach((worker) => {
      // Draw worker marker
      L.circleMarker([worker.lat, worker.lng], {
        radius: 6,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 1,
      })
        .bindTooltip(`${worker.worker_name} (Active)`)
        .addTo(workersLayer.current!);

      // Count H3 density
      h3Counts[worker.h3_cell] = (h3Counts[worker.h3_cell] || 0) + 1;
    });

    // Draw H3 Polygons
    Object.entries(h3Counts).forEach(([cell, count]) => {
      try {
        const boundary = cellToBoundary(cell, true);
        const latLngs = boundary.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
        
        L.polygon(latLngs, {
          color: "#16a34a",
          weight: 2,
          fillColor: "#22c55e",
          fillOpacity: Math.min(0.2 + count * 0.1, 0.8),
        })
          .bindTooltip(`${count} Worker(s) in this zone`)
          .addTo(h3Layer.current!);
      } catch (e) {
        console.error("Invalid H3 cell:", cell);
      }
    });

    // Auto-fit bounds if we have workers and map hasn't been zoomed manually
    // Simplification: just auto-fit on first few workers
    if (Object.keys(workers).length > 0 && mapInstance.current) {
      const bounds = L.latLngBounds(Object.values(workers).map((w) => [w.lat, w.lng] as [number, number]));
      // only fit bounds if it's the first time
      if (!mapInstance.current.hasLayer(workersLayer.current)) {
         mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  }, [workers]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">God View - Live Dispatch</h1>
        <p className="text-sm text-gray-500">Real-time ASHA worker locations and coverage density.</p>
      </div>
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0 z-0" />
        
        <div className="absolute top-4 right-4 z-[400] bg-white p-4 rounded-lg shadow-lg border w-64">
          <h3 className="font-semibold mb-2">Live Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Active Workers</span>
              <span className="font-medium">{Object.keys(workers).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
