import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import { orpc } from "@/libs/orpc/client";
import { computeInsights } from "../insights";

type Props = { campaign?: string };

export function ApplicationInsights({ campaign }: Props) {
	const { data } = useQuery(orpc.applications.stats.queryOptions({ input: campaign ? { campaign } : {} }));

	if (!data) return <div className="h-40 animate-pulse rounded-xl bg-muted/40" />;

	const insights = computeInsights(data.byStage);
	const maxSource = Math.max(1, ...data.bySource.map((s) => s.count));

	if (insights.total === 0) {
		return (
			<p className="py-16 text-center text-muted-foreground text-sm">
				<Trans>No applications yet — add a few to see your funnel and reply rates.</Trans>
			</p>
		);
	}

	return (
		<div className="flex max-w-4xl flex-col gap-4 overflow-y-auto pb-6">
			<p className="text-muted-foreground text-xs">
				{campaign ? (
					<Trans>Pipeline health for campaign “{campaign}”</Trans>
				) : (
					<Trans>Pipeline health across all applications</Trans>
				)}
			</p>

			{/* stat tiles */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
				{insights.tiles.map((tile) => (
					<div key={tile.label} className="rounded-xl border border-border p-4">
						<div className="text-muted-foreground text-xs">{tile.label}</div>
						<div className="mt-2 font-bold text-2xl tracking-tight">{tile.value}</div>
						<div className="mt-1 text-muted-foreground text-xs">{tile.sub}</div>
					</div>
				))}
			</div>

			<PipelineFlow insights={insights} />

			<div className="grid gap-4 lg:grid-cols-2">
				{/* funnel */}
				<div className="rounded-xl border border-border p-5">
					<h3 className="font-semibold text-sm">
						<Trans>Pipeline funnel</Trans>
					</h3>
					<p className="mt-0.5 text-muted-foreground text-xs">
						<Trans>How far applications get, and stage-to-stage conversion</Trans>
					</p>
					<div className="mt-4 flex flex-col gap-3.5">
						{insights.funnel.map((stage) => (
							<div key={stage.label}>
								<div className="mb-1.5 flex items-center justify-between text-xs">
									<span className="flex items-center gap-2 font-medium">
										<span className="size-2 rounded-sm" style={{ background: stage.color }} />
										{stage.label}
									</span>
									<span className="text-muted-foreground">
										<b className="text-foreground">{stage.reached}</b> · {stage.conv}
									</span>
								</div>
								<div className="h-2.5 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full"
										style={{ width: `${Math.max(stage.pct, 2)}%`, background: stage.color }}
									/>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* sources */}
				<div className="rounded-xl border border-border p-5">
					<h3 className="font-semibold text-sm">
						<Trans>Where applications come from</Trans>
					</h3>
					<p className="mt-0.5 text-muted-foreground text-xs">
						<Trans>Count by source</Trans>
					</p>
					<div className="mt-4 flex flex-col gap-3">
						{data.bySource.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								<Trans>No source data yet.</Trans>
							</p>
						) : (
							data.bySource.map((row) => (
								<div key={row.source} className="flex items-center gap-3 text-xs">
									<span className="w-28 shrink-0 truncate font-medium">{row.source}</span>
									<div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-foreground/70"
											style={{ width: `${Math.max((row.count / maxSource) * 100, 3)}%` }}
										/>
									</div>
									<span className="w-6 text-right text-muted-foreground">{row.count}</span>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

// A funnel-flow diagram (the shareable snapshot). Hand-drawn SVG with inline fills so it can be
// exported to PNG without any library.
function PipelineFlow({ insights }: { insights: ReturnType<typeof computeInsights> }) {
	const svgRef = useRef<SVGSVGElement>(null);
	const W = 720;
	const H = 220;
	const maxBarH = 150;
	const barW = 30;
	const n = insights.funnel.length;
	const slotW = W / n;
	const maxReached = Math.max(1, ...insights.funnel.map((f) => f.reached));

	const bars = insights.funnel.map((f, i) => {
		const h = Math.max((f.reached / maxReached) * maxBarH, 3);
		const x = slotW * i + slotW / 2 - barW / 2;
		const yTop = 30 + (maxBarH - h) / 2;
		return { ...f, x, yTop, h, cx: x + barW / 2 };
	});

	const exportPng = () => {
		const svg = svgRef.current;
		if (!svg) return;
		const xml = new XMLSerializer().serializeToString(svg);
		const svg64 = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...new TextEncoder().encode(xml)))}`;
		const image = new Image();
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = W * 2;
			canvas.height = H * 2;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			const link = document.createElement("a");
			link.download = "pipeline-flow.png";
			link.href = canvas.toDataURL("image/png");
			link.click();
			toast.success(t`Exported pipeline-flow.png`);
		};
		image.src = svg64;
	};

	return (
		<div className="rounded-xl border border-border p-5">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h3 className="font-semibold text-sm">
						<Trans>Where your applications went</Trans>
					</h3>
					<p className="mt-0.5 text-muted-foreground text-xs">
						<Trans>Full-funnel snapshot — a shareable picture of the whole search</Trans>
					</p>
				</div>
				<Button size="sm" variant="outline" onClick={exportPng}>
					<DownloadSimpleIcon />
					<Trans>Export PNG</Trans>
				</Button>
			</div>

			<svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={t`Pipeline flow`}>
				{/* connecting bands */}
				{bars.slice(0, -1).map((bar, i) => {
					const next = bars[i + 1];
					if (!next) return null;
					const x1 = bar.x + barW;
					const x2 = next.x;
					return (
						<path
							key={`band-${bar.label}`}
							d={`M${x1},${bar.yTop} C${(x1 + x2) / 2},${bar.yTop} ${(x1 + x2) / 2},${next.yTop} ${x2},${next.yTop} L${x2},${next.yTop + next.h} C${(x1 + x2) / 2},${next.yTop + next.h} ${(x1 + x2) / 2},${bar.yTop + bar.h} ${x1},${bar.yTop + bar.h} Z`}
							fill={next.color}
							opacity={0.18}
						/>
					);
				})}
				{/* bars + labels */}
				{bars.map((bar) => (
					<g key={`bar-${bar.label}`}>
						<rect x={bar.x} y={bar.yTop} width={barW} height={bar.h} rx={5} fill={bar.color} />
						<text x={bar.cx} y={bar.yTop - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#333">
							{bar.reached}
						</text>
						<text x={bar.cx} y={H - 22} textAnchor="middle" fontSize={11} fill="#888">
							{bar.label}
						</text>
					</g>
				))}
				{insights.rejected > 0 && (
					<text x={W - 8} y={18} textAnchor="end" fontSize={11} fill="#c0392b">
						{insights.rejected} rejected
					</text>
				)}
			</svg>
		</div>
	);
}
