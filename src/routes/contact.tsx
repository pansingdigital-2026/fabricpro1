import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { SiteShell } from "@/components/site/SiteShell";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import { submitContactForm } from "@/lib/public.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | Fabric-Pro" },
      {
        name: "description",
        content: "Contact the Fabric-Pro editorial desk for news tips, corrections, and partnerships.",
      },
      { property: "og:title", content: "Contact | Fabric-Pro" },
      {
        property: "og:description",
        content: "Contact the Fabric-Pro editorial desk for news tips, corrections, and partnerships.",
      },
      { property: "og:url", content: "/contact" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
  errorComponent: () => <p className="site-container site-section">This page failed to load.</p>,
  notFoundComponent: () => <p className="site-container site-section">Page not found.</p>,
});

function ContactPage() {
  const bootstrap = useSiteBootstrap();
  const send = useServerFn(submitContactForm);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  return (
    <SiteShell bootstrap={bootstrap}>
      <div className="site-container-narrow site-section">
        <h1 className="site-page-title">Contact</h1>
        <p className="site-archive-description">
          Story tips, corrections, and partnership enquiries reach the desk here.
        </p>

        <form
          className="site-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            setStatus("sending");
            try {
              await send({
                data: {
                  name: String(fd.get("name") ?? ""),
                  email: String(fd.get("email") ?? ""),
                  subject: String(fd.get("subject") ?? ""),
                  message: String(fd.get("message") ?? ""),
                  website: String(fd.get("website") ?? ""),
                },
              });
              setStatus("sent");
              setMessage("Thanks — your message is with the desk.");
              form.reset();
            } catch (err) {
              setStatus("error");
              setMessage(err instanceof Error ? err.message : "Something went wrong.");
            }
          }}
        >
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" type="email" required maxLength={255} />
          </label>
          <label>
            Subject
            <input name="subject" maxLength={150} />
          </label>
          <label>
            Message
            <textarea name="message" required minLength={5} maxLength={4000} />
          </label>
          <input className="site-honeypot" name="website" tabIndex={-1} autoComplete="off" />
          <button className="site-button" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send message"}
          </button>
          {message ? <p className="site-form-status">{message}</p> : null}
        </form>
      </div>
    </SiteShell>
  );
}
