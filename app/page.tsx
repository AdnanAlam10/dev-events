import Link from "next/link";
import EventCard from "@/components/EventCard";
import { listEvents, persistenceMode } from "@/database/service";
import type { EventFilters } from "@/database/types";
import { DEMO_TOPICS } from "@/lib/constants";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valueOf(parameter: string | string[] | undefined) {
  return typeof parameter === "string" ? parameter : "";
}

export default async function Page({ searchParams }: HomeProps) {
  const query = await searchParams;
  const rawStatus = valueOf(query.status);
  const filters: EventFilters = {
    search: valueOf(query.search),
    location: valueOf(query.location),
    topic: valueOf(query.topic),
    date: valueOf(query.date),
    status:
      rawStatus === "past" || rawStatus === "upcoming" || rawStatus === "cancelled" || rawStatus === "all"
        ? rawStatus
        : "all",
    page: Number(valueOf(query.page) || 1),
    pageSize: 6,
  };
  const result = await listEvents(filters);
  const linkForPage = (page: number) => {
    const parameters = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== "pageSize") parameters.set(key, String(value));
    });
    parameters.set("page", String(page));
    return `/?${parameters}`;
  };

  return (
    <section>
      <div className="mx-auto max-w-4xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">
          Explicit portfolio demo data
        </p>
        <h1>Discover developer events without stale listings</h1>
        <p className="mt-5 text-light-200">
          Search a coherent demo catalog, register for free, and inspect organizer workflows. No listing represents a live third-party event.
          This deployment uses <strong>{persistenceMode === "mongodb" ? "durable MongoDB Atlas" : "ephemeral in-process demo"}</strong> storage.
        </p>
      </div>

      <form className="mt-12 grid gap-3 rounded-xl border border-white/10 bg-black/30 p-5 md:grid-cols-5" action="/">
        <label className="text-sm">
          Search
          <input name="search" defaultValue={filters.search} placeholder="Title or topic" className="mt-1 w-full rounded-md bg-dark-200 p-3" />
        </label>
        <label className="text-sm">
          Location
          <input name="location" defaultValue={filters.location} placeholder="Online or city" className="mt-1 w-full rounded-md bg-dark-200 p-3" />
        </label>
        <label className="text-sm">
          Topic
          <select name="topic" defaultValue={filters.topic} className="mt-1 w-full rounded-md bg-dark-200 p-3">
            <option value="">All topics</option>
            {DEMO_TOPICS.map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Date
          <input type="date" name="date" defaultValue={filters.date} className="mt-1 w-full rounded-md bg-dark-200 p-3" />
        </label>
        <label className="text-sm">
          State
          <select name="status" defaultValue={filters.status} className="mt-1 w-full rounded-md bg-dark-200 p-3">
            <option value="all">All</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <div className="flex gap-3 md:col-span-5">
          <button className="rounded-md bg-primary px-5 py-3 font-semibold text-black">Apply filters</button>
          <Link href="/" className="rounded-md border border-white/20 px-5 py-3">Clear</Link>
        </div>
      </form>

      <div className="mt-12 space-y-7">
        <div className="flex items-end justify-between gap-4">
          <div><h3>Demo events</h3><p className="text-light-200">{result.total} matching event{result.total === 1 ? "" : "s"}</p></div>
          <Link href="/organizer" className="text-emerald-300 underline">Organizer demo</Link>
        </div>
        {result.items.length ? (
          <ul id="events" className="events list-none">
            {result.items.map((event) => <li key={event.slug}><EventCard {...event} /></li>)}
          </ul>
        ) : <p className="rounded-lg border border-white/10 p-8 text-center">No fresh demo events match these filters.</p>}
        <nav aria-label="Pagination" className="flex justify-center gap-3">
          {result.page > 1 && <Link href={linkForPage(result.page - 1)} className="pill">Previous</Link>}
          <span className="pill">Page {result.page} of {result.totalPages}</span>
          {result.page < result.totalPages && <Link href={linkForPage(result.page + 1)} className="pill">Next</Link>}
        </nav>
      </div>
    </section>
  );
}
