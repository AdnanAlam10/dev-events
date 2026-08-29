import { createHash, randomBytes, randomUUID } from "node:crypto";
import { demoEvents } from "./seed";
import type {
  EventFilters,
  EventPage,
  EventRecord,
  EventStatus,
  RegistrationRecord,
  SessionUser,
} from "./types";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type EventInput = Pick<
  EventRecord,
  | "title"
  | "description"
  | "overview"
  | "image"
  | "venue"
  | "location"
  | "startsAt"
  | "endsAt"
  | "timezone"
  | "mode"
  | "audience"
  | "topics"
  | "capacity"
  | "speakers"
  | "schedule"
  | "recordings"
>;

type StoreState = {
  events: Map<string, EventRecord>;
  registrations: Map<string, RegistrationRecord>;
};

declare global {
  var devEventStore: StoreState | undefined;
}

function freshState(): StoreState {
  return {
    events: new Map(demoEvents.map((event) => [event.slug, structuredClone(event)])),
    registrations: new Map(),
  };
}

function state(): StoreState {
  globalThis.devEventStore ??= freshState();
  return globalThis.devEventStore;
}

export function eventStatus(event: EventRecord, now = new Date()): EventStatus {
  if (event.cancelledAt) return "cancelled";
  return new Date(event.endsAt) < now ? "past" : "upcoming";
}

export function isFresh(event: EventRecord, now = new Date()): boolean {
  return eventStatus(event, now) === "past" || new Date(event.freshUntil) >= now;
}

export function canManage(user: SessionUser, event: EventRecord): boolean {
  return user.role === "admin" || event.organizerId === user.id;
}

function publicEvent(event: EventRecord, now = new Date()): boolean {
  return event.moderationStatus === "approved" && isFresh(event, now);
}

function normalizePage(filters: EventFilters) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(24, Math.max(1, Number(filters.pageSize) || 6));
  return { page, pageSize };
}

