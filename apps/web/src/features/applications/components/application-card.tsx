import type { Application } from "../types";
import { Trans } from "@lingui/react/macro";
import { FileTextIcon, MapPinIcon } from "@phosphor-icons/react";
import { getInitials } from "@reactive-resume/utils/string";
import { cn } from "@reactive-resume/utils/style";
import { ApplicationActionsMenu } from "./application-actions-menu";

// Deterministic accent color for a company's logo tile (design shows colored initials tiles).
const TILE_COLORS = [
	"bg-rose-500",
	"bg-orange-500",
	"bg-amber-500",
	"bg-emerald-500",
	"bg-teal-500",
	"bg-sky-500",
	"bg-indigo-500",
	"bg-violet-500",
	"bg-fuchsia-500",
];

function tileColor(seed: string) {
	let hash = 0;
	for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
	return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

type Props = {
	application: Application;
	onClick?: () => void;
	onEdit?: (application: Application) => void;
	className?: string;
	dragging?: boolean;
};

export function ApplicationCard({ application, onClick, onEdit, className, dragging }: Props) {
	const followUp = application.followUpAt && !application.archived;

	return (
		// biome-ignore lint/a11y/useSemanticElements: the card nests an actions-menu <button>, so it can't itself be a <button>; it stays keyboard-operable via role + tabIndex + onKeyDown.
		<div
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onClick?.();
				}
			}}
			className={cn(
				"group relative w-full cursor-pointer rounded-xl border border-border bg-card p-3 text-left shadow-sm outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
				dragging && "opacity-60",
				className,
			)}
		>
			{onEdit && (
				<ApplicationActionsMenu
					application={application}
					onEdit={onEdit}
					showOnHover
					className="absolute end-1.5 top-1.5"
				/>
			)}
			<div className="flex items-start gap-2.5">
				<div
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-lg font-bold text-white text-xs",
						tileColor(application.company),
					)}
				>
					{getInitials(application.company)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="truncate font-semibold text-sm tracking-tight">{application.role}</div>
					<div className="truncate text-muted-foreground text-xs">{application.company}</div>
				</div>
				{followUp && (
					<span
						title="Needs follow-up"
						className={cn("mt-1 size-2 shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-500/25", onEdit && "me-6")}
					/>
				)}
			</div>

			{(application.location || application.salary) && (
				<div className="mt-2.5 flex items-center gap-2 text-muted-foreground text-xs">
					{application.location && (
						<span className="flex min-w-0 items-center gap-1">
							<MapPinIcon className="size-3 shrink-0" />
							<span className="truncate">{application.location}</span>
						</span>
					)}
					{application.location && application.salary && <span className="opacity-40">·</span>}
					{application.salary && <span className="font-medium text-foreground">{application.salary}</span>}
				</div>
			)}

			{(application.resumeId || application.source) && (
				<div className="mt-2.5 flex flex-wrap gap-1.5">
					{application.resumeId && (
						<span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
							<FileTextIcon className="size-3" />
							<Trans>Resume linked</Trans>
						</span>
					)}
					{application.source && (
						<span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
							{application.source}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
