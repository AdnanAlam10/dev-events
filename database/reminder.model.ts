import { Schema, model, models, type InferSchemaType } from "mongoose";

const ReminderSchema = new Schema(
  {
    registrationId: { type: String, required: true },
    kind: { type: String, enum: ["reminder", "cancellation"], required: true },
    eventSlug: { type: String, required: true, index: true },
    recipient: { type: String, required: true },
    sendAfter: { type: Date, required: true, index: true },
    status: { type: String, enum: ["pending", "processing", "sent", "cancelled", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    leaseUntil: Date,
    sentAt: Date,
    lastError: String,
  },
  { timestamps: true },
);
ReminderSchema.index({ status: 1, sendAfter: 1, leaseUntil: 1 });
ReminderSchema.index({ registrationId: 1, kind: 1 }, { unique: true });

export type ReminderOutboxRecord = InferSchemaType<typeof ReminderSchema>;
const ReminderOutbox = models.ReminderOutbox || model("ReminderOutbox", ReminderSchema);
export default ReminderOutbox;
