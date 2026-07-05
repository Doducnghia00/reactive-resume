import type { ApplicationStatus } from "@reactive-resume/schema/applications/data";
import type { Application } from "../types";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { SparkleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { STAGES } from "@reactive-resume/schema/applications/data";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@reactive-resume/ui/components/sheet";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { Combobox } from "@/components/ui/combobox";
import { orpc } from "@/libs/orpc/client";
import { applicationsListQueryKey } from "../queries";

const SOURCE_OPTIONS = ["LinkedIn", "Indeed", "Company website", "Referral", "Recruiter", "Other"].map((s) => ({
	value: s,
	label: s,
}));

const EMPTY = {
	company: "",
	role: "",
	location: "",
	salary: "",
	source: "",
	status: "saved" as ApplicationStatus,
	resumeId: "",
	campaign: "",
	sourceUrl: "",
	jobDescription: "",
	followUpAt: "",
	followUpNote: "",
	notes: "",
};

type FormState = typeof EMPTY;

function toForm(app: Application): FormState {
	return {
		company: app.company,
		role: app.role,
		location: app.location ?? "",
		salary: app.salary ?? "",
		source: app.source ?? "",
		status: app.status,
		resumeId: app.resumeId ?? "",
		campaign: app.campaign ?? "",
		sourceUrl: app.sourceUrl ?? "",
		jobDescription: app.jobDescription ?? "",
		followUpAt: app.followUpAt ? new Date(app.followUpAt).toISOString().slice(0, 10) : "",
		followUpNote: app.followUpNote ?? "",
		notes: app.notes ?? "",
	};
}

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// When provided, the sheet edits this application instead of creating a new one.
	application?: Application | null;
};

