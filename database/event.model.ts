import { Schema, model, models, type HydratedDocument } from "mongoose";
import type { EventRecord } from "./types";

export type IEvent = EventRecord;
export type EventDocument = HydratedDocument<IEvent>;

const SpeakerSchema = new Schema({ name: String, role: String, bio: String }, { _id: false });
const ScheduleSchema = new Schema({ time: String, title: String, speaker: String }, { _id: false });
const RecordingSchema = new Schema({ title: String, url: String }, { _id: false });

const EventSchema = new Schema<IEvent>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    overview: { type: String, required: true, trim: true, maxlength: 3000 },
    image: { type: String, required: true },
    venue: { type: String, required: true },
    location: { type: String, required: true },
    startsAt: { type: String, required: true },
    endsAt: { type: String, required: true },
    timezone: { type: String, required: true },
    mode: { type: String, enum: ["online", "offline", "hybrid"], required: true },
    audience: { type: String, required: true },
    topics: { type: [String], required: true },
    organizerId: { type: String, required: true, index: true },
    organizerName: { type: String, required: true },
    source: { type: String, enum: ["demo", "organizer"], required: true },
    sourceLabel: { type: String, required: true },
    lastVerifiedAt: { type: String, required: true },
    freshUntil: { type: String, required: true, index: true },
    moderationStatus: { type: String, enum: ["draft", "pending", "approved", "rejected"], required: true, index: true },
    cancelledAt: String,
    cancellationReason: String,
    capacity: { type: Number, required: true, min: 1 },
    registeredCount: { type: Number, required: true, default: 0, min: 0 },
    speakers: { type: [SpeakerSchema], default: [] },
    schedule: { type: [ScheduleSchema], default: [] },
    recordings: { type: [RecordingSchema], default: [] },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { versionKey: false, timestamps: false },
);

EventSchema.index({ moderationStatus: 1, startsAt: 1 });
EventSchema.index({ topics: 1, location: 1, startsAt: 1 });
EventSchema.index({ title: "text", description: "text", overview: "text", topics: "text" });

const Event = models.Event || model<IEvent>("Event", EventSchema);
export default Event;
