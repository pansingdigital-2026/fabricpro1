import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Btn, Empty, Field, Panel, SelectInput, Table, TextInput } from "@/components/admin/ui";
import { useRemove, useRows, useSave } from "@/lib/admin/api";
import type { Redirect } from "@/lib/types";

export const Route = createFileRoute("/admin/redirects")({
  component: Redirects,
});

function Redirects() {
  const { data: rows = [] } = useRows<Redirect>("redirects", {
    order: { column: "source_path" },
  });
  const save = useSave("redirects");
  const remove = useRemove("redirects");
  const [draft, setDraft] = useState({ source_path: "", destination_path: "", kind: "301" });

  return (
    <Panel title="Redirects" description="Preserve SEO when URLs change.">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Field label="From">
          <TextInput
            value={draft.source_path}
            placeholder="/old-url"
            onChange={(e) => setDraft({ ...draft, source_path: e.target.value })}
          />
        </Field>
        <Field label="To">
          <TextInput
            value={draft.destination_path}
            placeholder="/new-url"
            onChange={(e) => setDraft({ ...draft, destination_path: e.target.value })}
          />
        </Field>
        <Field label="Type">
          <SelectInput
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          >
            <option value="301">301 permanent</option>
            <option value="302">302 temporary</option>
          </SelectInput>
        </Field>
        <Btn
          onClick={() => {
            if (!draft.source_path || !draft.destination_path) return;
            save.mutate({ ...draft, enabled: true });
            setDraft({ source_path: "", destination_path: "", kind: "301" });
          }}
        >
          Add
        </Btn>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <Empty text="No redirects yet." />
        ) : (
          <Table head={["From", "To", "Type", "Enabled", ""]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-foreground">{row.source_path}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.destination_path}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.kind}</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => save.mutate({ id: row.id, enabled: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Btn variant="ghost" onClick={() => remove.mutate(row.id)}>
                    Delete
                  </Btn>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </Panel>
  );
}
