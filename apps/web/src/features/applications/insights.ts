import type { ApplicationStatus } from "@reactive-resume/schema/applications/data";
import { STAGES } from "@reactive-resume/schema/applications/data";

export type StageCount = { status: ApplicationStatus; count: number };

// The forward pipeline (rejected is a terminal outcome, handled separately).
const FORWARD: ApplicationStatus[] = ["saved", "applied", "screening", "interview", "offer"];

export type Insights = {
	total: number;
	tiles: { label: string; value: string; sub: string }[];
	funnel: { label: string; color: string; count: number; reached: number; pct: number; conv: string }[];
	rejected: number;
};

// Pure function of the raw per-stage counts, so it's trivially testable and shared by every
// chart in the Insights view. "reached[i]" assumes the pipeline is monotonic for currently
// active applications (an app at Interview has passed through Screening).
export function computeInsights(byStage: StageCount[]): Insights {
	const counts = new Map<ApplicationStatus, number>(byStage.map((row) => [row.status, row.count]));
	const at = (status: ApplicationStatus) => counts.get(status) ?? 0;
	const total = byStage.reduce((sum, row) => sum + row.count, 0);
	const rejected = at("rejected");

	// reached[i] = active apps that got at least as far as FORWARD[i].
	const reached = FORWARD.map((_, i) => FORWARD.slice(i).reduce((sum, s) => sum + at(s), 0));
	const appliedOn = reached[1] ?? 0; // everything that made it past "saved"

	const funnel = FORWARD.map((status, i) => {
		const stage = STAGES.find((s) => s.value === status);
		const reachedCount = reached[i] ?? 0;
		const prev = i === 0 ? reachedCount : (reached[i - 1] ?? reachedCount);
		return {
			label: stage?.label ?? status,
			color: stage?.color ?? "var(--muted)",
			count: at(status),
			reached: reachedCount,
			pct: total > 0 ? Math.round((reachedCount / total) * 100) : 0,
			conv: prev > 0 ? `${Math.round((reachedCount / prev) * 100)}%` : "—",
		};
	});

	const interviews = at("interview") + at("offer");
	const offers = at("offer");
	const responseRate = appliedOn > 0 ? Math.round(((reached[2] ?? 0) / appliedOn) * 100) : 0;

	const tiles = [
		{ label: "Total applications", value: String(total), sub: "in this view" },
		{ label: "Applied", value: String(appliedOn), sub: "past saved" },
		{ label: "Response rate", value: `${responseRate}%`, sub: "reached screening" },
		{ label: "Interviews", value: String(interviews), sub: "interview or beyond" },
		{ label: "Offers", value: String(offers), sub: rejected > 0 ? `${rejected} rejected` : "so far" },
	];

	return { total, tiles, funnel, rejected };
}
