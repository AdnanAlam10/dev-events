"use client";

import { useState } from "react";

export default function RegistrationForm({ slug, disabled, emailDeliveryEnabled }: { slug: string; disabled: boolean; emailDeliveryEnabled: boolean }) {
  const [message, setMessage] = useState("");
  const [cancellation, setCancellation] = useState<{ registrationId: string; cancellationToken: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function register(formData: FormData) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/events/${slug}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        publicProfile: formData.get("publicProfile") === "on",
        reminderOptIn: formData.get("reminderOptIn") === "on",
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error);
    setCancellation({ registrationId: result.registration.id, cancellationToken: result.cancellationToken });
    setMessage(emailDeliveryEnabled
      ? "Registration confirmed. Save this cancellation control; your opted-in reminder is queued."
      : "Registration confirmed in ephemeral demo mode. Save this cancellation control; email delivery is unavailable until Atlas and Resend are configured.");
  }

  async function cancel() {
    if (!cancellation) return;
    setBusy(true);
    const response = await fetch(`/api/events/${slug}/registrations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cancellation),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error);
    setCancellation(null);
    setMessage("Registration cancelled and the capacity slot was released.");
  }

  if (disabled) return <p className="rounded-lg border border-white/10 p-4">Registration is not available for this event.</p>;
  return (
    <div id="book-event" className="signup-card">
      <h2>Free demo registration</h2>
      <p className="text-sm text-light-200">Your email remains private and is never included in organizer analytics.</p>
      {!cancellation ? (
        <form action={register}>
          <div><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
          <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
          <label className="flex items-start gap-2 text-sm"><input name="publicProfile" type="checkbox" className="mt-1" /> Allow an anonymous public attendee count.</label>
          <label className="flex items-start gap-2 text-sm"><input name="reminderOptIn" type="checkbox" className="mt-1" disabled={!emailDeliveryEnabled} /> {emailDeliveryEnabled ? "Email me a reminder before this event." : "Email reminders require Atlas and Resend configuration."}</label>
          <button disabled={busy}>{busy ? "Registering…" : "Register"}</button>
        </form>
      ) : (
        <button onClick={cancel} disabled={busy} className="rounded-md bg-red-300 px-4 py-3 font-semibold text-black">
          {busy ? "Cancelling…" : "Cancel my registration"}
        </button>
      )}
      {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
    </div>
  );
}
