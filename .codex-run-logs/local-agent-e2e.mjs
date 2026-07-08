import fs from "node:fs";
import path from "node:path";

const base = "http://localhost:3000";
const mdPath = "C:/Code/ddn-career-workspace/applications/cv-backend-software-engineer.md";
const outDir = "C:/Code/reactive-resume/.codex-run-logs";
const md = fs.readFileSync(mdPath, "utf8");

function collectSetCookie(headers) {
	const raw = headers.get("set-cookie");
	if (!raw) return "";
	return raw
		.split(/,(?=\s*[^;=]+=[^;]+)/)
		.map((cookie) => cookie.split(";")[0].trim())
		.join("; ");
}

function stripMd(value) {
	return String(value || "")
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/\[(.*?)\]\((.*?)\)/g, "$1")
		.replace(/^[-*]\s+/gm, "")
		.trim();
}

function escapeHtml(value) {
	return String(value || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
}

function inlineMdToHtml(value) {
	return escapeHtml(stripMd(value)).replace(/\n/g, "<br />");
}

function blocksToHtml(value) {
	return String(value || "")
		.trim()
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean)
		.map((block) => {
			const lines = block.split(/\r?\n/);
			if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
				const items = lines
					.map((line) => inlineMdToHtml(line.replace(/^\s*[-*]\s+/, "")))
					.filter((line) => line.length > 0);

				if (items.length === 0) return "";

				return `<ul>${items.map((line) => `<li>${line}</li>`).join("")}</ul>`;
			}

			return `<p>${inlineMdToHtml(block)}</p>`;
		})
		.filter(Boolean)
		.join("");
}

function sectionBase(title, icon, items = [], hidden = false) {
	return { title, icon, columns: 1, hidden, keepTogether: false, startOnNewPage: false, items };
}

function itemId(prefix, index) {
	return `${prefix}-${index + 1}`;
}

function splitHeadingSections(levelMarker) {
	const regex = new RegExp(`^${levelMarker}\\s+(.+?)\\s*$`, "gm");
	const matches = [...md.matchAll(regex)];
	return matches.map((match, index) => {
		const start = match.index + match[0].length;
		const end = matches[index + 1]?.index ?? md.length;
		return { title: stripMd(match[1]), body: md.slice(start, end).trim() };
	});
}

function splitSubsections(body) {
	const regex = /^###\s+(.+?)\s*$/gm;
	const matches = [...body.matchAll(regex)];
	return matches.map((match, index) => {
		const start = match.index + match[0].length;
		const end = matches[index + 1]?.index ?? body.length;
		return { title: stripMd(match[1]), body: body.slice(start, end).trim() };
	});
}

function parseBoldLines(body) {
	return [...body.matchAll(/\*\*(.*?)\*\*/g)].map((match) => stripMd(match[1]));
}

function withoutLine(body, needle) {
	if (!needle) return body;
	return body
		.split(/\r?\n/)
		.filter((line) => line.trim() !== needle.trim())
		.join("\n")
		.trim();
}

function withoutMatchingLines(body, pattern) {
	return body
		.split(/\r?\n/)
		.filter((line) => !pattern.test(line.trim()))
		.join("\n")
		.trim();
}

function splitRoleTitle(title) {
	const parts = title.split(/\s+\u2014\s+|\s+-\s+/u);
	if (parts.length >= 2) return { position: stripMd(parts[0]), company: stripMd(parts.slice(1).join(" - ")) };
	return { position: stripMd(title), company: "N/A" };
}

function parseTechnicalSkillGroups(body) {
	const labelMap = new Map([
		["Cơ sở dữ liệu", "Database"],
		["Triển khai", "Triển khai & vận hành"],
		["Phối hợp & quy trình", "Quy trình & công cụ"],
		["Stack phụ", "Frontend collaboration"],
	]);

	return body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^-\s+\*\*.+?:\*\*/.test(line))
		.map((line, index) => {
			const match = line.match(/^-\s+\*\*(.+?):\*\*\s*(.+)$/);
			const rawName = stripMd(match?.[1] ?? "");
			const name = labelMap.get(rawName) ?? rawName;
			const proficiency = stripMd(match?.[2] ?? "");

			return {
				id: itemId("skill", index),
				hidden: false,
				icon: "",
				iconColor: "",
				name,
				proficiency,
				level: 0,
				keywords: [],
			};
		});
}

