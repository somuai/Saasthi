"use client";

import { 
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Worker } from "@/hooks/useWorkers";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

interface WorkerTableProps {
  data: Worker[];
  isLoading: boolean;
  onRowClick: (worker: Worker) => void;
  selectedWorkerId?: number | null;
}

export function WorkerTable({ data, isLoading, onRowClick, selectedWorkerId }: WorkerTableProps) {
  
  const columns: ColumnDef<Worker>[] = [
    {
      accessorKey: "name",
      header: "Worker Name",
      cell: ({ row }) => (
        <div className="font-medium text-slate-900">{row.getValue("name")}</div>
      )
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const colorClass = 
          status === "Online" ? "bg-green-100 text-green-800 border-green-200" : 
          status === "Syncing" ? "bg-blue-100 text-blue-800 border-blue-200 animate-pulse" : 
          "bg-slate-100 text-slate-800 border-slate-200";
          
        return (
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${status === 'Online' ? 'bg-green-500' : status === 'Syncing' ? 'bg-blue-500' : 'bg-slate-400'}`}></div>
            <Badge className={`whitespace-nowrap ${colorClass}`}>{status}</Badge>
          </div>
        );
      }
    },
    {
      accessorKey: "active_patients",
      header: "Active Patients",
    },
    {
      accessorKey: "last_sync_time",
      header: "Last Sync",
      cell: ({ row }) => {
        const dateStr = row.getValue("last_sync_time") as string;
        if (!dateStr) return <span className="text-muted-foreground">-</span>;
        
        return (
          <span className="text-sm text-slate-600">
            {formatDistanceToNow(new Date(dateStr), { addSuffix: true })}
          </span>
        );
      }
    }
  ];

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table intentionally returns table helpers.
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-semibold text-slate-700 whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-2 text-[#416CAF]" />
                    <p>Loading worker records...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`cursor-pointer transition-colors ${
                    selectedWorkerId === row.original.id ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"
                  }`}
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No workers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
