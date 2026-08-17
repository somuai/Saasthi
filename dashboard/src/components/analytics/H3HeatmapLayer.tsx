import React from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import { H3HeatmapCell } from '@/types';

interface Props {
  cells: H3HeatmapCell[];
}

export function H3HeatmapLayer({ cells }: Props) {
  const getColor = (density: number) => {
    if (density < 0.3) return '#22c55e'; // green
    if (density < 0.7) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  return (
    <>
      {cells.map((cell) => {
        // H3 boundary gives [lat, lng] arrays which are directly usable by Leaflet Polygon
        const positions = cellToBoundary(cell.h3_index);

        return (
          <Polygon
            key={cell.h3_index}
            positions={positions}
            pathOptions={{
              fillColor: getColor(cell.risk_density),
              fillOpacity: 0.3 + (cell.risk_density * 0.4), // 0.3 to 0.7
              color: getColor(cell.risk_density),
              weight: 1,
            }}
          >
            <Tooltip>
              <div className="p-1 text-sm">
                <p><strong>Total Patients:</strong> {cell.total_patients}</p>
                <p><strong>High Risk:</strong> {cell.high_risk_count}</p>
                <p><strong>Coverage:</strong> {cell.coverage_ratio.toFixed(1)}%</p>
              </div>
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
}
