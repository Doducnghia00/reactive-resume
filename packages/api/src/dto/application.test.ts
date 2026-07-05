import { describe, expect, it } from "vitest";
import { applicationDto } from "./application";

describe("applicationDto sourceUrl", () => {
	it("accepts http(s) URLs", () => {
		expect(
			applicationDto.create.input.parse({
				company: "Stripe",
				role: "Engineer",
				sourceUrl: "https://example.com/job",
			}).sourceUrl,
		).toBe("https://example.com/job");
	});

	it("rejects URLs that would be unsafe in anchors", () => {
		expect(() =>
			applicationDto.create.input.parse({
				company: "Stripe",
				role: "Engineer",
				sourceUrl: "javascript:alert(1)",
			}),
		).toThrow();
	});
});

describe("applicationDto jobDescription", () => {
	it("rejects oversized descriptions before AI actions can use them", () => {
		expect(() =>
			applicationDto.create.input.parse({
				company: "Stripe",
				role: "Engineer",
				jobDescription: "x".repeat(20_001),
			}),
		).toThrow();
	});
});
