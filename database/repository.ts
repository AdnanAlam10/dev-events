import { randomUUID } from "node:crypto";
import { demoEvents } from "./seed";
import {
  DomainError,
  type EventInput,
  type EventList,
  type EventQuery,
  type EventRecord,
  type EventState,
  type RegistrationRecord,
  type ReminderOutboxRecord,
  type SessionUser,
} from "./types";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const copy = <T>(value: T): T => structuredClone(value);

export function eventState(event: EventRecord, now = new Date()): EventState {
  if (event.status === "cancelled") return "cancelled";
  return new Date(event.endsAt) <= now ? "past" : "upcoming";
}

export function isFresh(event: EventRecord, now = new Date()): boolean {
  const expiresAt = new Date(event.verifiedAt).getTime() + event.freshnessDays * 86_400_000;
  return Number.isFinite(expiresAt) && expiresAt >= now.getTime();
}

export function canManageEvent(user: SessionUser, event: EventRecord): boolean {
  return user.role === "admin" || event.organizerId === user.id;
}

export class DemoEventRepository {
  private events: EventRecord[];
  private registrations: RegistrationRecord[] = [];
  private outbox: ReminderOutboxRecord[] = [];

  constructor(seed: EventRecord[] = demoEvents) {
    this.events = copy(seed);
  }

