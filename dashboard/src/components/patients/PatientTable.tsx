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
import { Patient } from "@/hooks/usePatients";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface PatientTableProps {
  data: Patient[];
  isLoading: boolean;
  onRowClick: (patient: Patient) => void;
}

export function PatientTable({ data, isLoading, onRowClick }: PatientTableProps) {
  
  const columns: ColumnDef<Patient>[] = [
    {
      accessorKey: "name",
      header: "Patient Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      )
    },
    {
      accessorKey: "age",
      header: "Age",
    },
    {
      accessorKey: "cohort",
      header: "Cohort",
    },
    {
      accessorKey: "assigned_worker_name",
      header: "Assigned ASHA",
    },
    {
      accessorKey: "risk_level",
      header: "Risk Level",
      cell: ({ row }) => {
        const level = row.getValue("risk_level");
        const colorClass = 
          level === "High" ? "bg-red-100 text-red-800 border-red-200" : 
          level === "Medium" ? "bg-orange-100 text-orange-800 border-orange-200" : 
          "bg-green-100 text-green-800 border-green-200";
          
        return <Badge className={`whitespace-nowrap ${colorClass}`}>{level as string}</Badge>
      }
    },
    {
      accessorKey: "last_visit_date",
      header: "Last Visit",
      cell: ({ row }) => {
        const dateStr = row.getValue("last_visit_date") as string;
        if (!dateStr) return <span className="text-muted-foreground">-</span>;
        
        const date = new Date(dateStr);
        const isOverdue = (Date.now() - date.getTime()) > (30 * 24 * 60 * 60 * 1000); // 30 days
        
        return (
          <div className="flex flex-col">
            <span>{format(date, 'MMM dd, yyyy')}</span>
            {isOverdue && <span className="text-xs text-red-500 font-semibold">Overdue</span>}
          </div>
        );
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status");
        return (
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className="text-sm text-gray-600">{status as string}</span>
          </div>
        )
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
    <div className="rounded-md border bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto flex-1">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="font-semibold text-slate-700">
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
                    <p>Loading patient records...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-blue-50/50 transition-colors"
                  onClick={() => onRowClick(row.original as Patient)}
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
                  No patients found matching the criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
