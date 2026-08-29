import * as demo from "./repository";
import * as durable from "./durable";
import type { EventFilters, SessionUser } from "./types";
import type { EventInput } from "./repository";

export const persistenceMode = process.env.MONGODB_URI ? "mongodb" : "ephemeral-demo";

export async function listEvents(filters: EventFilters = {}) {
  return process.env.MONGODB_URI ? durable.listDurableEvents(filters) : demo.listEvents(filters);
}

export async function getPublicEvent(slug: string) {
  return process.env.MONGODB_URI ? durable.getDurableEvent(slug) : demo.getPublicEvent(slug);
}

export async function listManagedEvents(user: SessionUser) {
  return process.env.MONGODB_URI ? durable.listDurableManagedEvents(user) : demo.listManagedEvents(user);
}

export async function createEvent(user: SessionUser, input: EventInput) {
  return process.env.MONGODB_URI ? durable.createDurableEvent(user, input) : demo.createEvent(user, input);
}

export async function updateEvent(user: SessionUser, slug: string, input: Partial<EventInput>) {
  return process.env.MONGODB_URI ? durable.updateDurableEvent(user, slug, input) : demo.updateEvent(user, slug, input);
}

export async function deleteEvent(user: SessionUser, slug: string) {
  return process.env.MONGODB_URI ? durable.deleteDurableEvent(user, slug) : demo.deleteEvent(user, slug);
}

export async function reviewEvent(user: SessionUser, slug: string, decision: "approved" | "rejected") {
  return process.env.MONGODB_URI ? durable.reviewDurableEvent(user, slug, decision) : demo.reviewEvent(user, slug, decision);
}

export async function cancelEvent(user: SessionUser, slug: string, reason: string) {
  return process.env.MONGODB_URI ? durable.cancelDurableEvent(user, slug, reason) : demo.cancelEvent(user, slug, reason);
}

export async function registerForEvent(slug: string, attendee: Parameters<typeof demo.registerForEvent>[1]) {
  return process.env.MONGODB_URI ? durable.registerDurably(slug, attendee) : demo.registerForEvent(slug, attendee);
}

export async function cancelRegistration(id: string, token: string) {
  return process.env.MONGODB_URI ? durable.cancelDurableRegistration(id, token) : demo.cancelRegistration(id, token);
}

export async function organizerAnalytics(user: SessionUser) {
  return process.env.MONGODB_URI ? durable.durableAnalytics(user) : demo.organizerAnalytics(user);
}
