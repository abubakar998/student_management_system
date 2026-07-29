"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Programme = { id: string; name: string };

const STATUSES = ["ENROLLED", "DEFERRED", "WITHDRAWN", "COMPLETED"] as const;

/**
 * Filters write to the URL rather than to component state, so a filtered
 * roster can be bookmarked, shared with a colleague, or reloaded — which is
 * how a registry team actually works. It also keeps the query server-side.
 */
export function StudentFilters({ programmes }: { programmes: Programme[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(next: Record<string, string | undefined>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    search.delete("page"); // a new filter always starts at page 1
    startTransition(() => router.push(`/students?${search.toString()}`));
  }

  const status = params.get("status") ?? "";
  const programmeId = params.get("programmeId") ?? "";
  const hasFilters = Boolean(q || status || programmeId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, student ID or email"
          className="w-64"
          aria-label="Search students"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          Search
        </Button>
      </form>

      <select
        value={programmeId}
        onChange={(e) => apply({ programmeId: e.target.value || undefined })}
        aria-label="Filter by programme"
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
      >
        <option value="">All programmes</option>
        {programmes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value || undefined })}
        aria-label="Filter by status"
        className="border-input bg-background h-9 rounded-md border px-3 text-sm"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </option>
        ))}
      </select>

      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            startTransition(() => router.push("/students"));
          }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}
