import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultResumeData } from "@reactive-resume/schema/resume/default";

const mocks = vi.hoisted(() => ({
	createResumePdfDownloadUrl: vi.fn(),
	generateId: vi.fn(() => "abcdef00-0000-7000-8000-000000000000"),
	resumeMutationRateLimit: vi.fn(),
	resumeService: {
		create: vi.fn(),
		versions: {
			snapshot: vi.fn(),
		},
	},
}));

vi.mock("@reactive-resume/utils/string", async () => {
	const actual = await vi.importActual<typeof import("@reactive-resume/utils/string")>("@reactive-resume/utils/string");
	return { ...actual, generateId: mocks.generateId };
});

vi.mock("../../context", () => {
	const chain = {
		route: vi.fn(() => chain),
		input: vi.fn(() => chain),
		use: vi.fn(() => chain),
		output: vi.fn(() => chain),
		errors: vi.fn(() => chain),
		handler: vi.fn(() => chain),
	};

	return { protectedProcedure: chain };
});

vi.mock("../../middleware/rate-limit", () => ({ resumeMutationRateLimit: mocks.resumeMutationRateLimit }));
vi.mock("./pdf-download-url", () => ({ createResumePdfDownloadUrl: mocks.createResumePdfDownloadUrl }));
vi.mock("./service", () => ({ resumeService: mocks.resumeService }));

const { importAndRenderResume, importAndRenderResumeInputSchema, importAndRenderResumeProcedure } = await import(
	"./import-and-render"
);

describe("importAndRenderResume", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resumeService.create.mockResolvedValue("resume-1");
		mocks.createResumePdfDownloadUrl.mockReturnValue({
			url: "https://example.com/api/resumes/resume-1/pdf?token=signed",
			expiresAt: "2026-06-01T10:10:00.000Z",
			expiresInSeconds: 600,
		});
	});

	it("creates a resume for the authenticated user and returns a signed PDF URL", async () => {
		const result = await importAndRenderResume({
			userId: "user-1",
			locale: "en-US",
			name: "Backend CV",
			slug: "backend-cv",
			tags: ["agent", "backend"],
			data: defaultResumeData,
		});

		expect(mocks.resumeService.create).toHaveBeenCalledWith({
			userId: "user-1",
			name: "Backend CV",
			slug: "backend-cv",
			tags: ["agent", "backend"],
			locale: "en-US",
			data: defaultResumeData,
		});
		expect(mocks.resumeService.versions.snapshot).toHaveBeenCalledWith({
			resumeId: "resume-1",
			userId: "user-1",
			data: defaultResumeData,
			label: "Imported by API",
		});
		expect(mocks.createResumePdfDownloadUrl).toHaveBeenCalledWith({ resumeId: "resume-1", userId: "user-1" });
		expect(result).toEqual({
			id: "resume-1",
			name: "Backend CV",
			slug: "backend-cv",
			tags: ["agent", "backend"],
			pdfUrl: "https://example.com/api/resumes/resume-1/pdf?token=signed",
			pdfUrlExpiresAt: "2026-06-01T10:10:00.000Z",
			pdfUrlExpiresInSeconds: 600,
		});
		expect(new URL(result.pdfUrl).pathname).toBe("/api/resumes/resume-1/pdf");
		expect(new URL(result.pdfUrl).searchParams.get("token")).toBe("signed");
	});

	it("generates a non-empty slug with a suffix when no slug is provided", async () => {
		const result = await importAndRenderResume({
			userId: "user-1",
			locale: "en-US",
			name: "Backend CV",
			tags: [],
			data: defaultResumeData,
		});

		expect(result.slug).toBe("backend-cv-abcdef");
		expect(mocks.resumeService.create).toHaveBeenCalledWith(expect.objectContaining({ slug: "backend-cv-abcdef" }));
	});

	it("keeps duplicate-slug errors from the resume service", async () => {
		const error = Object.assign(new Error("duplicate"), { code: "RESUME_SLUG_ALREADY_EXISTS" });
		mocks.resumeService.create.mockRejectedValueOnce(error);

		await expect(
			importAndRenderResume({
				userId: "user-1",
				locale: "en-US",
				name: "Backend CV",
				slug: "backend-cv",
				tags: [],
				data: defaultResumeData,
			}),
		).rejects.toBe(error);
		expect(mocks.createResumePdfDownloadUrl).not.toHaveBeenCalled();
	});
});

describe("importAndRenderResumeInputSchema", () => {
	it("defaults tags and validates resume data", () => {
		const parsed = importAndRenderResumeInputSchema.parse({
			name: "Backend CV",
			data: defaultResumeData,
		});

		expect(parsed.tags).toEqual([]);
	});

	it("rejects invalid resume data", () => {
		expect(() => importAndRenderResumeInputSchema.parse({ name: "Backend CV", data: { basics: {} } })).toThrow();
	});
});

describe("importAndRenderResumeProcedure", () => {
	it("is exported for the resume router", () => {
		expect(importAndRenderResumeProcedure).toBeTruthy();
	});
});
