import type { ReactNode } from "react";
import {
	LayoutGridIcon,
	ActivityIcon,
	AlertTriangleIcon,
	ArrowUpRightIcon,
	CoinsIcon,
	BarChart3Icon,
	SettingsIcon,
	HelpCircleIcon,
    MapIcon,
} from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		label: "Overview",
		items: [
			{
				title: "Dashboard Overview",
				path: "/",
				icon: <LayoutGridIcon />,
				isActive: true,
			},
			{
				title: "Live Command Map",
				path: "/map",
				icon: <MapIcon />,
			},
		],
	},
	{
		label: "Clinical Register",
		items: [
			{
				title: "Doctor Triage",
				path: "/triage",
				icon: <AlertTriangleIcon />,
			},
			{
				title: "Referrals Pipeline",
				path: "/referrals",
				icon: <ArrowUpRightIcon />,
			},
		],
	},
	{
		label: "Operations",
		items: [
			{
				title: "Supervisor Inbox",
				path: "/incentives",
				icon: <CoinsIcon />,
			},
			{
				title: "Performance Reports",
				path: "/reports",
				icon: <BarChart3Icon />,
			},
		],
	},
	{
		label: "Settings",
		items: [
			{
				title: "System Settings",
				path: "/settings",
				icon: <SettingsIcon />,
			},
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{
		title: "Supervisor Help",
		path: "#/help",
		icon: <HelpCircleIcon />,
	},
	{
		title: "Platform Status",
		path: "#/status",
		icon: <ActivityIcon />,
	},
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];
