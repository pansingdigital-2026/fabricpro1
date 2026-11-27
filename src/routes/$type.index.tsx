import { createFileRoute, notFound } from "@tanstack/react-router";

import { ArchiveView } from "@/components/site/ArchiveView";
import { useSiteBootstrap } from "@/components/site/useSiteBootstrap";
import { fetchArchive } from "@/lib/public.functions";

const PER_PAGE = 12;

export const Route = createFileRoute("/$type/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps }) => {
    const result = await fetchArchive({
      data: { kind: "type", slug: params.type, page: deps.page, perPage: PER_PAGE },
    });
    if (result.total === 0 && deps.page > 1) throw notFound();
    return result;
  },
  head: ({ params }) => {
    const label = params.type.replace(/-/g, " ");
    const title = `${label.charAt(0).toUpperCase()}${label.slice(1)} | Fabric-Pro`;
    return {
      meta: [
        { title },
        { name: "description", content: `Latest ${label} stories and coverage.` },
        { property: "og:title", content: title },
        { property: "og:description", content: `Latest ${label} stories and coverage.` },
        { property: "og:url", content: `/${params.type}` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/${params.type}` }],
    };
  },
  component: TypeArchive,
  errorComponent: () => <p className="site-container site-section">This archive failed to load.</p>,
  notFoundComponent: () => <p className="site-container site-section">Archive not found.</p>,
});

function TypeArchive() {
  const { type } = Route.useParams();
  const { page } = Route.useSearch();
  const data = Route.useLoaderData();
  const bootstrap = useSiteBootstrap();
  const meta = bootstrap.contentTypes.find((t) => t.slug === type);

  return (
    <ArchiveView
      bootstrap={bootstrap}
      title={meta?.plural_name ?? type.replace(/-/g, " ")}
      description={meta?.description ?? null}
      items={data.items}
      total={data.total}
      page={page}
      perPage={PER_PAGE}
      buildHref={(n) => `/${type}?page=${n}`}
    />
  );
}
