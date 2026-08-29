import { Schema, model, models, type HydratedDocument } from "mongoose";
import type { RegistrationRecord } from "./types";

export type IBooking = RegistrationRecord;
export type RegistrationDocument = HydratedDocument<IBooking>;

const RegistrationSchema = new Schema<IBooking>(
  {
    id: { type: String, required: true, unique: true },
    eventSlug: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    publicProfile: { type: Boolean, required: true, default: false },
    reminderOptIn: { type: Boolean, required: true, default: false },
    cancellationTokenHash: { type: String, required: true },
    status: { type: String, enum: ["active", "cancelled"], required: true, default: "active" },
    createdAt: { type: String, required: true },
    cancelledAt: String,
  },
  { versionKey: false },
);

RegistrationSchema.index(
  { eventSlug: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "uniq_active_event_email" },
);
RegistrationSchema.index({ eventSlug: 1, status: 1, publicProfile: 1 });

const Registration = models.Registration || model<IBooking>("Registration", RegistrationSchema);
export default Registration;
