import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/database/service";
import { eventStatus } from "@/database/repository";
import RegistrationForm from "@/components/RegistrationForm";

type EventPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const event = await getPublicEvent((await params).slug);
  return event
    ? { title: `${event.title} | DevEvent DEMO`, description: event.description }
    : {};
}

export default async function EventPage({ params }: EventPageProps) {
  const event = await getPublicEvent((await params).slug);
  if (!event) notFound();
  const status = eventStatus(event);
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(event.startsAt));

  return (
    <article id="event">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="pill uppercase">{status}</span>
        <span className="rounded-full bg-emerald-300 px-4 py-2 text-xs font-bold text-black">DEMO EVENT</span>
        <span className="text-sm text-light-200">Verified {new Date(event.lastVerifiedAt).toLocaleDateString("en")}</span>
      </div>
      <div className="header">
        <h1>{event.title}</h1>
        <p>{event.description}</p>
        <p className="text-sm">{event.sourceLabel}. This is not a live third-party event.</p>
      </div>
      {status === "cancelled" && (
        <div className="rounded-lg border border-red-300/40 bg-red-950/30 p-5">
          <strong>Cancelled:</strong> {event.cancellationReason}
        </div>
      )}
      <div className="details">
        <div className="content">
          <Image src={event.image} alt="" width={900} height={500} className="banner" priority />
          <section className="grid gap-3 rounded-lg border border-white/10 p-5 sm:grid-cols-2">
            <p><strong>When:</strong><br />{date} ({event.timezone})</p>
            <p><strong>Where:</strong><br />{event.venue}, {event.location}</p>
            <p><strong>Format:</strong><br />{event.mode}</p>
            <p><strong>Capacity:</strong><br />{event.registeredCount} / {event.capacity} registered</p>
          </section>
          <section><h2>About</h2><p>{event.overview}</p><p className="mt-3">For {event.audience}.</p></section>
          <section>
            <h2>Topics</h2>
            <div className="mt-3 flex flex-wrap gap-2">{event.topics.map((topic) => <span className="pill" key={topic}>{topic}</span>)}</div>
          </section>
          <section>
            <h2>Speakers</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {event.speakers.length ? event.speakers.map((speaker) => (
                <div key={speaker.name} className="rounded-lg border border-white/10 p-4">
                  <h3>{speaker.name}</h3><p className="text-emerald-300">{speaker.role}</p><p>{speaker.bio}</p>
                </div>
              )) : <p>There are no speakers listed.</p>}
            </div>
          </section>
          <section className="agenda">
            <h2>Schedule</h2>
            <ol className="mt-3 space-y-3">
              {event.schedule.map((item) => (
                <li key={`${item.time}-${item.title}`} className="rounded-lg border border-white/10 p-4">
                  <strong>{item.time} — {item.title}</strong>{item.speaker && <p>{item.speaker}</p>}
                </li>
              ))}
            </ol>
          </section>
          {event.recordings.length > 0 && (
            <section><h2>Recordings</h2>{event.recordings.map((recording) => (
              <a key={recording.title} href={recording.url} rel="noreferrer" className="mt-3 block text-emerald-300 underline">{recording.title}</a>
            ))}</section>
          )}
          <div className="flex flex-wrap gap-3">
            <a href={`/api/events/${event.slug}/calendar`} className="rounded-md bg-primary px-5 py-3 font-semibold text-black">Export calendar (.ics)</a>
            <Link href="/" className="rounded-md border border-white/20 px-5 py-3">Back to events</Link>
          </div>
        </div>
        <aside className="booking">
          <RegistrationForm
            slug={event.slug}
            disabled={status !== "upcoming" || event.registeredCount >= event.capacity}
            emailDeliveryEnabled={Boolean(process.env.MONGODB_URI && process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL)}
          />
        </aside>
      </div>
    </article>
  );
}
