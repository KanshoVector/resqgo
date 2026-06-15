import Link from "next/link";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { getEvacuationCenter } from "@/actions/evacuation-centers";
import { NativeMapDirectionsLink } from "@/components/NativeMapDirectionsLink";
import { buildInAppRouteHref } from "@/lib/navigation";
import { SHELTER_STATUS_COLORS, SHELTER_STATUS_LABELS } from "@/lib/geo";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EvacuationCenterPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getEvacuationCenter(id);

  if (!result.ok) {
    notFound();
  }

  const center = result.data;
  const routeHref = buildInAppRouteHref(center.location, center.name);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/?tab=search"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            地図に戻る
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <Building2 className="mt-1 h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{center.name}</h1>
              <span
                className="mt-2 inline-block rounded px-3 py-1 text-sm font-bold text-white"
                style={{
                  backgroundColor: SHELTER_STATUS_COLORS[center.facility_status],
                }}
              >
                {SHELTER_STATUS_LABELS[center.facility_status]}
              </span>
            </div>
          </div>

          {center.address && (
            <p className="mb-4 flex items-center gap-2 text-slate-700">
              <MapPin className="h-4 w-4 text-slate-500" />
              {center.address}
            </p>
          )}

          <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-semibold text-slate-600">収容可能人数</dt>
              <dd className="text-lg font-bold text-slate-900">
                {center.capacity ?? "—"} 名
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="font-semibold text-slate-600">現在の避難者数</dt>
              <dd className="text-lg font-bold text-slate-900">
                {center.current_occupancy} 名
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            {routeHref && (
              <Link
                href={routeHref}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500"
              >
                アプリ内で経路を表示
              </Link>
            )}
            <NativeMapDirectionsLink location={center.location} />
          </div>
        </article>
      </main>
    </div>
  );
}
