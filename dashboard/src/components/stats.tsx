import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

type Stat = {
	label: string;
	value: string;
	delta: number;
	hint: string;
	colorClass?: string;
};

const stats: readonly Stat[] = [
	{
		label: "Total Beneficiaries",
		value: "1,482",
		delta: 4.2,
		hint: "vs prior 30 days",
		colorClass: "text-slate-900",
	},
	{
		label: "Active Pregnancies",
		value: "340",
		delta: 1.8,
		hint: "vs prior 7 days",
		colorClass: "text-teal-700",
	},
	{
		label: "High Risk Cases (HRP)",
		value: "42",
		delta: -2.4,
		hint: "vs prior 7 days",
		colorClass: "text-rose-600",
	},
	{
		label: "Open Risk Flags",
		value: "18",
		delta: -6.8,
		hint: "vs yesterday",
		colorClass: "text-rose-750",
	},
] as const;

export function DashboardStats() {
	return (
		<>
			{stats.map((s) => (
				<StatCard key={s.label} stat={s} />
			))}
		</>
	);
}

function StatCard({ stat }: { stat: Stat }) {
	const { label, value, delta, hint, colorClass } = stat;
	return (
		<Card className="shadow-none border-slate-200/60 hover:border-slate-350 hover:shadow-md transition-all duration-300 rounded-2xl">
			<CardHeader className="pb-2">
				<CardTitle className="font-bold text-slate-500 text-xs md:text-sm uppercase tracking-wider">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p className={`text-balance font-black text-3.5xl md:text-4xl lg:text-5xl tabular-nums leading-none tracking-tight ${colorClass}`}>
					{value}
				</p>
			</CardContent>
			<CardFooter className="gap-1.5 text-xs md:text-sm mt-1">
				<Delta value={delta} variant="default">
					<DeltaIcon />
					<DeltaValue />
				</Delta>
				<span className="text-slate-400 font-medium">{hint}</span>
			</CardFooter>
		</Card>
	);
}
