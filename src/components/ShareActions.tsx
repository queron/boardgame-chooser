"use client";

import { useMemo, useState } from "react";

export function ShareActions({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => {
    if (typeof window === "undefined") return `/n/${slug}`;
    return `${window.location.origin}/n/${slug}`;
  }, [slug]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={copy}
        className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
      >
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </div>
  );
}
