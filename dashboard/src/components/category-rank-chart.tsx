"use client";

import React from "react";
import { LabelList, Pie, PieChart } from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
} from "@/components/ui/chart";

export type CategoryMixDatum = {
	category: string;
	/** Percent of total (0–100). Usually sums to 100. */
	share: number;
};

const SLICE_PALETTE = [
	"var(--chart-4)", // Critical (Purple)
	"var(--chart-1)", // High (Rose)
	"var(--chart-3)", // Medium (Amber)
	"var(--chart-2)", // Low (Emerald)
] as const;

const SEVERITY_COLORS: Record<string, string> = {
	"Critical": "var(--chart-4)",
	"High": "var(--chart-1)",
	"Medium": "var(--chart-3)",
	"Low": "var(--chart-2)",
};

/** At most four named slices; remaining share rolls into a fifth slice, “Others”. */
const MAX_NAMED_SLICES = 4;

/** Rolling window for the mix (days). */
const periodDays = 30;

/** Demo mix (sums to 100). Replace or pass `data` on the component. */
const data = [
	{ category: "Critical", share: 8 },
	{ category: "High", share: 22 },
	{ category: "Medium", share: 38 },
	{ category: "Low", share: 32 },
] as const satisfies readonly CategoryMixDatum[];

/** Sort by share descending, keep top four, merge the rest into “Others” (max five slices). */
function consolidateTopFourAndOthers(
	data: readonly CategoryMixDatum[]
): CategoryMixDatum[] {
	if (data.length <= MAX_NAMED_SLICES) {
		return [...data];
	}

	const sorted = [...data].sort((a, b) => b.share - a.share);
	const head = sorted.slice(0, MAX_NAMED_SLICES);
	const tail = sorted.slice(MAX_NAMED_SLICES);
	const othersShare = tail.reduce((sum, row) => sum + row.share, 0);

	return [...head, { category: "Others", share: othersShare }];
}

type SliceRow = {
	key: string;
	category: string;
	share: number;
	fill: string;
};

function buildSlices(data: readonly CategoryMixDatum[]): {
	chartConfig: ChartConfig;
	pieData: SliceRow[];
} {
	const chartConfig: ChartConfig = {
		share: {
			label: "Share",
		},
	};

	const pieData: SliceRow[] = data.map((row, i) => {
		const key = `s${i}`;
		const color = SEVERITY_COLORS[row.category] || SLICE_PALETTE[i % SLICE_PALETTE.length];
		chartConfig[key] = {
			label: row.category,
			color,
		};
		return {
			key,
			category: row.category,
			share: row.share,
			fill: `var(--color-${key})`,
		};
	});

	return { chartConfig, pieData };
}

export function CategoryRankChart() {
	const { chartConfig, pieData } = React.useMemo(
		() => buildSlices(consolidateTopFourAndOthers(data)),
		[]
	);

	return (
		<Card className="border-slate-200/60 shadow-none">
			<CardHeader className="pb-2">
				<CardTitle className="text-base md:text-lg font-bold text-slate-800">
					Risk Flags by Severity
				</CardTitle>
				<CardDescription className="text-xs md:text-sm text-slate-400 font-medium">
					Breakdown of triaged clinical alerts, last {periodDays} days
				</CardDescription>
			</CardHeader>
			<CardContent className="my-auto p-0">
				<ChartContainer
					className="aspect-auto h-72 w-full"
					config={chartConfig}
				>
					<PieChart accessibilityLayer>
						<Pie
							cornerRadius={6}
							data={pieData}
							dataKey="share"
							innerRadius={50}
							nameKey="key"
							outerRadius="82%"
							stroke="var(--card)"
							strokeWidth={4}
						>
							<LabelList
								className="fill-background font-bold text-xs"
								dataKey="share"
								fill="currentColor"
								fontWeight={700}
								formatter={(label) => {
									const n = Number(label);
									return Number.isFinite(n) ? `${n}%` : String(label ?? "");
								}}
								position="inside"
								stroke="none"
							/>
						</Pie>
						<ChartLegend
							content={
								<ChartLegendContent
									className="flex flex-wrap justify-center gap-3 pt-2 text-slate-650"
									nameKey="key"
								/>
							}
						/>
					</PieChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
