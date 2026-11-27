import { Facebook, Instagram, Linkedin, Mail, Twitter } from "lucide-react";
import { useEffect, useState } from "react";

const DEFAULT_VISIBILITY: Record<string, boolean> = {
  instagram: true,
  linkedin: true,
  email: true,
  x: false,
  facebook: false,
};

export function ShareRail({
  title,
  social,
  visibility,
}: {
  title: string;
  social?: Record<string, string> | undefined;
  visibility?: Record<string, boolean> | undefined;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);

  const show = (key: string) => (visibility?.[key] ?? DEFAULT_VISIBILITY[key]) === true;

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(title);

  const links = [
    ...(show("instagram")
      ? [
          {
            key: "instagram",
            label: "Instagram",
            href: social?.["instagram"] || "https://www.instagram.com/",
            Icon: Instagram,
          },
        ]
      : []),
    ...(show("linkedin")
      ? [
          {
            key: "linkedin",
            label: "Share on LinkedIn",
            href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
            Icon: Linkedin,
          },
        ]
      : []),
    ...(show("email")
      ? [
          {
            key: "email",
            label: "Share by email",
            href: `mailto:?subject=${text}&body=${encoded}`,
            Icon: Mail,
          },
        ]
      : []),
    ...(show("x")
      ? [
          {
            key: "x",
            label: "Share on X",
            href: `https://twitter.com/intent/tweet?url=${encoded}&text=${text}`,
            Icon: Twitter,
          },
        ]
      : []),
    ...(show("facebook")
      ? [
          {
            key: "facebook",
            label: "Share on Facebook",
            href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
            Icon: Facebook,
          },
        ]
      : []),
  ];

  if (links.length === 0) return null;

  return (
    <aside className="site-share-rail" aria-label="Share this article">
      {links.map(({ key, label, href, Icon }) => (
        <a key={key} href={href} target="_blank" rel="noreferrer noopener" aria-label={label}>
          <Icon size={18} />
        </a>
      ))}
    </aside>
  );
}
