import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Btn, Empty, Field, Panel, SelectInput, Table, TextInput } from "@/components/admin/ui";
import { useRemove, useRows, useSave } from "@/lib/admin/api";
import type { MenuItem } from "@/lib/types";

export const Route = createFileRoute("/admin/menus")({
  component: Menus,
});

interface MenuRow {
  id: string;
  slug: string;
  name: string;
}

function Menus() {
  const { data: menus = [] } = useRows<MenuRow>("menus", { order: { column: "name" } });
  const [menuId, setMenuId] = useState("");
  const active = menuId || menus[0]?.id || "";

  const { data: items = [] } = useRows<MenuItem>("menu_items", {
    order: { column: "position" },
    eq: { menu_id: active },
  });
  const save = useSave("menu_items");
  const remove = useRemove("menu_items");
  const [draft, setDraft] = useState({ label: "", url: "", target: "_self" });

  return (
    <Panel title="Menus" description="Header and footer navigation links.">
      <div className="mb-4 max-w-xs">
        <Field label="Menu">
          <SelectInput value={active} onChange={(e) => setMenuId(e.target.value)}>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Field label="Label">
          <TextInput
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </Field>
        <Field label="URL">
          <TextInput
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder="/blog"
          />
        </Field>
        <Field label="Target">
          <SelectInput
            value={draft.target}
            onChange={(e) => setDraft({ ...draft, target: e.target.value })}
          >
            <option value="_self">Same tab</option>
            <option value="_blank">New tab</option>
          </SelectInput>
        </Field>
        <Btn
          onClick={() => {
            if (!draft.label || !active) return;
            save.mutate({
              menu_id: active,
              label: draft.label,
              url: draft.url || "/",
              target: draft.target,
              position: items.length + 1,
            });
            setDraft({ label: "", url: "", target: "_self" });
          }}
        >
          Add link
        </Btn>
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <Empty text="No links in this menu." />
        ) : (
          <Table head={["Label", "URL", "Position", ""]}>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-foreground">{item.label}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.url}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  <div className="flex gap-1">
                    <Btn
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => {
                        const prev = items[index - 1];
                        if (!prev) return;
                        save.mutate({ id: item.id, position: prev.position });
                        save.mutate({ id: prev.id, position: item.position });
                      }}
                    >
                      ↑
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={index === items.length - 1}
                      onClick={() => {
                        const next = items[index + 1];
                        if (!next) return;
                        save.mutate({ id: item.id, position: next.position });
                        save.mutate({ id: next.id, position: item.position });
                      }}
                    >
                      ↓
                    </Btn>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Btn variant="ghost" onClick={() => remove.mutate(item.id)}>
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
