import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface Props {
  data: { axis: string; value: number }[];
  workerName: string;
}

export function WorkerRadarChart({ data, workerName }: Props) {
  return (
    <div className="flex flex-col items-center w-full h-full min-h-[250px]">
      <h4 className="text-sm font-semibold mb-2 text-center text-muted-foreground">{workerName}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fill: 'currentColor', fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name={workerName}
            dataKey="value"
            stroke="#416CAF"
            fill="#416CAF"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
