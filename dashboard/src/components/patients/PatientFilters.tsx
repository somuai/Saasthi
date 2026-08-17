"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuLabel, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

interface PatientFiltersProps {
  search: string;
  setSearch: (val: string) => void;
  riskLevel: string;
  setRiskLevel: (val: string) => void;
}

export function PatientFilters({ search, setSearch, riskLevel, setRiskLevel }: PatientFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search patients by name..." 
          className="pl-10 w-full bg-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="flex items-center gap-2 bg-white">
                <Filter className="h-4 w-4" />
                Risk Level: {riskLevel}
              </Button>
            }
          >
            <span className="sr-only">Filter by risk level</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter by Risk</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={riskLevel} onValueChange={setRiskLevel}>
                <DropdownMenuRadioItem value="All">All</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="High">High Risk</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Medium">Medium Risk</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Low">Low Risk</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" className="flex items-center gap-2 bg-white">
          <SlidersHorizontal className="h-4 w-4" />
          More Filters
        </Button>
      </div>
    </div>
  );
}
