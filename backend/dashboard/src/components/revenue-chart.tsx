"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Link } from "react-router-dom";
import { formatChartAxisTick, formatChartTooltipDate } from "@/components/formater";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { revenueChartDemo } from "@/components/revenue-chart-data";
import { ArrowRightIcon } from "lucide-react";

/** Matches `<Select>`; chart uses the last N days. */
type PeriodDays = 7 | 14 | 30 | 60 | 90;

// Recharts XAxis: tick skip index based on period
const xAxisIntervalByPeriod: Record<PeriodDays, number> = {
	7: 0,
	14: 1,
	30: 3,
	60: 4,
	90: 6,
};

type SurveyRow = {
	date: string;
	surveys: number;
};

const chartConfig = {
	surveys: {
		label: "Surveys Conducted",
		color: "var(--chart-2)", // Teal/Emerald
	},
} satisfies ChartConfig;

export function RevenueChart() {
	const chartUid = useId().replace(/:/g, "");
	const idAreaGradient = `surveys-area-grad-${chartUid}`;
	const [periodDays, setPeriodDays] = useState<PeriodDays>(60);

	const chartRows = useMemo(
		() =>
			revenueChartDemo.slice(-periodDays).map((row) => ({
				date: row.date,
				surveys: Math.round(row.revenue / 150),
			})),
		[periodDays]
	);

	// Footer delta: first → last point in the active series
	const growthPct = useMemo(() => {
		const first = chartRows[0]?.surveys ?? 0;
		const last = chartRows[chartRows.length - 1]?.surveys ?? first;
		if (!first) {
			return 0;
		}
		return ((last - first) / first) * 100;
	}, [chartRows]);

	let xAxisMinTickGap: number | undefined;
	if (periodDays <= 7) {
		xAxisMinTickGap = undefined;
	} else {
		xAxisMinTickGap = Math.max(8, Math.min(52, Math.floor(periodDays / 2)));
	}

	return (
		<Card className="md:col-span-2 lg:col-span-4 border-slate-200/60 shadow-none">
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
				<div className="space-y-1">
					<CardTitle className="text-balance text-base md:text-lg font-bold text-slate-800">
						ASHA Health Surveys Activity
					</CardTitle>
					<CardDescription className="text-xs md:text-sm text-slate-400 font-medium">
						Total household surveys and risk logs submitted by workers
					</CardDescription>
				</div>
				<Select
					onValueChange={(v) => {
						setPeriodDays(Number(v) as PeriodDays);
					}}
					value={String(periodDays)}
				>
					<SelectTrigger
						aria-label="Activity time range"
						className="w-full min-w-36 sm:w-fit rounded-xl border-slate-200"
					>
						<SelectValue placeholder="Range" />
					</SelectTrigger>
					<SelectContent align="end" className="rounded-xl">
						<SelectItem value="7">Last 7 days</SelectItem>
						<SelectItem value="14">Last 14 days</SelectItem>
						<SelectItem value="30">Last 30 days</SelectItem>
						<SelectItem value="60">Last 60 days</SelectItem>
						<SelectItem value="90">Last 90 days</SelectItem>
					</SelectContent>
				</Select>
			</CardHeader>
			<CardContent>
				<ChartContainer
					className="aspect-auto h-60 w-full p-0"
					config={chartConfig}
				>
					<AreaChart
						accessibilityLayer
						data={[...chartRows]}
						margin={{ left: 24, right: 8, top: 8, bottom: 0 }}
					>
						<defs>
							<linearGradient id={idAreaGradient} x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="0%"
									stopColor="var(--color-surveys)"
									stopOpacity={0.2}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-surveys)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid horizontal={false} strokeDasharray="2 2" />
						<XAxis
							axisLine={false}
							dataKey="date"
							interval={xAxisIntervalByPeriod[periodDays]}
							minTickGap={xAxisMinTickGap}
							tickFormatter={(value) =>
								formatChartAxisTick(String(value), periodDays)
							}
							tickLine={false}
							tickMargin={8}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									className="min-w-36 rounded-xl border-slate-100"
									indicator="line"
									labelFormatter={(_, payload) => {
										const row = payload?.[0]?.payload as SurveyRow | undefined;
										if (!row?.date) {
											return "";
										}
										return formatChartTooltipDate(row.date, "short");
									}}
								/>
							}
						/>
						<Area
							dataKey="surveys"
							dot={false}
							fill={`url(#${idAreaGradient})`}
							stroke="var(--color-surveys)"
							strokeWidth={2.5}
							type="monotone"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="flex items-center justify-between border-t border-slate-100 pt-3">
				<div className="flex items-center gap-1.5 text-muted-foreground text-xs md:text-sm">
					<Delta value={growthPct}>
						<DeltaIcon />
						<DeltaValue />
					</Delta>
					<p className="inline-flex text-slate-400 font-medium">
						vs first day in last {periodDays} days
					</p>
				</div>
				<Button
					className="text-teal-700 hover:text-teal-900 font-bold text-xs p-0 h-auto hover:bg-transparent"
					variant="ghost"
					asChild
				>
					<Link to="/reports" className="flex items-center">
						View detailed reports
						<ArrowRightIcon className="h-3 w-3 ml-1" />
					</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}