  listEvents(query: EventQuery = {}, now = new Date()): EventList {
    const search = query.search?.trim().toLowerCase();
    const location = query.location?.trim().toLowerCase();
    const topic = query.topic?.trim().toLowerCase();
    const pageSize = Math.min(24, Math.max(1, query.pageSize ?? 6));
    const page = Math.max(1, query.page ?? 1);

    const filtered = this.events
      .filter((event) => ["approved", "cancelled"].includes(event.status))
      .filter((event) => isFresh(event, now))
      .filter((event) => !search || [event.title, event.summary, event.description, event.organizerName, ...event.topics].join(" ").toLowerCase().includes(search))
      .filter((event) => !location || event.location.toLowerCase().includes(location))
      .filter((event) => !topic || event.topics.some((value) => value.toLowerCase() === topic))
      .filter((event) => !query.date || event.startsAt.slice(0, 10) === query.date)
      .filter((event) => !query.state || eventState(event, now) === query.state)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const total = filtered.length;
    return {
      items: copy(filtered.slice((page - 1) * pageSize, page * pageSize)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  getPublicEvent(slug: string, now = new Date()): EventRecord | null {
    const event = this.events.find((item) => item.slug === slug);
    if (!event || !["approved", "cancelled"].includes(event.status) || !isFresh(event, now)) return null;
    return copy(event);
  }

  listManagedEvents(user: SessionUser): EventRecord[] {
    return copy(this.events.filter((event) => user.role === "admin" || event.organizerId === user.id));
  }

  createEvent(user: SessionUser, input: EventInput, now = new Date()): EventRecord {
    if (this.events.some((event) => event.slug === input.slug)) {
      throw new DomainError("SLUG_TAKEN", "That event slug is already in use.", 409);
    }
    const timestamp = now.toISOString();
    const event: EventRecord = {
      ...copy(input),
      id: randomUUID(),
      organizerId: user.id,
      sourceLabel: "First-party DEMO catalog",
      status: "pending",
      registrationCount: 0,
      attendeeListVisibility: "organizer-only",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.events.push(event);
    return copy(event);
  }

  updateEvent(user: SessionUser, slug: string, updates: Partial<EventInput>, now = new Date()): EventRecord {
    const event = this.requireEvent(slug);
    this.authorize(user, event);
    if (updates.slug && updates.slug !== slug && this.events.some((item) => item.slug === updates.slug)) {
      throw new DomainError("SLUG_TAKEN", "That event slug is already in use.", 409);
    }
    Object.assign(event, copy(updates), {
      status: user.role === "admin" ? event.status : "pending",
      moderationNote: undefined,
      updatedAt: now.toISOString(),
    });
    return copy(event);
  }

  deleteEvent(user: SessionUser, slug: string): void {
    const event = this.requireEvent(slug);
    this.authorize(user, event);
    if (event.registrationCount > 0) {
      throw new DomainError("HAS_REGISTRATIONS", "Cancel events with registrations instead of deleting them.", 409);
    }
    this.events = this.events.filter((item) => item.id !== event.id);
  }

  cancelEvent(user: SessionUser, slug: string, now = new Date()): EventRecord {
    const event = this.requireEvent(slug);
    this.authorize(user, event);
    event.status = "cancelled";
    event.moderationNote = "Cancelled by the organizer.";
    event.updatedAt = now.toISOString();
    return copy(event);
  }

  reviewEvent(admin: SessionUser, slug: string, decision: "approved" | "rejected", note: string, now = new Date()): EventRecord {
    if (admin.role !== "admin") throw new DomainError("FORBIDDEN", "Admin access is required.", 403);
    const event = this.requireEvent(slug);
    if (event.status === "cancelled") throw new DomainError("CANCELLED", "Cancelled events cannot be moderated.", 409);
    event.status = decision;
    event.moderationNote = note.trim() || undefined;
    event.updatedAt = now.toISOString();
    return copy(event);
  }

  reverifyEvent(user: SessionUser, slug: string, now = new Date()): EventRecord {
    const event = this.requireEvent(slug);
    this.authorize(user, event);
    event.verifiedAt = now.toISOString();
    event.updatedAt = now.toISOString();
    return copy(event);
  }

  async register(slug: string, name: string, email: string, now = new Date()): Promise<RegistrationRecord> {
    const event = this.requireEvent(slug);
    const normalizedEmail = normalizeEmail(email);
    if (event.status !== "approved" || eventState(event, now) !== "upcoming" || !isFresh(event, now)) {
      throw new DomainError("REGISTRATION_CLOSED", "Registration is not open for this event.", 409);
    }
    if (this.registrations.some((item) => item.eventId === event.id && item.email === normalizedEmail && item.status === "active")) {
      throw new DomainError("ALREADY_REGISTERED", "You already have an active registration for this event.", 409);
    }
    if (event.registrationCount >= event.capacity) {
      throw new DomainError("EVENT_FULL", "This event is at capacity.", 409);
    }

    event.registrationCount += 1;
    event.updatedAt = now.toISOString();
    const registration: RegistrationRecord = {
      id: randomUUID(),
      eventId: event.id,
      name: name.trim(),
      email: normalizedEmail,
      status: "active",
      createdAt: now.toISOString(),
    };
    this.registrations.push(registration);
    return copy(registration);
  }

  async cancelRegistration(slug: string, registrationId: string, email: string, now = new Date()): Promise<RegistrationRecord> {
    const event = this.requireEvent(slug);
    const registration = this.registrations.find((item) => item.id === registrationId && item.eventId === event.id);
    if (!registration || registration.email !== normalizeEmail(email)) {
      throw new DomainError("NOT_FOUND", "No matching registration was found.", 404);
    }
    if (registration.status === "cancelled") return copy(registration);

    registration.status = "cancelled";
    registration.cancelledAt = now.toISOString();
    event.registrationCount = Math.max(0, event.registrationCount - 1);
    event.updatedAt = now.toISOString();
    this.enqueueOutbox(registration, event, "registration-cancelled", now, now);
    return copy(registration);
  }

  queueDueReminders(now = new Date(), leadHours = 24): number {
    const windowEnd = now.getTime() + leadHours * 3_600_000;
    let queued = 0;
    for (const registration of this.registrations) {
      if (registration.status !== "active") continue;
      const event = this.events.find((item) => item.id === registration.eventId);
      if (!event || event.status !== "approved") continue;
      const start = new Date(event.startsAt).getTime();
      if (start <= now.getTime() || start > windowEnd) continue;
      const exists = this.outbox.some((item) => item.registrationId === registration.id && item.kind === "event-reminder");
      if (!exists) {
        this.enqueueOutbox(registration, event, "event-reminder", now, now);
        queued += 1;
      }
    }
    return queued;
  }

  listOutbox(): ReminderOutboxRecord[] {
    return copy(this.outbox);
  }

  markOutbox(id: string, status: "sent" | "failed", error?: string, now = new Date()): ReminderOutboxRecord {
    const item = this.outbox.find((entry) => entry.id === id);
    if (!item) throw new DomainError("NOT_FOUND", "Outbox item not found.", 404);
    item.attempts += 1;
    item.status = status;
    item.lastError = error;
    item.sentAt = status === "sent" ? now.toISOString() : undefined;
    return copy(item);
  }

  organizerAnalytics(user: SessionUser): { events: number; activeRegistrations: number; capacity: number } {
    const events = this.events.filter((event) => user.role === "admin" || event.organizerId === user.id);
    const ids = new Set(events.map((event) => event.id));
    return {
      events: events.length,
      activeRegistrations: this.registrations.filter((registration) => ids.has(registration.eventId) && registration.status === "active").length,
      capacity: events.reduce((sum, event) => sum + event.capacity, 0),
    };
  }

  private requireEvent(slug: string): EventRecord {
    const event = this.events.find((item) => item.slug === slug);
    if (!event) throw new DomainError("NOT_FOUND", "Event not found.", 404);
    return event;
  }

  private authorize(user: SessionUser, event: EventRecord): void {
    if (!canManageEvent(user, event)) throw new DomainError("FORBIDDEN", "You cannot manage this event.", 403);
  }

  private enqueueOutbox(
    registration: RegistrationRecord,
    event: EventRecord,
    kind: ReminderOutboxRecord["kind"],
    scheduledFor: Date,
    now: Date,
  ): void {
    this.outbox.push({
      id: randomUUID(),
      registrationId: registration.id,
      eventId: event.id,
      to: registration.email,
      kind,
      scheduledFor: scheduledFor.toISOString(),
      status: "pending",
      attempts: 0,
      createdAt: now.toISOString(),
    });
  }
}

export const demoRepository = new DemoEventRepository();