function buildResumeData() {
	const lines = md.split(/\r?\n/);
	const name = stripMd(lines.find((line) => line.startsWith("# "))?.replace(/^#\s+/, ""));
	const headline = stripMd(lines.find((line) => /^\*\*.*\*\*$/.test(line)) || "");
	const contactBullets = lines
		.filter((line) => /^-\s+/.test(line))
		.slice(0, 5)
		.map(stripMd);
	const [location = "", email = "", phone = "", linkedin = "", github = ""] = contactBullets.map((line) =>
		line.replace(/^.+?:\s*/, ""),
	);

	const h2 = splitHeadingSections("##");
	const summarySection = h2[0] ?? { title: "Summary", body: "" };
	const coreSkillsSection = h2[1] ?? { title: "Core Skills", body: "" };
	const experienceSection = h2[2] ?? { title: "Experience", body: "" };
	const projectsSection = h2[3] ?? { title: "Projects", body: "" };
	const educationSection = h2[4] ?? { title: "Education", body: "" };
	const technicalSkillsSection = h2[5] ?? { title: "Skills", body: "" };

	const profileItems = [linkedin, github]
		.filter((value) => value && !value.startsWith("["))
		.map((value, index) => ({
			id: itemId("profile", index),
			hidden: false,
			icon: "",
			iconColor: "",
			network: index === 0 ? "LinkedIn" : "GitHub",
			username: value,
			website: { url: "", label: "", inlineLink: false },
		}));

	const experienceItems = splitSubsections(experienceSection.body).map((entry, index) => {
		const { position, company } = splitRoleTitle(entry.title);
		const period = parseBoldLines(entry.body)[0] || "";
		const description = withoutLine(entry.body, period ? `**${period}**` : "");

		return {
			id: itemId("experience", index),
			hidden: false,
			company,
			position,
			location: "",
			period,
			website: { url: "", label: "", inlineLink: false },
			description: blocksToHtml(description),
			roles: [],
		};
	});

	const projectItems = splitSubsections(projectsSection.body).map((entry, index) => {
		const cleanStack = stripMd(entry.body.match(/^\*\*Stack:\*\*\s*(.+)$/im)?.[1] ?? "");
		const description = withoutMatchingLines(entry.body, /^\*\*Stack:\*\*/i);

		return {
			id: itemId("project", index),
			hidden: false,
			name: entry.title,
			period: "",
			website: { url: "", label: "", inlineLink: false },
			description: blocksToHtml([cleanStack ? `Stack: ${cleanStack}` : "", description].filter(Boolean).join("\n\n")),
		};
	});

	const educationItems = splitSubsections(educationSection.body).map((entry, index) => {
		const bold = parseBoldLines(entry.body);
		return {
			id: itemId("education", index),
			hidden: false,
			school: entry.title,
			degree: bold[0] || "",
			area: "",
			grade: "",
			location: "",
			period: bold[1] || "",
			website: { url: "", label: "", inlineLink: false },
			description: "",
		};
	});

	const skillItems = parseTechnicalSkillGroups(technicalSkillsSection.body);

	return {
		data: {
			picture: {
				hidden: true,
				url: "",
				size: 80,
				rotation: 0,
				aspectRatio: 1,
				borderRadius: 0,
				borderColor: "rgba(0, 0, 0, 0.5)",
				borderWidth: 0,
				shadowColor: "rgba(0, 0, 0, 0.5)",
				shadowWidth: 0,
			},
			basics: {
				name,
				headline,
				email: email.startsWith("[") ? "" : email,
				phone: phone.startsWith("[") ? "" : phone,
				location,
				website: { url: "", label: "" },
				customFields: [],
			},
			summary: {
				title: summarySection.title,
				icon: "article",
				columns: 1,
				hidden: false,
				keepTogether: false,
				startOnNewPage: false,
				content: blocksToHtml(summarySection.body),
			},
			sections: {
				profiles: sectionBase("Profiles", "messenger-logo", profileItems, profileItems.length === 0),
				experience: sectionBase(experienceSection.title, "briefcase", experienceItems),
				education: sectionBase(educationSection.title, "graduation-cap", educationItems),
				projects: sectionBase(projectsSection.title, "code-simple", projectItems),
				skills: sectionBase(technicalSkillsSection.title, "compass-tool", skillItems),
				languages: sectionBase("Languages", "translate", [], true),
				interests: sectionBase("Interests", "football", [], true),
				awards: sectionBase("Awards", "trophy", [], true),
				certifications: sectionBase("Certifications", "certificate", [], true),
				publications: sectionBase("Publications", "books", [], true),
				volunteer: sectionBase("Volunteer", "hand-heart", [], true),
				references: sectionBase("References", "phone", [], true),
			},
			customSections: [],
			metadata: {
				template: "onyx",
				layout: {
					sidebarWidth: 35,
					pages: [{ fullWidth: false, main: ["summary", "experience", "projects", "education"], sidebar: ["skills"] }],
				},
				page: {
					gapX: 4,
					gapY: 6,
					marginX: 14,
					marginY: 12,
					format: "a4",
					locale: "vi-VN",
					hideLinkUnderline: false,
					hideIcons: true,
					hideSectionIcons: true,
				},
				design: {
					colors: {
						primary: "rgba(220, 38, 38, 1)",
						text: "rgba(0, 0, 0, 1)",
						background: "rgba(255, 255, 255, 1)",
					},
					level: { icon: "star", type: "circle" },
				},
				typography: {
					body: { fontFamily: "IBM Plex Serif", fontWeights: ["400", "500"], fontSize: 10, lineHeight: 1.5 },
					heading: { fontFamily: "IBM Plex Serif", fontWeights: ["600"], fontSize: 14, lineHeight: 1.5 },
				},
				notes: "",
				styleRules: [],
			},
		},
		counts: {
			summaryChars: blocksToHtml(summarySection.body).length,
			experienceItems: experienceItems.length,
			projectItems: projectItems.length,
			educationItems: educationItems.length,
			skillItems: skillItems.length,
		},
	};
}

async function main() {
	const stamp = Date.now();
	const username = `codextest${stamp}`;
	const signup = await fetch(`${base}/api/auth/sign-up/email`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: base },
		body: JSON.stringify({
			name: "Codex Local Test",
			email: `${username}@example.com`,
			password: "CodexTest12345!",
			username,
			displayUsername: username,
			callbackURL: "/dashboard",
		}),
	});
	const signupText = await signup.text();
	const cookie = collectSetCookie(signup.headers);
	console.log(JSON.stringify({ step: "signup", status: signup.status, cookie: Boolean(cookie), body: signupText.slice(0, 120) }));
	if (!signup.ok || !cookie) process.exit(1);

	const keyRes = await fetch(`${base}/api/auth/api-key/create`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: base, cookie },
		body: JSON.stringify({ name: "codex-local-agent-test", expiresIn: 3600 * 24 * 30 }),
	});
	const keyText = await keyRes.text();
	console.log(JSON.stringify({ step: "api-key-create", status: keyRes.status, body: keyText.slice(0, 120) }));
	if (!keyRes.ok) process.exit(2);
	const apiKey = JSON.parse(keyText).key;

	const { data, counts } = buildResumeData();
	console.log(JSON.stringify({ step: "payload-summary", name: data.basics.name, summaryTitle: data.summary.title, ...counts }));

	const importRes = await fetch(`${base}/api/openapi/resumes/import-and-render`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-api-key": apiKey },
		body: JSON.stringify({ name: `Local Agent CV ${new Date().toISOString()}`, tags: ["agent-local-test"], data }),
	});
	const importText = await importRes.text();
	console.log(JSON.stringify({ step: "import-and-render", status: importRes.status, body: importText.slice(0, 500) }));
	if (!importRes.ok) process.exit(3);
	const imported = JSON.parse(importText);

	const pdfRes = await fetch(imported.pdfUrl);
	const bytes = Buffer.from(await pdfRes.arrayBuffer());
	const pdfPath = path.join(outDir, `local-agent-cv-${imported.id}.pdf`);
	fs.writeFileSync(pdfPath, bytes);
	console.log(
		JSON.stringify({
			step: "pdf-download",
			status: pdfRes.status,
			contentType: pdfRes.headers.get("content-type"),
			firstBytes: bytes.subarray(0, 16).toString("latin1"),
			pdfPath,
			resumeId: imported.id,
			pdfUrl: imported.pdfUrl,
		}),
	);
	if (!pdfRes.ok || !bytes.subarray(0, 4).toString("latin1").startsWith("%PDF")) process.exit(4);
}

await main();
