import { createFileRoute } from "@tanstack/react-router";

import { Btn, Empty, Panel, Table } from "@/components/admin/ui";
import { useRemove, useRows } from "@/lib/admin/api";
import { escapeCsvCell } from "@/lib/csv";

export const Route = createFileRoute("/admin/inbox")({
  component: Inbox,
});

interface Submission {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  created_at: string;
}

interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}

function Inbox() {
  const { data: messages = [] } = useRows<Submission>("contact_submissions", {
    order: { column: "created_at", ascending: false },
    limit: 100,
  });
  const { data: subscribers = [] } = useRows<Subscriber>("newsletter_subscribers", {
    order: { column: "created_at", ascending: false },
    limit: 200,
  });
  const removeMessage = useRemove("contact_submissions");
  const removeSubscriber = useRemove("newsletter_subscribers");

  return (
    <div className="space-y-4">
      <Panel title="Contact messages" description="Submissions from the contact form.">
        {messages.length === 0 ? (
          <Empty text="No messages yet." />
        ) : (
          <Table head={["From", "Subject", "Message", "Received", ""]}>
            {messages.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2">
                  <span className="block text-foreground">{m.name}</span>
                  <a href={`mailto:${m.email}`} className="text-[11px] text-muted-foreground">
                    {m.email}
                  </a>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m.subject ?? "—"}</td>
                <td className="max-w-md px-3 py-2 text-muted-foreground">{m.message}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Btn variant="ghost" onClick={() => removeMessage.mutate(m.id)}>
                    Delete
                  </Btn>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel
        title="Newsletter subscribers"
        description={`${subscribers.length} subscriber(s).`}
        actions={
          <Btn
            variant="outline"
            onClick={() => {
              const csv = ["email,subscribed_at"]
                .concat(
                  subscribers.map((s) => `${escapeCsvCell(s.email)},${escapeCsvCell(s.created_at)}`),
                )
                .join("\n");
              const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = "subscribers.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export CSV
          </Btn>
        }
      >
        {subscribers.length === 0 ? (
          <Empty text="No subscribers yet." />
        ) : (
          <Table head={["Email", "Subscribed", ""]}>
            {subscribers.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 text-foreground">{s.email}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Btn variant="ghost" onClick={() => removeSubscriber.mutate(s.id)}>
                    Remove
                  </Btn>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
