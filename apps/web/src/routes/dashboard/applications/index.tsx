import type { Application } from "@/features/applications/types";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	ArchiveIcon,
	BriefcaseIcon,
	ChartBarIcon,
	DownloadSimpleIcon,
	KanbanIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	RowsIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import z from "zod";
import { Button } from "@reactive-resume/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@reactive-resume/ui/components/input-group";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Tabs, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { Combobox } from "@/components/ui/combobox";
import { ApplicationDetailSheet } from "@/features/applications/components/application-detail-sheet";
import { ApplicationFormSheet } from "@/features/applications/components/application-form-sheet";
import { ApplicationBoard } from "@/features/applications/components/board";
import { ImportApplicationsSheet } from "@/features/applications/components/import-applications-sheet";
import { ApplicationInsights } from "@/features/applications/components/insights-view";
import { ApplicationTable } from "@/features/applications/components/table-view";
import { applicationsListQueryOptions } from "@/features/applications/queries";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

const searchSchema = z.object({
	search: z.string().default(""),
	view: z.enum(["board", "table", "insights"]).default("board"),
	tags: z.array(z.string()).default([]),
	campaign: z.string().default(""),
	archived: z.boolean().default(false),
});
type Search = z.output<typeof searchSchema>;
const defaultSearch: Search = { search: "", view: "board", tags: [], campaign: "", archived: false };

export const Route = createFileRoute("/dashboard/applications/")({
	component: RouteComponent,
	validateSearch: searchSchema,
	search: { middlewares: [stripSearchParams(defaultSearch)] },
});

