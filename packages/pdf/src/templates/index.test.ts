import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("templatePages", () => {
	it("registers Scizor as a renderable template page", () => {
		const registry = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");

		expect(registry).toContain('import { ScizorPage } from "./scizor/ScizorPage";');
		expect(registry).toContain("scizor: ScizorPage");
	});

	it("keeps rich-text list content at the body line height", () => {
		const templatesDir = fileURLToPath(new URL(".", import.meta.url));
		const pageFiles = readdirSync(templatesDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map(
				(entry) =>
					new URL(`./${entry.name}/${entry.name[0]?.toUpperCase()}${entry.name.slice(1)}Page.tsx`, import.meta.url),
			)
			.map((url) => fileURLToPath(url))
			.filter((path) => existsSync(path));

		for (const pageFile of pageFiles) {
			const template = readFileSync(pageFile, "utf8");

			expect(template).not.toContain("lineHeight: metadata.typography.body.lineHeight * 0.5");
		}
	});
});
