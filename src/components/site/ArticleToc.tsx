import { useEffect, useState } from "react";

import type { TocEntry } from "@/lib/toc";

export function ArticleToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string>(entries[0]?.id ?? "");

  useEffect(() => {
    if (!entries.length) return;
    const headings = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!headings.length) return;

    const onScroll = () => {
      let current = headings[0]!.id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= 140) current = h.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [entries]);

  if (!entries.length) return null;

  return (
    <nav className="site-toc" aria-label="On this page">
      <p className="site-toc-title">On this page</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={entry.id === active ? "is-active" : ""}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(entry.id);
                if (!el) return;
                window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100 });
                setActive(entry.id);
              }}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
