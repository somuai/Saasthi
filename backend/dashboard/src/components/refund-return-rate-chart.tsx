"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { ArrowRightIcon } from "lucide-react";

/** Daily referral resolution rate (% of high risk referrals resolved), last 7 days (demo). */
const referralsDaily7 = [
	{ day: "Mon", resolutionRate: 78.5 },
	{ day: "Tue", resolutionRate: 82.0 },
	{ day: "Wed", resolutionRate: 80.5 },
	{ day: "Thu", resolutionRate: 85.2 },
	{ day: "Fri", resolutionRate: 88.0 },
	{ day: "Sat", resolutionRate: 86.4 },
	{ day: "Sun", resolutionRate: 91.2 },
] as const;

/** Share of high risk referrals that were successfully resolved over the same window (demo). */
const RESOLVED_REFERRALS_SHARE_PCT = 84.2;

const chartConfig = {
	resolutionRate: {
		label: "Resolved %",
		color: "var(--chart-4)", // Purple
	},
} satisfies ChartConfig;

export function RefundReturnRateChart() {
	const first = referralsDaily7[0];
	const lastW = referralsDaily7[referralsDaily7.length - 1] ?? first;
	const resolutionTrendPct =
		first.resolutionRate > 0
			? ((lastW.resolutionRate - first.resolutionRate) / first.resolutionRate) * 100
			: 0;

	return (
		<Card className="md:col-span-2 border-slate-200/60 shadow-none">
			<CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-2">
				<div className="space-y-1">
					<CardTitle className="text-base md:text-lg font-bold text-slate-800">
						High Risk Referrals
					</CardTitle>
					<CardDescription className="text-xs md:text-sm text-slate-400 font-medium">
						Last 7 days resolution trend
					</CardDescription>
				</div>
				<div className="space-y-1 text-right sm:text-right">
					<CardTitle className="text-base md:text-lg font-bold text-teal-700">
						{RESOLVED_REFERRALS_SHARE_PCT}%
					</CardTitle>
					<CardDescription className="text-xs md:text-sm text-slate-400 font-medium">
						referrals resolved
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="mt-auto">
				<ChartContainer
					className="aspect-auto h-56 w-full"
					config={chartConfig}
				>
					<LineChart
						accessibilityLayer
						data={referralsDaily7 as any}
						margin={{ left: 12, right: 12, top: 12, bottom: 0 }}
					>
						<CartesianGrid horizontal={false} strokeDasharray="3 3" />
						<XAxis
							axisLine={false}
							dataKey="day"
							interval={1}
							minTickGap={8}
							tickLine={false}
							tickMargin={8}
						/>
						<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
						<Line
							dataKey="resolutionRate"
							dot={false}
							stroke="var(--color-resolutionRate)"
							strokeWidth={2.5}
							type="monotone"
						/>
					</LineChart>
				</ChartContainer>
			</CardContent>
			<CardFooter className="border-t border-slate-100 pt-3">
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-muted-foreground text-xs md:text-sm">
					<Delta value={resolutionTrendPct}>
						<DeltaIcon />
						<DeltaValue />
					</Delta>
					<span className="inline-flex min-w-0 text-slate-400 font-medium">
						vs first day (last 7 days)
					</span>
				</div>
				<Button
					className="text-teal-700 hover:text-teal-900 font-bold text-xs p-0 h-auto hover:bg-transparent"
					variant="ghost"
					asChild
				>
					<Link to="/referrals" className="flex items-center">
						Referrals list
						<ArrowRightIcon className="h-3 w-3 ml-1" />
					</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}

