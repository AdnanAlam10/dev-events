export type EventStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
export type EventState = "upcoming" | "past" | "cancelled";
export type SessionRole = "organizer" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  role: SessionRole;
};

export type Speaker = {
  name: string;
  title: string;
  bio: string;
};

export type ScheduleItem = {
  startsAt: string;
  title: string;
  speaker?: string;
};

export type Recording = {
  title: string;
  url: string;
};

export type EventRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  venue: string;
  location: string;
  startsAt: string;
  endsAt: string;
  mode: "in-person" | "online" | "hybrid";
  audience: string;
  topics: string[];
  organizerId: string;
  organizerName: string;
  sourceLabel: "First-party DEMO catalog";
  verifiedAt: string;
  freshnessDays: number;
  status: EventStatus;
  moderationNote?: string;
  capacity: number;
  registrationCount: number;
  attendeeListVisibility: "organizer-only";
  speakers: Speaker[];
  schedule: ScheduleItem[];
  recordings: Recording[];
  createdAt: string;
  updatedAt: string;
};

export type EventInput = Omit<
  EventRecord,
  | "id"
  | "sourceLabel"
  | "registrationCount"
  | "attendeeListVisibility"
  | "status"
  | "moderationNote"
  | "createdAt"
  | "updatedAt"
>;

export type RegistrationRecord = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  status: "active" | "cancelled";
  createdAt: string;
  cancelledAt?: string;
};

export type ReminderOutboxRecord = {
  id: string;
  registrationId: string;
  eventId: string;
  to: string;
  kind: "event-reminder" | "registration-cancelled";
  scheduledFor: string;
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  sentAt?: string;
  lastError?: string;
};

export type EventQuery = {
  search?: string;
  location?: string;
  date?: string;
  topic?: string;
  state?: EventState;
  page?: number;
  pageSize?: number;
};

export type EventList = {
  items: EventRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
