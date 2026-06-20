import { createSampleResumeFromDashboard, openSidebarSection } from "../fixtures/resume";
import { expect, test } from "../fixtures/test";

test("publishes a resume and renders it for an anonymous visitor", async ({ browser, authPage: page }, testInfo) => {
	await createSampleResumeFromDashboard(page, testInfo);
	await openSidebarSection(page, "Sharing", "right");

	await page.getByRole("switch", { name: /Allow Public Access/ }).click();
	const publicUrl = await page.locator("#sharing-url").inputValue();
	expect(publicUrl).toMatch(/\/e2e_/);

	const anonymous = await browser.newPage();
	await anonymous.goto(publicUrl);
	await expect(anonymous.getByRole("button", { name: "Download PDF" })).toBeVisible();
	await anonymous.close();
});
