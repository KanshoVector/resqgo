"use client";

import { getGoogleMapsUrl } from "@/lib/navigation";

export function NativeMapDirectionsLink({ location }: { location: unknown }) {
  const url = getGoogleMapsUrl(location);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 underline hover:bg-blue-50"
    >
      Googleマップで経路を表示
    </a>
  );
}
