"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Worker } from "@/hooks/useWorkers";
import { formatDistanceToNow } from "date-fns";

// Leaflet marker fix for Next.js
type LeafletDefaultIconPrototype = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons based on status
const createIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const icons = {
  Online: createIcon('green'),
  Syncing: createIcon('blue'),
  Offline: createIcon('grey')
};

export interface WorkerMapInnerProps {
  workers: Worker[];
  selectedWorkerId?: number | null;
  onWorkerSelect: (worker: Worker) => void;
}

export default function WorkerMapInner({ workers, selectedWorkerId, onWorkerSelect }: WorkerMapInnerProps) {
  const selectedWorker = selectedWorkerId ? workers.find(w => w.id === selectedWorkerId) : null;
  const center: [number, number] = selectedWorker
    ? [selectedWorker.location.lat, selectedWorker.location.lng]
    : [19.0760, 72.8777];

  return (
    <div className="h-full w-full rounded-md border shadow-sm overflow-hidden relative z-0">
      <MapContainer 
        key={selectedWorkerId ? `centered-${selectedWorkerId}` : 'default'} // Force re-render map when center significantly changes
        center={center} 
        zoom={selectedWorkerId ? 14 : 11} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {workers.map((worker) => (
          <Marker 
            key={worker.id}
            position={[worker.location.lat, worker.location.lng]}
            icon={icons[worker.status]}
            eventHandlers={{
              click: () => onWorkerSelect(worker)
            }}
          >
            <Popup>
              <div className="font-sans">
                <h4 className="font-bold text-base m-0">{worker.name}</h4>
                <p className="text-sm text-slate-600 m-0 mt-1">{worker.phone}</p>
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs font-semibold">Status:</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    worker.status === 'Online' ? 'bg-green-100 text-green-800' :
                    worker.status === 'Syncing' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {worker.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Last location: {formatDistanceToNow(new Date(worker.location.last_updated), { addSuffix: true })}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
