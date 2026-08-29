export type EventStatus = "upcoming" | "past" | "cancelled";
export type ModerationStatus = "draft" | "pending" | "approved" | "rejected";
export type EventSource = "demo" | "organizer";

export type Speaker = {
  name: string;
  role: string;
  bio: string;
};

export type ScheduleItem = {
  time: string;
  title: string;
  speaker?: string;
};

export type Recording = {
  title: string;
  url: string;
};

export type EventRecord = {
  slug: string;
  title: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  mode: "online" | "offline" | "hybrid";
  audience: string;
  topics: string[];
  organizerId: string;
  organizerName: string;
  source: EventSource;
  sourceLabel: string;
  lastVerifiedAt: string;
  freshUntil: string;
  moderationStatus: ModerationStatus;
  cancelledAt?: string;
  cancellationReason?: string;
  capacity: number;
  registeredCount: number;
  speakers: Speaker[];
  schedule: ScheduleItem[];
  recordings: Recording[];
  createdAt: string;
  updatedAt: string;
};

export type RegistrationRecord = {
  id: string;
  eventSlug: string;
  name: string;
  email: string;
  publicProfile: boolean;
  reminderOptIn: boolean;
  cancellationTokenHash: string;
  status: "active" | "cancelled";
  createdAt: string;
  cancelledAt?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "organizer" | "admin";
};

export type EventFilters = {
  search?: string;
  location?: string;
  topic?: string;
  date?: string;
  status?: EventStatus | "all";
  page?: number;
  pageSize?: number;
  includeUnfresh?: boolean;
};

export type EventPage = {
  items: EventRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
