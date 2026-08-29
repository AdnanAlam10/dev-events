import { createHash, randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Event from "./event.model";
import Registration from "./booking.model";
import ReminderOutbox from "./reminder.model";
import { demoEvents } from "./seed";
import { DomainError, eventStatus, isFresh, type EventInput } from "./repository";
import type { EventFilters, EventPage, EventRecord, SessionUser } from "./types";

let seeded = false;
async function ready() {
  await connectDB();
  if (!seeded) {
    await Promise.all(demoEvents.map((event) => Event.updateOne({ slug: event.slug }, { $setOnInsert: event }, { upsert: true })));
    seeded = true;
  }
}

function canManage(user: SessionUser, event: EventRecord) {
  return user.role === "admin" || event.organizerId === user.id;
}

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function validate(input: EventInput) {
  if (!input.title?.trim() || !input.description?.trim() || !input.overview?.trim()) throw new DomainError("Title, description, and overview are required.", 400);
  if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new DomainError("Capacity must be a positive whole number.", 400);
  if (new Date(input.endsAt) <= new Date(input.startsAt)) throw new DomainError("Event end time must be after its start time.", 400);
  if (!input.topics?.length) throw new DomainError("At least one topic is required.", 400);
}

export async function listDurableEvents(filters: EventFilters = {}, now = new Date()): Promise<EventPage> {
  await ready();
  const search = filters.search?.trim().toLowerCase();
  let items = (await Event.find({ moderationStatus: "approved" }).lean()) as unknown as EventRecord[];
  items = items.filter((event) => (filters.includeUnfresh || isFresh(event, now)) &&
    (!search || [event.title, event.description, event.overview, event.organizerName, ...event.topics].join(" ").toLowerCase().includes(search)) &&
    (!filters.location || event.location.toLowerCase().includes(filters.location.toLowerCase())) &&
    (!filters.topic || event.topics.some((topic) => topic.toLowerCase() === filters.topic?.toLowerCase())) &&
    (!filters.date || event.startsAt.slice(0, 10) === filters.date) &&
    (!filters.status || filters.status === "all" || eventStatus(event, now) === filters.status));
  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(24, Math.max(1, Number(filters.pageSize) || 6));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) };
}

export async function getDurableEvent(slug: string, now = new Date()) {
  await ready();
  const event = (await Event.findOne({ slug, moderationStatus: "approved" }).lean()) as unknown as EventRecord | null;
  return event && isFresh(event, now) ? event : null;
}

export async function listDurableManagedEvents(user: SessionUser) {
  await ready();
  const query = user.role === "admin" ? {} : { organizerId: user.id };
  return (await Event.find(query).sort({ updatedAt: -1 }).lean()) as unknown as EventRecord[];
}

export async function createDurableEvent(user: SessionUser, input: EventInput, now = new Date()) {
  await ready();
  validate(input);
  const baseSlug = slugify(input.title);
  if (!baseSlug) throw new DomainError("Title must contain letters or numbers.", 400);
  let slug = baseSlug;
  for (let suffix = 2; await Event.exists({ slug }); suffix += 1) slug = `${baseSlug}-${suffix}`;
  const timestamp = now.toISOString();
  return (await Event.create({ ...input, slug, organizerId: user.id, organizerName: user.name, source: "organizer", sourceLabel: `Submitted by ${user.name}`, lastVerifiedAt: timestamp, freshUntil: new Date(now.getTime() + 90 * 86400000).toISOString(), moderationStatus: "pending", registeredCount: 0, createdAt: timestamp, updatedAt: timestamp })).toObject() as unknown as EventRecord;
}

export async function updateDurableEvent(user: SessionUser, slug: string, input: Partial<EventInput>, now = new Date()) {
  await ready();
  const event = (await Event.findOne({ slug }).lean()) as unknown as EventRecord | null;
  if (!event) throw new DomainError("Event not found.", 404);
  if (!canManage(user, event)) throw new DomainError("You do not own this event.", 403);
  const next = { ...event, ...input };
  validate(next);
  if (next.capacity < event.registeredCount) throw new DomainError("Capacity cannot be below active registrations.", 409);
  next.updatedAt = now.toISOString();
  next.lastVerifiedAt = now.toISOString();
  next.freshUntil = new Date(now.getTime() + 90 * 86400000).toISOString();
  if (user.role !== "admin" && event.moderationStatus === "approved") next.moderationStatus = "pending";
  return (await Event.findOneAndUpdate({ slug }, next, { new: true }).lean()) as unknown as EventRecord;
}

export async function deleteDurableEvent(user: SessionUser, slug: string) {
  await ready();
  const event = (await Event.findOne({ slug }).lean()) as unknown as EventRecord | null;
  if (!event) throw new DomainError("Event not found.", 404);
  if (!canManage(user, event)) throw new DomainError("You do not own this event.", 403);
  if (event.registeredCount) throw new DomainError("Cancel an event with attendees instead of deleting it.", 409);
  await Event.deleteOne({ slug });
}

export async function reviewDurableEvent(user: SessionUser, slug: string, decision: "approved" | "rejected", now = new Date()) {
  await ready();
  if (user.role !== "admin") throw new DomainError("Admin access required.", 403);
  const event = await Event.findOneAndUpdate({ slug }, { moderationStatus: decision, updatedAt: now.toISOString() }, { new: true }).lean();
  if (!event) throw new DomainError("Event not found.", 404);
  return event as unknown as EventRecord;
}