export function listEvents(filters: EventFilters = {}, now = new Date()): EventPage {
  const { page, pageSize } = normalizePage(filters);
  const search = filters.search?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();
  const topic = filters.topic?.trim().toLowerCase();
  let items = [...state().events.values()].filter(
    (event) =>
      event.moderationStatus === "approved" &&
      (filters.includeUnfresh || isFresh(event, now)),
  );

  if (search) {
    items = items.filter((event) =>
      [event.title, event.description, event.overview, event.organizerName, ...event.topics]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }
  if (location) items = items.filter((event) => event.location.toLowerCase().includes(location));
  if (topic) items = items.filter((event) => event.topics.some((value) => value.toLowerCase() === topic));
  if (filters.status && filters.status !== "all") {
    items = items.filter((event) => eventStatus(event, now) === filters.status);
  }
  if (filters.date) {
    items = items.filter((event) => event.startsAt.slice(0, 10) === filters.date);
  }

  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize).map((event) => structuredClone(event)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function getPublicEvent(slug: string, now = new Date()): EventRecord | null {
  const event = state().events.get(slug);
  return event && publicEvent(event, now) ? structuredClone(event) : null;
}

export function listManagedEvents(user: SessionUser): EventRecord[] {
  return [...state().events.values()]
    .filter((event) => canManage(user, event))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((event) => structuredClone(event));
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateEventInput(input: EventInput) {
  if (!input.title?.trim() || !input.description?.trim() || !input.overview?.trim()) {
    throw new DomainError("Title, description, and overview are required.", 400);
  }
  if (!input.location?.trim() || !input.venue?.trim()) throw new DomainError("Location and venue are required.", 400);
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100000) {
    throw new DomainError("Capacity must be a whole number between 1 and 100000.", 400);
  }
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt) {
    throw new DomainError("Event end time must be after its start time.", 400);
  }
  if (!input.topics?.length) throw new DomainError("At least one topic is required.", 400);
}

export function createEvent(user: SessionUser, input: EventInput, now = new Date()): EventRecord {
  if (user.role !== "organizer" && user.role !== "admin") throw new DomainError("Organizer access required.", 403);
  validateEventInput(input);
  const baseSlug = slugify(input.title);
  if (!baseSlug) throw new DomainError("Title must contain letters or numbers.", 400);
  let slug = baseSlug;
  let suffix = 2;
  while (state().events.has(slug)) slug = `${baseSlug}-${suffix++}`;
  const timestamp = now.toISOString();
  const event: EventRecord = {
    ...structuredClone(input),
    slug,
    organizerId: user.id,
    organizerName: user.name,
    source: "organizer",
    sourceLabel: `Submitted by ${user.name}`,
    lastVerifiedAt: timestamp,
    freshUntil: new Date(now.getTime() + 90 * 86400000).toISOString(),
    moderationStatus: "pending",
    registeredCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state().events.set(slug, event);
  return structuredClone(event);
}

export function updateEvent(user: SessionUser, slug: string, input: Partial<EventInput>, now = new Date()): EventRecord {
  const event = state().events.get(slug);
  if (!event) throw new DomainError("Event not found.", 404);
  if (!canManage(user, event)) throw new DomainError("You do not own this event.", 403);
  const next = { ...event, ...structuredClone(input) };
  validateEventInput(next);
  if (next.capacity < event.registeredCount) throw new DomainError("Capacity cannot be below active registrations.", 409);
  next.updatedAt = now.toISOString();
  next.lastVerifiedAt = now.toISOString();
  next.freshUntil = new Date(now.getTime() + 90 * 86400000).toISOString();
  if (user.role !== "admin" && event.moderationStatus === "approved") next.moderationStatus = "pending";
  state().events.set(slug, next);
  return structuredClone(next);
}

export function deleteEvent(user: SessionUser, slug: string): void {
  const event = state().events.get(slug);
  if (!event) throw new DomainError("Event not found.", 404);
  if (!canManage(user, event)) throw new DomainError("You do not own this event.", 403);
  if (event.registeredCount > 0) throw new DomainError("Cancel an event with attendees instead of deleting it.", 409);
  state().events.delete(slug);
}

export function reviewEvent(admin: SessionUser, slug: string, decision: "approved" | "rejected", now = new Date()): EventRecord {
  if (admin.role !== "admin") throw new DomainError("Admin access required.", 403);
  const event = state().events.get(slug);
  if (!event) throw new DomainError("Event not found.", 404);
  event.moderationStatus = decision;
  event.updatedAt = now.toISOString();
  state().events.set(slug, event);
  return structuredClone(event);
}

export function cancelEvent(user: SessionUser, slug: string, reason: string, now = new Date()): EventRecord {
  const event = state().events.get(slug);
  if (!event) throw new DomainError("Event not found.", 404);
  if (!canManage(user, event)) throw new DomainError("You do not own this event.", 403);
  if (!reason.trim()) throw new DomainError("A cancellation reason is required.", 400);
  if (eventStatus(event, now) === "past") throw new DomainError("Past events cannot be cancelled.", 409);
  event.cancelledAt = now.toISOString();
  event.cancellationReason = reason.trim();
  event.updatedAt = now.toISOString();
  state().events.set(slug, event);
  return structuredClone(event);
}

export function registerForEvent(
  slug: string,
  attendee: Pick<RegistrationRecord, "name" | "email" | "publicProfile" | "reminderOptIn">,
  now = new Date(),
): { registration: Omit<RegistrationRecord, "email" | "cancellationTokenHash">; cancellationToken: string } {
  const event = state().events.get(slug);
  if (!event || !publicEvent(event, now)) throw new DomainError("Event not found.", 404);
  if (eventStatus(event, now) !== "upcoming") throw new DomainError("Registration is closed.", 409);
  const email = attendee.email.trim().toLowerCase();
  if (!attendee.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new DomainError("A name and valid email are required.", 400);
  const duplicate = [...state().registrations.values()].some(
    (registration) => registration.eventSlug === slug && registration.email === email && registration.status === "active",
  );
  if (duplicate) throw new DomainError("This email is already registered.", 409);

  // This check and increment are intentionally synchronous. In the in-process demo store,
  // no competing registration can interleave between them.
  if (event.registeredCount >= event.capacity) throw new DomainError("Event is at capacity.", 409);
  event.registeredCount += 1;
  event.updatedAt = now.toISOString();

  const cancellationToken = randomBytes(24).toString("base64url");
  const registration: RegistrationRecord = {
    id: randomUUID(),
    eventSlug: slug,
    name: attendee.name.trim(),
    email,
    publicProfile: Boolean(attendee.publicProfile),
    reminderOptIn: Boolean(attendee.reminderOptIn),
    cancellationTokenHash: hashToken(cancellationToken),
    status: "active",
    createdAt: now.toISOString(),
  };
  state().registrations.set(registration.id, registration);
  return {
    registration: redactRegistration(registration),
    cancellationToken,
  };
}

export function cancelRegistration(id: string, token: string, now = new Date()): Omit<RegistrationRecord, "email" | "cancellationTokenHash"> {
  const registration = state().registrations.get(id);
  if (!registration || registration.cancellationTokenHash !== hashToken(token)) {
    throw new DomainError("Registration or cancellation token is invalid.", 404);
  }
  if (registration.status === "cancelled") throw new DomainError("Registration is already cancelled.", 409);
  registration.status = "cancelled";
  registration.cancelledAt = now.toISOString();
  const event = state().events.get(registration.eventSlug);
  if (event) event.registeredCount = Math.max(0, event.registeredCount - 1);
  return redactRegistration(registration);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function redactRegistration(registration: RegistrationRecord) {
  const { email: _email, cancellationTokenHash: _token, ...publicRegistration } = registration;
  return structuredClone(publicRegistration);
}

export function organizerAnalytics(user: SessionUser) {
  const events = listManagedEvents(user);
  return events.map((event) => ({
    slug: event.slug,
    title: event.title,
    status: eventStatus(event),
    moderationStatus: event.moderationStatus,
    registrations: event.registeredCount,
    capacity: event.capacity,
    fillRate: Math.round((event.registeredCount / event.capacity) * 100),
    publicAttendees: [...state().registrations.values()].filter(
      (registration) => registration.eventSlug === event.slug && registration.status === "active" && registration.publicProfile,
    ).length,
    reminderOptIns: [...state().registrations.values()].filter(
      (registration) => registration.eventSlug === event.slug && registration.status === "active" && registration.reminderOptIn,
    ).length,
  }));
}

export function resetDemoStoreForTests() {
  globalThis.devEventStore = freshState();
}
