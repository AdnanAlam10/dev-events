import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { events } from "@/lib/constants";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return events.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = events.find((item) => item.slug === slug);

  return event
    ? {
        title: `${event.title} | DevEvent`,
        description: `${event.title} in ${event.location} on ${event.date}.`,
      }
    : {};
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = events.find((item) => item.slug === slug);

  if (!event) {
    notFound();
  }

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <Image
        src={event.image}
        alt={event.title}
        width={820}
        height={600}
        className="h-auto max-h-[600px] w-full rounded-lg object-cover"
        priority
      />
      <div className="flex flex-col gap-5">
        <h1>{event.title}</h1>
        <div className="text-light-200 flex flex-col gap-2 text-lg">
          <p>{event.location}</p>
          <p>{event.date}</p>
          <p>{event.time}</p>
        </div>
        <a
          href="/#events"
          className="border-dark-200 bg-dark-100 w-fit rounded-full border px-6 py-3"
        >
          Back to events
        </a>
      </div>
    </article>
  );
}
