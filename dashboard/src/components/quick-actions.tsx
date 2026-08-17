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
import { UserPlusIcon, HeartIcon, FilePlusIcon, DatabaseIcon, ChevronRightIcon } from "lucide-react";

const actions = [
	{
		title: "Onboard ASHA",
		description: "Register a new health worker.",
		href: "#/ashas/new",
		icon: (
			<UserPlusIcon aria-hidden="true" />
		),
	},
	{
		title: "Register Patient",
		description: "Add a new mother or child.",
		href: "#/patients/new",
		icon: (
			<HeartIcon aria-hidden="true" />
		),
	},
	{
		title: "Record Referral",
		description: "Log a clinical transfer referral.",
		href: "#/referrals/new",
		icon: (
			<FilePlusIcon aria-hidden="true" />
		),
	},
	{
		title: "Sync Audit logs",
		description: "Audit incoming sync packets.",
		href: "#/settings/config",
		icon: (
			<DatabaseIcon aria-hidden="true" />
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
						<Item key={a.title} size="sm" render={<a href={a.href} />}><ItemMedia variant="icon">{a.icon}</ItemMedia><ItemContent>
                        									<ItemTitle>{a.title}</ItemTitle>
                        									<ItemDescription className="line-clamp-1">
                        										{a.description}
                        									</ItemDescription>
                        								</ItemContent><ItemActions>
                        									<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                        								</ItemActions></Item>
					))}
				</ItemGroup>
			</CardContent>
		</Card>
	);
}
