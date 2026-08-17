"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkers, Worker } from "@/hooks/useWorkers";
import { WorkerTable } from "@/components/workers/WorkerTable";
import { WorkerMap } from "@/components/workers/WorkerMap";
import { WorkerDetailDrawer } from "@/components/workers/WorkerDetailDrawer";
import { useAuth } from "@/providers/AuthProvider";
import { Map, List, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkersPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // State
  const [viewMode, setViewMode] = useState<"split" | "map" | "list">("split");
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);

  // Fetch workers
  const { data: workers, isLoading, refetch } = useWorkers();

  // Role Guard: Only supervisors can access this page
  useEffect(() => {
    if (user && user.role !== "supervisor" && !user.is_supervisor) {
      router.push("/");
    }
  }, [user, router]);

  if (!user || (user.role !== "supervisor" && !user.is_supervisor)) {
    return null; // Will redirect in useEffect
  }

  const handleWorkerSelect = (worker: Worker) => {
    setSelectedWorkerId(worker.id);
  };

  return (
    <div className="flex-1 space-y-4 h-full flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ASHA Workforce</h2>
          <p className="text-muted-foreground mt-1">Monitor and manage your field health workers.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh Data">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="bg-slate-100 p-1 rounded-lg border flex items-center hidden md:flex">
            <Button 
              variant={viewMode === 'split' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="px-3"
              onClick={() => setViewMode('split')}
            >
              Split View
            </Button>
            <Button 
              variant={viewMode === 'map' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="px-3 gap-2"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4" /> Map
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="px-3 gap-2"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" /> List
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col md:flex-row gap-4">
        {/* Map View */}
        {(viewMode === 'split' || viewMode === 'map') && (
          <div className={`flex-1 overflow-hidden rounded-md ${viewMode === 'split' ? 'md:w-1/2' : 'w-full'}`}>
            <WorkerMap 
              workers={workers || []} 
              selectedWorkerId={selectedWorkerId}
              onWorkerSelect={handleWorkerSelect}
            />
          </div>
        )}

        {/* List View */}
        {(viewMode === 'split' || viewMode === 'list') && (
          <div className={`flex-1 overflow-hidden ${viewMode === 'split' ? 'md:w-1/2' : 'w-full'}`}>
            <WorkerTable 
              data={workers || []}
              isLoading={isLoading}
              onRowClick={handleWorkerSelect}
              selectedWorkerId={selectedWorkerId}
            />
          </div>
        )}
      </div>

      <WorkerDetailDrawer 
        workerId={selectedWorkerId}
        isOpen={selectedWorkerId !== null}
        onClose={() => setSelectedWorkerId(null)}
      />
    </div>
  );
}
