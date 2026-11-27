import { createFileRoute, notFound } from "@tanstack/react-router";

import { ArchiveView } from "@/components/site/ArchiveView";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import { fetchArchive } from "@/lib/public.functions";

const PER_PAGE = 12;
const KIND = "tag" as const;

export const Route = createFileRoute("/tag/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps }) => {
    const result = await fetchArchive({
      data: { kind: KIND, slug: params.slug, page: deps.page, perPage: PER_PAGE },
    });
    if (!result.meta) throw notFound();
    return result;
  },
  head: ({ params, loaderData }) => {
    const meta = loaderData?.meta as {
      name?: string;
      seo?: { title?: string; description?: string };
    } | null;
    const title = `${meta?.seo?.title || meta?.name || params.slug.replace(/-/g, " ")} | Fabric-Pro Topics`;
    const description =
      meta?.seo?.description || `Stories filed under ${meta?.name ?? params.slug}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `/tag/${params.slug}` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/tag/${params.slug}` }],
    };
  },
  component: ArchivePage,
  errorComponent: () => <p className="site-container site-section">This page failed to load.</p>,
  notFoundComponent: () => <p className="site-container site-section">Nothing found here.</p>,
});

function ArchivePage() {
  const { slug } = Route.useParams();
  const { page } = Route.useSearch();
  const data = Route.useLoaderData();
  const bootstrap = useSiteBootstrap();
  const meta = data.meta as {
    name?: string;
    description?: string | null;
    bio?: string | null;
  } | null;

  return (
    <ArchiveView
      bootstrap={bootstrap}
      title={meta?.name ?? slug.replace(/-/g, " ")}
      description={meta?.description ?? meta?.bio ?? null}
      items={data.items}
      total={data.total}
      page={page}
      perPage={PER_PAGE}
      buildHref={(n) => `/tag/${slug}?page=${n}`}
      taxonomy="tag"
      activeSlug={slug}
    />
  );
}
