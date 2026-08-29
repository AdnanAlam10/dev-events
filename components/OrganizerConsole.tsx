"use client";

import { useEffect, useState } from "react";
import type { EventRecord, SessionUser } from "@/database/types";

type Analytics = { slug: string; registrations: number; capacity: number; fillRate: number; publicAttendees: number; reminderOptIns: number };

export default function OrganizerConsole({ initialUser }: { initialUser: SessionUser | null }) {
  const [user, setUser] = useState(initialUser);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const [eventResponse, analyticsResponse] = await Promise.all([
      fetch("/api/events?managed=true", { cache: "no-store" }),
      fetch("/api/organizer/analytics", { cache: "no-store" }),
    ]);
    if (eventResponse.ok) setEvents((await eventResponse.json()).items);
    if (analyticsResponse.ok) setAnalytics((await analyticsResponse.json()).items);
  }

  useEffect(() => { if (user) void refresh(); }, [user]);

  async function signIn(formData: FormData) {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: formData.get("account"), code: formData.get("code") }),
    });
    const result = await response.json();
    if (!response.ok) return setMessage(result.error);
    setUser(result.user);
    setMessage(`Signed in as ${result.user.name}.`);
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    setEvents([]);
  }

  async function create(formData: FormData) {
    const startsAt = new Date(String(formData.get("startsAt"))).toISOString();
    const endsAt = new Date(String(formData.get("endsAt"))).toISOString();
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        overview: formData.get("overview"),
        image: "/images/event3.png",
        venue: formData.get("venue"),
        location: formData.get("location"),
        startsAt,
        endsAt,
        timezone: "UTC",
        mode: formData.get("mode"),
        audience: formData.get("audience"),
        topics: String(formData.get("topics")).split(",").map((topic) => topic.trim()).filter(Boolean),
        capacity: Number(formData.get("capacity")),
        speakers: [],
        schedule: [{ time: startsAt.slice(11, 16), title: "Demo event begins" }],
        recordings: [],
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? `Created ${result.event.title}; it is pending admin review.` : result.error);
    if (response.ok) await refresh();
  }

  async function mutate(slug: string, body: unknown, method = "PATCH") {
    const response = await fetch(`/api/events/${slug}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(body),
    });
    const result = response.status === 204 ? {} : await response.json();
    setMessage(response.ok ? "Event updated." : result.error);
    if (response.ok) await refresh();
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-xl space-y-6">
        <div><p className="text-sm uppercase tracking-widest text-emerald-300">Public portfolio account</p><h1>Organizer demo</h1></div>
        <p>This sign-in controls only explicit demo data. It is not a production identity or a live event account.</p>
        <form action={signIn} className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-6">
          <label className="block">Role<select name="account" className="mt-1 w-full rounded-md bg-dark-200 p-3"><option value="organizer">Organizer</option><option value="admin">Moderator admin</option></select></label>
          <label className="block">Demo access code<input name="code" type="password" required className="mt-1 w-full rounded-md bg-dark-200 p-3" placeholder="Configured by the deployer" /></label>
          <button className="rounded-md bg-primary px-5 py-3 font-semibold text-black">Sign in</button>
        </form>
        {message && <p role="status">{message}</p>}
      </section>
    );
  }

  return (
    <section className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm uppercase tracking-widest text-emerald-300">{user.role} console · DEMO</p><h1>{user.name}</h1></div>
        <button onClick={signOut} className="rounded-md border border-white/20 px-4 py-2">Sign out</button>
      </div>
      {message && <p role="status" className="rounded-md border border-emerald-300/30 p-4">{message}</p>}

      <section className="grid gap-4 md:grid-cols-3">
        {analytics.map((item) => (
          <div key={item.slug} className="rounded-lg border border-white/10 p-4">
            <p className="font-semibold">{item.slug}</p><p>{item.registrations}/{item.capacity} registrations · {item.fillRate}% full</p>
            <p className="text-sm text-light-200">{item.publicAttendees} public-count opt-ins · {item.reminderOptIns} reminder opt-ins</p>
          </div>
        ))}
      </section>

      <form action={create} className="grid gap-4 rounded-xl border border-white/10 bg-black/30 p-6 md:grid-cols-2">
        <h2 className="text-2xl font-bold md:col-span-2">Create a demo event</h2>
        <label>Title<input name="title" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Audience<input name="audience" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label className="md:col-span-2">Description<input name="description" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label className="md:col-span-2">Overview<textarea name="overview" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Venue<input name="venue" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Location<input name="location" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Starts (UTC)<input name="startsAt" type="datetime-local" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Ends (UTC)<input name="endsAt" type="datetime-local" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Topics (comma separated)<input name="topics" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Capacity<input name="capacity" type="number" min="1" max="100000" required className="mt-1 w-full rounded-md bg-dark-200 p-3" /></label>
        <label>Mode<select name="mode" className="mt-1 w-full rounded-md bg-dark-200 p-3"><option>online</option><option>offline</option><option>hybrid</option></select></label>
        <button className="self-end rounded-md bg-primary px-5 py-3 font-semibold text-black">Create for review</button>
      </form>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Managed events</h2>
        {events.map((event) => (
          <article key={event.slug} className="rounded-xl border border-white/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h3>{event.title}</h3><p>{event.moderationStatus} · {event.registeredCount}/{event.capacity}</p></div><span className="pill">{event.source.toUpperCase()}</span></div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => mutate(event.slug, { overview: event.overview })} className="rounded-md border border-white/20 px-3 py-2">Update & reverify</button>
              {!event.cancelledAt && <button onClick={() => mutate(event.slug, { action: "cancel", reason: "Cancelled from the organizer demo console." })} className="rounded-md border border-red-300/30 px-3 py-2">Cancel event</button>}
              {event.registeredCount === 0 && <button onClick={() => mutate(event.slug, null, "DELETE")} className="rounded-md border border-red-300/30 px-3 py-2">Delete</button>}
              {user.role === "admin" && event.moderationStatus !== "approved" && <button onClick={() => mutate(event.slug, { action: "review", decision: "approved" })} className="rounded-md bg-primary px-3 py-2 font-semibold text-black">Approve</button>}
              {user.role === "admin" && event.moderationStatus !== "rejected" && <button onClick={() => mutate(event.slug, { action: "review", decision: "rejected" })} className="rounded-md border border-white/20 px-3 py-2">Reject</button>}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
