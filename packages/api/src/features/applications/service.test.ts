import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB layer; the logic under test is the activity-timeline bookkeeping, not SQL.
const dbMock = vi.hoisted(() => ({
	select: vi.fn(),
	insert: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("@reactive-resume/db/schema", () => ({
	application: { id: "id", userId: "user_id", status: "status", updatedAt: "updated_at" },
}));
vi.mock("drizzle-orm", () => ({ and: (...a: unknown[]) => a, desc: (x: unknown) => x, eq: (...a: unknown[]) => a }));

const { applicationService } = await import("./service");

const existing = {
	id: "app-1",
	userId: "user-1",
	company: "Stripe",
	role: "Engineer",
	status: "saved" as const,
	activity: [{ id: "e0", type: "created" as const, text: "Added to Saved", at: new Date() }],
};

beforeEach(() => {
	dbMock.select.mockReset();
	dbMock.insert.mockReset();
	dbMock.update.mockReset();
	// requireOwned: db.select().from().where() resolves to [existing]
	dbMock.select.mockReturnValue({ from: () => ({ where: () => Promise.resolve([{ ...existing }]) }) });
});

describe("applicationService.create", () => {
	it("seeds a 'created' activity event", async () => {
		const values = vi.fn(() => Promise.resolve());
		dbMock.insert.mockReturnValue({ values });

		await applicationService.create({ userId: "user-1", company: "Stripe", role: "Engineer", status: "applied" });

		const [[inserted]] = values.mock.calls as unknown as [[{ activity: { type: string }[] }]];
		expect(inserted.activity).toHaveLength(1);
		expect(inserted.activity.at(0)?.type).toBe("created");
	});
});

describe("applicationService.update", () => {
	const captureSet = () => {
		const set = vi.fn(() => ({ where: () => ({ returning: () => Promise.resolve([{ ...existing }]) }) }));
		dbMock.update.mockReturnValue({ set });
		return set;
	};

	it("appends a 'stage' event when the status changes", async () => {
		const set = captureSet();
		await applicationService.update({ id: "app-1", userId: "user-1", status: "applied" });

		const [[arg]] = set.mock.calls as unknown as [[{ activity: { type: string }[] }]];
		expect(arg.activity).toHaveLength(2);
		expect(arg.activity.at(-1)?.type).toBe("stage");
	});

	it("does not append an event when the status is unchanged", async () => {
		const set = captureSet();
		await applicationService.update({ id: "app-1", userId: "user-1", notes: "hello" });

		const [[arg]] = set.mock.calls as unknown as [[{ activity: unknown[] }]];
		expect(arg.activity).toHaveLength(1);
	});
});
