import Link from "next/link";
import Image from "next/image";

import type { EventRecord } from "@/database/types";
import { eventStatus } from "@/database/repository";

type Props = Pick<
  EventRecord,
  "title" | "image" | "slug" | "location" | "startsAt" | "endsAt" | "topics" | "sourceLabel" | "cancelledAt"
>;

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const EventCard = (event: Props) => {
  const status = eventStatus(event as EventRecord);
  return (
    <Link href={`/events/${event.slug}`} id="event-card" className="rounded-xl border border-white/10 bg-black/20 p-3">
      <Image
        src={event.image}
        alt=""
        width={410}
        height={300}
        className="poster"
      />
      <div className="flex flex-row items-center justify-between gap-2">
        <span className="pill uppercase">{status}</span>
        <span className="text-xs text-emerald-300">DEMO</span>
      </div>
      <div className="flex flex-row gap-2">
        <Image src="/icons/pin.svg" alt="" width={14} height={14} />
        <p className="location">{event.location}</p>
      </div>
      <p className="title">{event.title}</p>
      <div className="datetime">
        <div>
          <Image src="/icons/calendar.svg" alt="" width={14} height={14} />
          <p>{formatter.format(new Date(event.startsAt))}</p>
        </div>
      </div>
      <p className="line-clamp-1">{event.topics.join(" · ")}</p>
      <p className="text-xs">{event.sourceLabel}</p>
    </Link>
  );
};

export default EventCard;