export function ApplicationFormSheet({ open, onOpenChange, application }: Props) {
	const queryClient = useQueryClient();
	const isEditing = !!application;

	const [form, setForm] = useState<FormState>(application ? toForm(application) : EMPTY);

	// Re-sync the form when the sheet's target changes (a different app, or create ↔ edit).
	const [syncedId, setSyncedId] = useState(application?.id ?? null);
	if ((application?.id ?? null) !== syncedId) {
		setSyncedId(application?.id ?? null);
		setForm(application ? toForm(application) : EMPTY);
	}

	const { data: resumes } = useQuery(orpc.resume.list.queryOptions());
	const resumeOptions = (resumes ?? []).map((resume) => ({ value: resume.id, label: resume.name }));

	const { data: campaigns } = useQuery(orpc.applications.campaigns.queryOptions());

	const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: applicationsListQueryKey() });
		void queryClient.invalidateQueries({ queryKey: orpc.applications.stats.queryKey() });
		void queryClient.invalidateQueries({ queryKey: orpc.applications.campaigns.queryKey() });
		if (application) {
			void queryClient.invalidateQueries({
				queryKey: orpc.applications.getById.queryKey({ input: { id: application.id } }),
			});
		}
	};

	const create = useMutation(
		orpc.applications.create.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success(t`Application added to your pipeline.`);
				setForm(EMPTY);
				onOpenChange(false);
			},
			onError: () => toast.error(t`Couldn't add the application. Please try again.`),
		}),
	);

	const update = useMutation(
		orpc.applications.update.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success(t`Application updated.`);
				onOpenChange(false);
			},
			onError: () => toast.error(t`Couldn't save your changes. Please try again.`),
		}),
	);

	const autofill = useMutation(
		orpc.applications.ai.autofill.mutationOptions({
			onSuccess: (result) => {
				setForm((prev) => ({
					...prev,
					company: result.company || prev.company,
					role: result.role || prev.role,
					location: result.location || prev.location,
					salary: result.salary || prev.salary,
					jobDescription: result.jobDescription || prev.jobDescription,
				}));
				toast.success(t`Filled in what we could from the posting.`);
			},
			onError: (error) => toast.error(error.message || t`Auto-fill failed. Paste the description instead.`),
		}),
	);

	const pending = create.isPending || update.isPending;

	const submit = () => {
		if (!form.company.trim() || !form.role.trim()) return;
		const payload = {
			company: form.company.trim(),
			role: form.role.trim(),
			status: form.status,
			location: form.location.trim() || null,
			salary: form.salary.trim() || null,
			source: form.source || null,
			resumeId: form.resumeId || null,
			campaign: form.campaign.trim() || null,
			sourceUrl: form.sourceUrl.trim() || null,
			jobDescription: form.jobDescription.trim() || null,
			notes: form.notes.trim() || null,
			followUpNote: form.followUpNote.trim() || null,
			followUpAt: form.followUpAt ? new Date(form.followUpAt) : null,
		};
		if (application) update.mutate({ id: application.id, ...payload });
		else create.mutate(payload);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>{isEditing ? <Trans>Edit application</Trans> : <Trans>Add application</Trans>}</SheetTitle>
					<SheetDescription>
						{isEditing ? (
							<Trans>Update this application's details.</Trans>
						) : (
							<Trans>Track a job you're applying to and link the resume you sent.</Trans>
						)}
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
					{/* AI job-posting autofill: extracts the fields below from a posting URL. */}
					{!isEditing && (
						<div className="rounded-lg border border-border border-dashed p-3">
							<Label className="text-muted-foreground text-xs">
								<Trans>Paste a job posting URL</Trans>
							</Label>
							<div className="mt-1.5 flex gap-2">
								<Input
									value={form.sourceUrl}
									placeholder="https://…"
									onChange={(event) => set("sourceUrl", event.target.value)}
								/>
								<Button
									type="button"
									variant="outline"
									disabled={!form.sourceUrl.trim() || autofill.isPending}
									onClick={() => autofill.mutate({ sourceUrl: form.sourceUrl.trim() })}
								>
									<SparkleIcon />
									{autofill.isPending ? <Trans>Reading…</Trans> : <Trans>Auto-fill</Trans>}
								</Button>
							</div>
							<p className="mt-1.5 text-[11px] text-muted-foreground">
								<Trans>Let AI read the posting and fill the fields below.</Trans>
							</p>
						</div>
					)}

					<Field label={t`Company`} required>
						<Input value={form.company} onChange={(event) => set("company", event.target.value)} />
					</Field>
					<Field label={t`Role / title`} required>
						<Input value={form.role} onChange={(event) => set("role", event.target.value)} />
					</Field>

					<div className="grid grid-cols-2 gap-3">
						<Field label={t`Location`}>
							<Input value={form.location} onChange={(event) => set("location", event.target.value)} />
						</Field>
						<Field label={t`Salary range`}>
							<Input value={form.salary} onChange={(event) => set("salary", event.target.value)} />
						</Field>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<Field label={t`Source`}>
							<Combobox
								className="w-full"
								value={form.source || null}
								options={SOURCE_OPTIONS}
								placeholder={t`Select…`}
								onValueChange={(value) => set("source", value ?? "")}
							/>
						</Field>
						<Field label={t`Stage`}>
							<Combobox
								className="w-full"
								value={form.status}
								options={STAGES.map((s) => ({ value: s.value, label: s.label }))}
								onValueChange={(value) => value && set("status", value)}
							/>
						</Field>
					</div>

					<Field label={t`Resume used`}>
						<Combobox
							className="w-full"
							value={form.resumeId || null}
							options={resumeOptions}
							placeholder={t`Link a Reactive Resume…`}
							showClear
							emptyMessage={t`No resumes yet.`}
							onValueChange={(value) => set("resumeId", value ?? "")}
						/>
					</Field>

					<Field label={t`Campaign`}>
						<Input
							value={form.campaign}
							list="application-campaigns"
							placeholder={t`e.g. Spring 2026 · New Grad`}
							onChange={(event) => set("campaign", event.target.value)}
						/>
						<datalist id="application-campaigns">
							{(campaigns ?? []).map((campaign) => (
								<option key={campaign.name} value={campaign.name} />
							))}
						</datalist>
					</Field>

					<div className="grid grid-cols-2 gap-3">
						<Field label={t`Follow-up date`}>
							<Input type="date" value={form.followUpAt} onChange={(event) => set("followUpAt", event.target.value)} />
						</Field>
						<Field label={t`Follow-up note`}>
							<Input value={form.followUpNote} onChange={(event) => set("followUpNote", event.target.value)} />
						</Field>
					</div>

					<Field label={t`Job description`}>
						<Textarea
							value={form.jobDescription}
							rows={3}
							placeholder={t`Paste the posting — powers AI match scoring and tailoring.`}
							onChange={(event) => set("jobDescription", event.target.value)}
						/>
					</Field>

					<Field label={t`Notes`}>
						<Textarea
							value={form.notes}
							rows={3}
							placeholder={t`Referred by…, things to emphasize, etc.`}
							onChange={(event) => set("notes", event.target.value)}
						/>
					</Field>
				</div>

				<SheetFooter className="flex-row justify-end gap-2">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
						<Trans>Cancel</Trans>
					</Button>
					<Button type="button" disabled={!form.company.trim() || !form.role.trim() || pending} onClick={submit}>
						{isEditing ? <Trans>Save changes</Trans> : <Trans>Add to pipeline</Trans>}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
	return (
		<div className="grid gap-1.5">
			<Label className="text-muted-foreground text-xs">
				{label}
				{required && <span className="text-destructive"> *</span>}
			</Label>
			{children}
		</div>
	);
}
