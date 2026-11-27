import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

export function SiteSearchBox({ placeholder = "Search" }: { placeholder?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  return (
    <form
      className="site-searchbox"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        void navigate({ to: "/search", search: { q: value.trim(), page: 1 } });
      }}
    >
      <Search size={16} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search articles"
      />
    </form>
  );
}
