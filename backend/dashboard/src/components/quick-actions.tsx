import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { PackagePlusIcon, TruckIcon, SettingsIcon, DownloadIcon, ChevronRightIcon } from "lucide-react";

const actions = [
	{
		title: "Add product",
		description: "Create a new SKU.",
		href: "#",
		icon: (
			<PackagePlusIcon aria-hidden="true" />
		),
	},
	{
		title: "Review unfulfilled",
		description: "Orders waiting to ship.",
		href: "#",
		icon: (
			<TruckIcon aria-hidden="true" />
		),
	},
	{
		title: "Store settings",
		description: "Payments, checkouts etc.",
		href: "#",
		icon: (
			<SettingsIcon aria-hidden="true" />
		),
	},
	{
		title: "Export sales",
		description: "CSV for accountings.",
		href: "#",
		icon: (
			<DownloadIcon aria-hidden="true" />
		),
	},
] as const;

export function QuickActions() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Quick actions</CardTitle>
				<CardDescription>Shortcuts to same destinations.</CardDescription>
			</CardHeader>
			<CardContent>
				<ItemGroup className="gap-0">
					{actions.map((a) => (
						<Item asChild key={a.title} size="sm">
							<a href={a.href}>
								<ItemMedia variant="icon">{a.icon}</ItemMedia>
								<ItemContent>
									<ItemTitle>{a.title}</ItemTitle>
									<ItemDescription className="line-clamp-1">
										{a.description}
									</ItemDescription>
								</ItemContent>
								<ItemActions>
									<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
								</ItemActions>
							</a>
						</Item>
					))}
				</ItemGroup>
			</CardContent>
		</Card>
	);
}