function RouteComponent() {
	const { i18n } = useLingui();
	const { search, view, tags, campaign, archived } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const [addOpen, setAddOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [editing, setEditing] = useState<Application | null>(null);
	const [selected, setSelected] = useState<Application | null>(null);

	// Editing from the detail panel: close the panel, open the edit form on the same application.
	const startEdit = (application: Application) => {
		setSelected(null);
		setEditing(application);
	};

	const { data: applications } = useQuery(applicationsListQueryOptions());
	const { data: allTags } = useQuery(orpc.applications.tags.queryOptions());
	const { data: campaigns } = useQuery(orpc.applications.campaigns.queryOptions());

	// Board & table hide archived; campaign/tag/search filters are applied client-side.
	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		return (applications ?? [])
			.filter((app) => archived || !app.archived)
			.filter((app) => !campaign || app.campaign === campaign)
			.filter((app) => tags.length === 0 || tags.every((tag: string) => app.tags.includes(tag)))
			.filter((app) => !query || app.company.toLowerCase().includes(query) || app.role.toLowerCase().includes(query));
	}, [applications, search, campaign, tags, archived]);

	const archivedCount = (applications ?? []).filter((app) => app.archived).length;

	const isEmpty = (applications?.length ?? 0) === 0;

	const setSearch = (patch: Partial<Search>) => void navigate({ search: (prev: Search) => ({ ...prev, ...patch }) });

	return (
		<div className="flex h-[calc(100dvh-2rem)] flex-col gap-4">
			<DashboardHeader
				icon={BriefcaseIcon}
				title={t`Applications`}
				actions={
					!isEmpty ? (
						<>
							<Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
								<DownloadSimpleIcon />
								<Trans>Import CSV</Trans>
							</Button>
							<Button size="sm" onClick={() => setAddOpen(true)}>
								<PlusIcon />
								<Trans>Add application</Trans>
							</Button>
						</>
					) : undefined
				}
			/>

			<Separator />

			{isEmpty ? (
				<EmptyState onAdd={() => setAddOpen(true)} onImport={() => setImportOpen(true)} />
			) : (
				<>
					<div className="flex flex-wrap items-center gap-3">
						<InputGroup className="w-full sm:w-56">
							<InputGroupAddon align="inline-start">
								<MagnifyingGlassIcon />
							</InputGroupAddon>
							<InputGroupInput
								value={search}
								placeholder={t`Search applications…`}
								onChange={(event) => setSearch({ search: event.target.value })}
							/>
						</InputGroup>

						{(campaigns?.length ?? 0) > 0 && (
							<div className="flex items-center gap-2">
								<Label className="text-muted-foreground text-xs">
									<Trans>Campaign</Trans>
								</Label>
								<Combobox
									className="w-44"
									value={campaign || null}
									showClear
									placeholder={t`All`}
									options={(campaigns ?? []).map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))}
									onValueChange={(value) => setSearch({ campaign: value ?? "" })}
								/>
							</div>
						)}

						{(allTags?.length ?? 0) > 0 && (
							<Combobox
								multiple
								className="w-44"
								value={tags}
								placeholder={t`Filter tags`}
								options={(allTags ?? []).map((tag) => ({ value: tag, label: tag }))}
								onValueChange={(value) => setSearch({ tags: value ?? [] })}
							/>
						)}

						{archivedCount > 0 && view !== "insights" && (
							<Button
								size="sm"
								variant={archived ? "secondary" : "outline"}
								onClick={() => setSearch({ archived: !archived })}
							>
								<ArchiveIcon />
								<Trans>Archived</Trans> ({archivedCount})
							</Button>
						)}

						<Tabs className="ms-auto" value={view}>
							<TabsList>
								<TabsTrigger
									value="board"
									nativeButton={false}
									render={<Link to="." search={(p: Search) => ({ ...p, view: "board" })} />}
								>
									<KanbanIcon />
									<span className="max-sm:sr-only">{i18n.t(msg`Board`)}</span>
								</TabsTrigger>
								<TabsTrigger
									value="table"
									nativeButton={false}
									render={<Link to="." search={(p: Search) => ({ ...p, view: "table" })} />}
								>
									<RowsIcon />
									<span className="max-sm:sr-only">{i18n.t(msg`Table`)}</span>
								</TabsTrigger>
								<TabsTrigger
									value="insights"
									nativeButton={false}
									render={<Link to="." search={(p: Search) => ({ ...p, view: "insights" })} />}
								>
									<ChartBarIcon />
									<span className="max-sm:sr-only">{i18n.t(msg`Insights`)}</span>
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					<div className="flex min-h-0 flex-1 flex-col">
						{view !== "insights" && filtered.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
								<p className="font-medium text-sm">
									<Trans>No applications match your filters.</Trans>
								</p>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setSearch({ search: "", tags: [], campaign: "", archived: false })}
								>
									<Trans>Clear filters</Trans>
								</Button>
							</div>
						) : (
							<>
								{view === "board" && (
									<ApplicationBoard applications={filtered} onOpen={setSelected} onEdit={setEditing} />
								)}
								{view === "table" && (
									<ApplicationTable applications={filtered} onOpen={setSelected} onEdit={setEditing} />
								)}
								{view === "insights" && <ApplicationInsights campaign={campaign || undefined} />}
							</>
						)}
					</div>
				</>
			)}

			<ApplicationFormSheet open={addOpen} onOpenChange={setAddOpen} />
			<ApplicationFormSheet open={!!editing} application={editing} onOpenChange={(open) => !open && setEditing(null)} />
			<ImportApplicationsSheet open={importOpen} onOpenChange={setImportOpen} />
			<ApplicationDetailSheet
				application={selected}
				onOpenChange={(open) => !open && setSelected(null)}
				onEdit={startEdit}
			/>
		</div>
	);
}

function EmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
			<div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
				<BriefcaseIcon className="size-7 text-muted-foreground" />
			</div>
			<div className="max-w-md space-y-1.5">
				<h2 className="font-semibold text-lg">
					<Trans>Track your first application</Trans>
				</h2>
				<p className="text-muted-foreground text-sm">
					<Trans>
						Add a job you're applying to, link the resume you sent, and move it through your pipeline as things
						progress.
					</Trans>
				</p>
			</div>
			<div className="flex gap-2">
				<Button onClick={onAdd}>
					<PlusIcon />
					<Trans>Add application</Trans>
				</Button>
				<Button variant="outline" onClick={onImport}>
					<DownloadSimpleIcon />
					<Trans>Import from CSV</Trans>
				</Button>
			</div>
		</div>
	);
}
