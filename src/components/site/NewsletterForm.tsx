import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { subscribeNewsletter } from "@/lib/public.functions";

export function NewsletterForm({ cta = "Subscribe" }: { cta?: string }) {
  const subscribe = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  return (
    <form
      className="site-newsletter"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("sending");
        try {
          await subscribe({ data: { email } });
          setStatus("done");
          setEmail("");
        } catch {
          setStatus("error");
        }
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        aria-label="Email address"
      />
      <button type="submit" className="site-button" disabled={status === "sending"}>
        {status === "sending" ? "Subscribing…" : cta}
      </button>
      {status === "done" ? <p className="site-form-status">You’re subscribed.</p> : null}
      {status === "error" ? <p className="site-form-status">That didn’t work — try again.</p> : null}
    </form>
  );
}
