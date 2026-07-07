import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

/**
 * Reusable client-side sortable-table primitives for admin tables.
 *
 * Usage:
 *   const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(rows, {
 *     initial: { key: "createdAt", dir: "desc" },
 *     accessors: { region: (r) => r.region ?? "" },
 *   });
 *   ...
 *   <SortableHeader label="Name" colKey="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
 *
 * Sorting rules:
 *   - Numbers compare numerically
 *   - Dates (Date objects or ISO strings) compare chronologically
 *   - Everything else uses natural-string compare (case-insensitive, numeric-aware:
 *     "Event 2" < "Event 10")
 *   - null/undefined always sort to the end regardless of direction
 */
export type SortDir = "asc" | "desc";

type Accessor<T> = (row: T) => unknown;

interface UseSortableOptions<T> {
  initial?: { key: string; dir?: SortDir };
  /** Per-column value extractor override — use when the raw field isn't
      what you'd sort on (e.g. formatted date strings, computed columns).
      Key names are free-form strings so consumers can sort on virtual
      "columns" that aren't literal fields (e.g. "status" derived from
      isPublished, or "publishedAt" fallback-chained with createdAt). */
  accessors?: Record<string, Accessor<T>>;
}

export function useSortableTable<T>(
  rows: T[],
  opts: UseSortableOptions<T> = {},
) {
  const [sortKey, setSortKey] = useState<string | null>(opts.initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(opts.initial?.dir ?? "asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const accessor = opts.accessors?.[sortKey] ?? ((r: T) => (r as Record<string, unknown>)[sortKey]);
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(accessor(a), accessor(b)));
  }, [rows, sortKey, sortDir, opts.accessors]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      // Cycle asc → desc → back to asc on third click.
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return { sorted, sortKey, sortDir, toggleSort };
}

function compareValues(a: unknown, b: unknown): number {
  // Nulls always sink to the bottom regardless of asc/desc.
  const aNull = a === null || a === undefined || a === "";
  const bNull = b === null || b === undefined || b === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);

  // Try ISO date parsing before falling back to string compare — a lot of
  // admin columns are text-typed date strings ("2026-06-19"), and users
  // expect them to sort chronologically not lexically.
  if (typeof a === "string" && typeof b === "string") {
    const isoRe = /^\d{4}-\d{2}-\d{2}(T|$)/;
    if (isoRe.test(a) && isoRe.test(b)) {
      const at = Date.parse(a);
      const bt = Date.parse(b);
      if (!Number.isNaN(at) && !Number.isNaN(bt)) return at - bt;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

interface SortableHeaderProps<K extends string> {
  label: string;
  colKey: K;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: K) => void;
  className?: string;
  /** Column can't be sorted — renders as a normal <th> with no click state. */
  disabled?: boolean;
  align?: "left" | "right" | "center";
}

export function SortableHeader<K extends string>({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  className = "",
  disabled = false,
  align = "left",
}: SortableHeaderProps<K>) {
  if (disabled) {
    return <th className={className}>{label}</th>;
  }
  const active = sortKey === colKey;
  const alignCls = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th className={`${className} select-none`} data-testid={`sort-th-${colKey}`}>
      <button
        onClick={() => onSort(colKey)}
        className={`w-full inline-flex items-center gap-1 ${alignCls} hover:text-white transition-colors cursor-pointer`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        data-testid={`sort-btn-${colKey}`}
      >
        <span>{label}</span>
        {active ? (
          sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />
        )}
      </button>
    </th>
  );
}