export async function cancelDurableEvent(user: SessionUser, slug: string, reason: string, now = new Date()) {
  await ready();
  const event = (await Event.findOne({ slug }).lean()) as unknown as EventRecord | null;
  if (!event) throw new DomainError("Event not found.", 404);
  if (!canManage(user, event)) throw new DomainError("You do not own this event.", 403);
  if (!reason.trim()) throw new DomainError("A cancellation reason is required.", 400);
  if (eventStatus(event, now) === "past") throw new DomainError("Past events cannot be cancelled.", 409);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Event.updateOne(
        { slug },
        { cancelledAt: now.toISOString(), cancellationReason: reason.trim(), updatedAt: now.toISOString() },
        { session },
      );
      const registrations = await Registration.find({ eventSlug: slug, status: "active" })
        .select("id email")
        .session(session)
        .lean();
      if (registrations.length) {
        await ReminderOutbox.bulkWrite(
          registrations.map((registration) => ({
            updateOne: {
              filter: { registrationId: registration.id, kind: "cancellation" },
              update: {
                $setOnInsert: {
                  registrationId: registration.id,
                  kind: "cancellation",
                  eventSlug: slug,
                  recipient: registration.email,
                  sendAfter: now,
                  status: "pending",
                },
              },
              upsert: true,
            },
          })),
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
  return (await Event.findOne({ slug }).lean()) as unknown as EventRecord;
}

export async function registerDurably(slug: string, attendee: { name: string; email: string; publicProfile: boolean; reminderOptIn: boolean }, now = new Date()) {
  await ready();
  const email = attendee.email.trim().toLowerCase();
  if (!attendee.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new DomainError("A name and valid email are required.", 400);
  const cancellationToken = randomBytes(24).toString("base64url");
  const id = randomUUID();
  let eventStartsAt = "";
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const duplicate = await Registration.exists({ eventSlug: slug, email, status: "active" }).session(session);
      if (duplicate) throw new DomainError("This email is already registered.", 409);
      const event = await Event.findOneAndUpdate(
        { slug, moderationStatus: "approved", cancelledAt: { $exists: false }, startsAt: { $gt: now.toISOString() }, freshUntil: { $gte: now.toISOString() }, $expr: { $lt: ["$registeredCount", "$capacity"] } },
        { $inc: { registeredCount: 1 }, $set: { updatedAt: now.toISOString() } },
        { new: true, session },
      );
      if (!event) throw new DomainError("Registration is closed or the event is at capacity.", 409);
      eventStartsAt = event.startsAt;
      await Registration.create([{ id, eventSlug: slug, name: attendee.name.trim(), email, publicProfile: Boolean(attendee.publicProfile), reminderOptIn: Boolean(attendee.reminderOptIn), cancellationTokenHash: createHash("sha256").update(cancellationToken).digest("hex"), status: "active", createdAt: now.toISOString() }], { session });
      if (attendee.reminderOptIn) {
        await ReminderOutbox.create([{ registrationId: id, kind: "reminder", eventSlug: slug, recipient: email, sendAfter: new Date(new Date(event.startsAt).getTime() - 86400000), status: "pending" }], { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return { registration: { id, eventSlug: slug, name: attendee.name.trim(), publicProfile: Boolean(attendee.publicProfile), reminderOptIn: Boolean(attendee.reminderOptIn), status: "active" as const, createdAt: now.toISOString() }, cancellationToken, eventStartsAt };
}

export async function cancelDurableRegistration(id: string, token: string, now = new Date()) {
  await ready();
  const hash = createHash("sha256").update(token).digest("hex");
  const session = await mongoose.startSession();
  let eventSlug = "";
  try {
    await session.withTransaction(async () => {
      const registration = await Registration.findOneAndUpdate({ id, cancellationTokenHash: hash, status: "active" }, { status: "cancelled", cancelledAt: now.toISOString() }, { new: true, session });
      if (!registration) throw new DomainError("Registration or cancellation token is invalid.", 404);
      eventSlug = registration.eventSlug;
      await Event.updateOne({ slug: eventSlug, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } }, { session });
      await ReminderOutbox.updateOne({ registrationId: id, kind: "reminder", status: "pending" }, { status: "cancelled" }, { session });
    });
  } finally {
    await session.endSession();
  }
  return { id, eventSlug, status: "cancelled" as const, cancelledAt: now.toISOString() };
}

export async function durableAnalytics(user: SessionUser) {
  const events = await listDurableManagedEvents(user);
  return Promise.all(events.map(async (event) => ({
    slug: event.slug, title: event.title, status: eventStatus(event), moderationStatus: event.moderationStatus,
    registrations: event.registeredCount, capacity: event.capacity, fillRate: Math.round(event.registeredCount / event.capacity * 100),
    publicAttendees: await Registration.countDocuments({ eventSlug: event.slug, status: "active", publicProfile: true }),
    reminderOptIns: await Registration.countDocuments({ eventSlug: event.slug, status: "active", reminderOptIn: true }),
  })));
}
