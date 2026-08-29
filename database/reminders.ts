import connectDB from "@/lib/mongodb";
import Event from "./event.model";
import ReminderOutbox from "./reminder.model";

export async function processReminderOutbox(limit = 10) {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for durable reminder delivery.");
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL) {
    throw new Error("RESEND_API_KEY and REMINDER_FROM_EMAIL are required for reminder delivery.");
  }
  await connectDB();
  const results: Array<{ id: string; status: "sent" | "failed" }> = [];
  for (let index = 0; index < Math.min(limit, 25); index += 1) {
    const now = new Date();
    const item = await ReminderOutbox.findOneAndUpdate(
      {
        status: "pending",
        sendAfter: { $lte: now },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
      },
      { $set: { status: "processing", leaseUntil: new Date(now.getTime() + 5 * 60_000) }, $inc: { attempts: 1 } },
      { new: true, sort: { sendAfter: 1 } },
    );
    if (!item) break;
    const event = await Event.findOne({ slug: item.eventSlug }).lean();
    if (!event) {
      await ReminderOutbox.updateOne({ _id: item._id }, { status: "failed", lastError: "Event no longer exists." });
      results.push({ id: String(item._id), status: "failed" });
      continue;
    }
    const isCancellation = item.kind === "cancellation";
    const subject = isCancellation ? `[DEMO] Cancelled: ${event.title}` : `[DEMO] Reminder: ${event.title}`;
    const text = isCancellation
      ? `${event.title} was cancelled. Reason: ${event.cancellationReason ?? "No reason supplied."}\n\nThis message concerns explicit DevEvent portfolio demo data.`
      : `${event.title} starts at ${event.startsAt} (${event.timezone}) at ${event.venue}, ${event.location}.\n\nThis message concerns explicit DevEvent portfolio demo data.`;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `devevent-${item._id}` },
        body: JSON.stringify({ from: process.env.REMINDER_FROM_EMAIL, to: [item.recipient], subject, text }),
      });
      if (!response.ok) throw new Error(`Resend returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
      await ReminderOutbox.updateOne({ _id: item._id, status: "processing" }, { status: "sent", sentAt: new Date(), $unset: { leaseUntil: 1, lastError: 1 } });
      results.push({ id: String(item._id), status: "sent" });
    } catch (error) {
      const failed = item.attempts >= 5;
      await ReminderOutbox.updateOne(
        { _id: item._id, status: "processing" },
        { status: failed ? "failed" : "pending", lastError: error instanceof Error ? error.message : "Unknown delivery error", $unset: { leaseUntil: 1 } },
      );
      results.push({ id: String(item._id), status: "failed" });
    }
  }
  return results;
}
