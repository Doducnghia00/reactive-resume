# Agent import-and-render API

FORK NOTE: Adds an authenticated `POST /resumes/import-and-render` resume procedure for agent/API workflows.

## Purpose

Use this endpoint when an external agent already knows how to produce Reactive Resume `ResumeData`.
The server does not parse markdown, infer fields, or do stateless rendering. It only validates the submitted
`ResumeData`, stores it as a new resume under the account resolved from `x-api-key`, and returns a short-lived
PDF download URL.

## Endpoint

When using OpenAPI over HTTP:

```http
POST /api/openapi/resumes/import-and-render
x-api-key: <account api key>
content-type: application/json
```

The same procedure is exposed in oRPC as:

```ts
resume.importAndRender
```

## Request body

```ts
{
  name: string;
  slug?: string;
  tags?: string[];
  data: ResumeData;
}
```

- `name`: Required. The dashboard name for the saved resume.
- `slug`: Optional. If provided, it is used exactly and must be unique for the authenticated account. If omitted, the server slugifies `name` and appends a short suffix.
- `tags`: Optional. Defaults to `[]`. Agents may send values like `["agent"]` or `["agent", "backend"]` for filtering in the dashboard.
- `data`: Required. A complete Reactive Resume `ResumeData` object.

## ResumeData requirements

Agents should build `data` from the current schema, not from this doc alone. Sources of truth:

- Runtime JSON schema: `GET /schema.json`
- OpenAPI schema: `GET /api/openapi/spec.json`
- Source schema: `packages/schema/src/resume/data.ts`
- Default shape example: `packages/schema/src/resume/default.ts`

Top-level `ResumeData` fields:

```ts
{
  picture: Picture;
  basics: Basics;
  summary: Summary;
  sections: Sections;
  customSections: CustomSection[];
  metadata: Metadata;
}
```

The selected template is set in:

```ts
data.metadata.template
```

Allowed template values:

```ts
"azurill" | "bronzor" | "chikorita" | "ditgar" | "ditto" |
"gengar" | "glalie" | "kakuna" | "lapras" | "leafish" |
"meowth" | "onyx" | "pikachu" | "rhyhorn" | "scizor"
```

## Minimal request example

This is intentionally small. Real agents should fill useful sections and layout.

```json
{
  "name": "Backend Software Engineer CV",
  "slug": "backend-software-engineer-cv",
  "tags": ["agent", "backend"],
  "data": {
    "picture": {
      "hidden": true,
      "url": "",
      "size": 80,
      "rotation": 0,
      "aspectRatio": 1,
      "borderRadius": 0,
      "borderColor": "rgba(0, 0, 0, 0.5)",
      "borderWidth": 0,
      "shadowColor": "rgba(0, 0, 0, 0.5)",
      "shadowWidth": 0
    },
    "basics": {
      "name": "Do Duc Nghia",
      "headline": "Backend / Software Engineer",
      "email": "nghia@example.com",
      "phone": "",
      "location": "Ha Noi, Viet Nam",
      "website": { "url": "", "label": "" },
      "customFields": []
    },
    "summary": {
      "title": "Summary",
      "icon": "article",
      "columns": 1,
      "hidden": false,
      "keepTogether": false,
      "startOnNewPage": false,
      "content": "<p>Backend engineer with experience building Python, Django, FastAPI, and database-backed systems.</p>"
    },
    "sections": {
      "profiles": { "title": "Profiles", "icon": "messenger-logo", "columns": 1, "hidden": false, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "experience": { "title": "Experience", "icon": "briefcase", "columns": 1, "hidden": false, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "education": { "title": "Education", "icon": "graduation-cap", "columns": 1, "hidden": false, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "projects": { "title": "Projects", "icon": "code-simple", "columns": 1, "hidden": false, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "skills": { "title": "Skills", "icon": "compass-tool", "columns": 1, "hidden": false, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "languages": { "title": "Languages", "icon": "translate", "columns": 1, "hidden": false, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "interests": { "title": "Interests", "icon": "football", "columns": 1, "hidden": true, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "awards": { "title": "Awards", "icon": "trophy", "columns": 1, "hidden": true, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "certifications": { "title": "Certifications", "icon": "certificate", "columns": 1, "hidden": true, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "publications": { "title": "Publications", "icon": "books", "columns": 1, "hidden": true, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "volunteer": { "title": "Volunteer", "icon": "hand-heart", "columns": 1, "hidden": true, "keepTogether": false, "startOnNewPage": false, "items": [] },
      "references": { "title": "References", "icon": "phone", "columns": 1, "hidden": true, "keepTogether": false, "startOnNewPage": false, "items": [] }
    },
    "customSections": [],
    "metadata": {
      "template": "onyx",
      "layout": {
        "sidebarWidth": 35,
        "pages": [
          {
            "fullWidth": false,
            "main": ["summary", "experience", "projects", "education"],
            "sidebar": ["skills", "profiles", "languages"]
          }
        ]
      },
      "page": {
        "gapX": 4,
        "gapY": 6,
        "marginX": 14,
        "marginY": 12,
        "format": "a4",
        "locale": "vi-VN",
        "hideLinkUnderline": false,
        "hideIcons": false,
        "hideSectionIcons": true
      },
      "design": {
        "colors": {
          "primary": "rgba(220, 38, 38, 1)",
          "text": "rgba(0, 0, 0, 1)",
          "background": "rgba(255, 255, 255, 1)"
        },
        "level": { "icon": "star", "type": "circle" }
      },
      "typography": {
        "body": { "fontFamily": "IBM Plex Serif", "fontWeights": ["400", "500"], "fontSize": 10, "lineHeight": 1.5 },
        "heading": { "fontFamily": "IBM Plex Serif", "fontWeights": ["600"], "fontSize": 14, "lineHeight": 1.5 }
      },
      "notes": "",
      "styleRules": []
    }
  }
}
```

## Response body

```ts
{
  id: string;
  name: string;
  slug: string;
  tags: string[];
  pdfUrl: string;
  pdfUrlExpiresAt: string;
  pdfUrlExpiresInSeconds: number;
}
```

Example:

```json
{
  "id": "018f0000-0000-7000-8000-000000000000",
  "name": "Backend Software Engineer CV",
  "slug": "backend-software-engineer-cv",
  "tags": ["agent", "backend"],
  "pdfUrl": "https://example.com/api/resumes/018f0000-0000-7000-8000-000000000000/pdf?token=...",
  "pdfUrlExpiresAt": "2026-06-01T10:10:00.000Z",
  "pdfUrlExpiresInSeconds": 600
}
```

Download the PDF with:

```http
GET <pdfUrl>
```

The signed URL currently expires after at most 10 minutes. If it expires, call `import-and-render` again or use the saved
resume ID with the normal authenticated PDF download endpoint.

## Behavior and errors

- Authentication uses the existing account API key: `x-api-key`.
- The endpoint always creates a new resume in v1. It does not update or upsert existing resumes.
- If `slug` is provided and already exists for the account, the request fails with `RESUME_SLUG_ALREADY_EXISTS`.
- Invalid or incomplete `ResumeData` fails schema validation and no resume is created.
- Missing or invalid authentication fails with `UNAUTHORIZED`.
- Created resumes receive a version snapshot labeled `Imported by API` so dashboard history distinguishes API imports from manual edits.
