import type { ResumeData } from "@reactive-resume/schema/resume/data";
import z from "zod";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";
import { generateId, slugify } from "@reactive-resume/utils/string";
import { protectedProcedure } from "../../context";
import { resumeMutationRateLimit } from "../../middleware/rate-limit";
import { createResumePdfDownloadUrl } from "./pdf-download-url";
import { resumeService } from "./service";

export const importAndRenderResumeInputSchema = z.object({
	name: z.string().trim().min(1).describe("The dashboard name for the imported resume."),
	slug: z.string().trim().min(1).optional().describe("Optional custom slug for the imported resume."),
	tags: z.array(z.string()).optional().default([]).describe("Optional tags to attach to the imported resume."),
	data: resumeDataSchema.describe("The complete ResumeData object to save and render."),
});

export const importAndRenderResumeOutputSchema = z.object({
	id: z.string().describe("The ID of the created resume."),
	name: z.string().describe("The dashboard name of the created resume."),
	slug: z.string().describe("The slug of the created resume."),
	tags: z.array(z.string()).describe("The tags attached to the created resume."),
	pdfUrl: z.string().describe("A short-lived signed URL to download the generated resume PDF."),
	pdfUrlExpiresAt: z.string().describe("The ISO timestamp when the signed PDF URL expires."),
	pdfUrlExpiresInSeconds: z.number().describe("The number of seconds before the signed PDF URL expires."),
});

type ImportAndRenderResumeInput = z.infer<typeof importAndRenderResumeInputSchema>;

type ImportAndRenderResumeHandlerInput = ImportAndRenderResumeInput & {
	locale: Parameters<typeof resumeService.create>[0]["locale"];
	userId: string;
};

function resolveSlug(input: Pick<ImportAndRenderResumeInput, "name" | "slug">) {
	if (input.slug) return input.slug;

	const baseSlug = slugify(input.name);
	const suffix = generateId().slice(0, 6);

	return `${baseSlug}-${suffix}`;
}

export async function importAndRenderResume(input: ImportAndRenderResumeHandlerInput) {
	const slug = resolveSlug(input);

	const id = await resumeService.create({
		userId: input.userId,
		name: input.name,
		slug,
		tags: input.tags,
		locale: input.locale,
		data: input.data as ResumeData,
	});

	// FORK NOTE: agent-facing API imports are versioned like manual JSON imports so dashboard history stays useful.
	await resumeService.versions.snapshot({
		resumeId: id,
		userId: input.userId,
		data: input.data as ResumeData,
		label: "Imported by API",
	});

	const signedUrl = createResumePdfDownloadUrl({ resumeId: id, userId: input.userId });

	return {
		id,
		name: input.name,
		slug,
		tags: input.tags,
		pdfUrl: signedUrl.url,
		pdfUrlExpiresAt: signedUrl.expiresAt,
		pdfUrlExpiresInSeconds: signedUrl.expiresInSeconds,
	};
}

export const importAndRenderResumeProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/resumes/import-and-render",
		tags: ["Resumes"],
		operationId: "importAndRenderResume",
		summary: "Import resume data and return a PDF download URL",
		description:
			"Creates a new resume from a complete ResumeData object in the authenticated user's account, then returns a short-lived signed PDF download URL. Intended for agent/API workflows. Requires authentication.",
		successDescription: "The resume was created and a signed PDF URL was returned.",
	})
	.input(importAndRenderResumeInputSchema)
	.use(resumeMutationRateLimit)
	.output(importAndRenderResumeOutputSchema)
	.errors({
		RESUME_SLUG_ALREADY_EXISTS: {
			message: "A resume with this slug already exists.",
			status: 400,
		},
	})
	.handler(async ({ context, input }) => {
		return importAndRenderResume({
			...input,
			userId: context.user.id,
			locale: context.locale,
		});
	});
