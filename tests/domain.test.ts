import assert from "node:assert/strict";
import test from "node:test";
import { demoEvents } from "../database/seed";
import {
  DomainError,
  cancelEvent,
  cancelRegistration,
  createEvent,
  getPublicEvent,
  isFresh,
  listEvents,
  registerForEvent,
  resetDemoStoreForTests,
  reviewEvent,
  updateEvent,
} from "../database/repository";
import type { EventRecord, SessionUser } from "../database/types";

const organizer: SessionUser = { id: "demo-organizer", name: "Demo Organizer", email: "organizer@example.test", role: "organizer" };
const otherOrganizer: SessionUser = { id: "other-organizer", name: "Other Organizer", email: "other@example.test", role: "organizer" };
const admin: SessionUser = { id: "admin", name: "Admin", email: "admin@example.test", role: "admin" };

function eventInput(title: string, capacity = 2) {
  return {
    title,
    description: "A focused test event description.",
    overview: "A focused test event overview.",
    image: "/images/event1.png",
    venue: "Test venue",
    location: "Online",
    startsAt: "2027-01-10T10:00:00.000Z",
    endsAt: "2027-01-10T12:00:00.000Z",
    timezone: "UTC",
    mode: "online" as const,
    audience: "Developers",
    topics: ["Testing"],
    capacity,
    speakers: [],
    schedule: [{ time: "10:00", title: "Start" }],
    recordings: [],
  };
}

test.beforeEach(() => resetDemoStoreForTests());

test("organizer ownership prevents another organizer from changing an event", () => {
  const event = createEvent(organizer, eventInput("Owned event"), new Date("2026-09-01T00:00:00Z"));
  assert.throws(
    () => updateEvent(otherOrganizer, event.slug, { title: "Hijacked" }),
    (error: unknown) => error instanceof DomainError && error.status === 403,
  );
  assert.equal(updateEvent(admin, event.slug, { title: "Admin correction" }).title, "Admin correction");
});

test("moderation hides pending events and publishes only after admin approval", () => {
  const event = createEvent(organizer, eventInput("Moderated event"), new Date("2026-09-01T00:00:00Z"));
  assert.equal(getPublicEvent(event.slug, new Date("2026-09-02T00:00:00Z")), null);
  assert.throws(() => reviewEvent(organizer, event.slug, "approved"), (error: unknown) => error instanceof DomainError && error.status === 403);
  reviewEvent(admin, event.slug, "approved", new Date("2026-09-02T00:00:00Z"));
  assert.equal(getPublicEvent(event.slug, new Date("2026-09-03T00:00:00Z"))?.title, "Moderated event");
});

test("capacity check admits only one of two competing registrations", async () => {
  const event = createEvent(organizer, eventInput("One seat event", 1), new Date("2026-09-01T00:00:00Z"));
  reviewEvent(admin, event.slug, "approved", new Date("2026-09-01T00:00:00Z"));
  const attempts = await Promise.allSettled([
    Promise.resolve().then(() => registerForEvent(event.slug, { name: "A", email: "a@example.test", publicProfile: false, reminderOptIn: false }, new Date("2026-09-02T00:00:00Z"))),
    Promise.resolve().then(() => registerForEvent(event.slug, { name: "B", email: "b@example.test", publicProfile: false, reminderOptIn: false }, new Date("2026-09-02T00:00:00Z"))),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected" && attempt.reason instanceof DomainError && attempt.reason.status === 409).length, 1);
});

test("self-cancellation requires its token and releases capacity", () => {
  const event = createEvent(organizer, eventInput("Cancellation event", 1), new Date("2026-09-01T00:00:00Z"));
  reviewEvent(admin, event.slug, "approved", new Date("2026-09-01T00:00:00Z"));
  const result = registerForEvent(event.slug, { name: "Private", email: "private@example.test", publicProfile: false, reminderOptIn: true }, new Date("2026-09-02T00:00:00Z"));
  assert.equal("email" in result.registration, false);
  assert.throws(() => cancelRegistration(result.registration.id, "wrong"), (error: unknown) => error instanceof DomainError && error.status === 404);
  cancelRegistration(result.registration.id, result.cancellationToken, new Date("2026-09-03T00:00:00Z"));
  assert.doesNotThrow(() => registerForEvent(event.slug, { name: "Next", email: "next@example.test", publicProfile: false, reminderOptIn: false }, new Date("2026-09-03T00:00:00Z")));
});

test("event cancellation closes registration and remains visible as cancelled", () => {
  const event = createEvent(organizer, eventInput("Cancelled event"), new Date("2026-09-01T00:00:00Z"));
  reviewEvent(admin, event.slug, "approved", new Date("2026-09-01T00:00:00Z"));
  cancelEvent(organizer, event.slug, "Venue unavailable", new Date("2026-09-02T00:00:00Z"));
  assert.equal(listEvents({ status: "cancelled" }, new Date("2026-09-03T00:00:00Z")).items.some((item) => item.slug === event.slug), true);
  assert.throws(
    () => registerForEvent(event.slug, { name: "Late", email: "late@example.test", publicProfile: false, reminderOptIn: false }, new Date("2026-09-03T00:00:00Z")),
    (error: unknown) => error instanceof DomainError && error.status === 409,
  );
});

test("freshness expires future listings while retaining past archives", () => {
  const future = { ...demoEvents[0], startsAt: "2027-01-10T10:00:00Z", endsAt: "2027-01-10T12:00:00Z", freshUntil: "2026-09-01T00:00:00Z" } as EventRecord;
  const past = { ...future, startsAt: "2026-07-01T10:00:00Z", endsAt: "2026-07-01T12:00:00Z" };
  assert.equal(isFresh(future, new Date("2026-10-01T00:00:00Z")), false);
  assert.equal(isFresh(past, new Date("2026-10-01T00:00:00Z")), true);
});
