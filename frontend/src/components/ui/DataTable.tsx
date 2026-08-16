"use client";

import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  /** Cell contents. */
  render: (row: T) => ReactNode;
  /** Value used when sorting on this column; omit to make it unsortable. */
  sortValue?: (row: T) => number | string;
  align?: "left" | "right";
  className?: string;
  /** Applied to the header cell — set a width here to size the whole column. */
  headerClassName?: string;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Free-text search reads these fields off each row. */
  searchFields?: (row: T) => string[];
  searchPlaceholder?: string;
  filters?: { options: FilterOption[]; predicate: (row: T, value: string) => boolean };
  /** Preselects a filter chip — used when another screen deep-links here. */
  initialFilter?: string;
  initialSort?: { key: string; direction: "asc" | "desc" };
  pageSize?: number;
  emptyMessage?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchFields,
  searchPlaceholder = "Search…",
  filters,
  initialFilter,
  initialSort,
  pageSize = 15,
  emptyMessage = "Nothing to show.",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState(initialFilter ?? "all");
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  const visible = useMemo(() => {
    let result = rows;

    if (filters && filterValue !== "all") {
      result = result.filter((row) => filters.predicate(row, filterValue));
    }

    const needle = query.trim().toLowerCase();
    if (needle && searchFields) {
      result = result.filter((row) =>
        searchFields(row).some((field) => field.toLowerCase().includes(needle)),
      );
    }

    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column?.sortValue) {
        const factor = sort.direction === "asc" ? 1 : -1;
        result = [...result].sort((a, b) => {
          const av = column.sortValue!(a);
          const bv = column.sortValue!(b);
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
          return String(av).localeCompare(String(bv)) * factor;
        });
      }
    }

    return result;
  }, [rows, columns, filters, filterValue, query, searchFields, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" },
    );
  }

  return (
    <div>
      {(searchFields || filters) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {searchFields && (
            <div className="relative min-w-[220px] flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] py-2 pl-9 pr-3 text-[13px] text-text-primary outline-none placeholder:text-text-muted focus:border-[var(--series-1)]"
              />
            </div>
          )}

          {filters && (
            <div className="flex flex-wrap gap-1.5">
              {[{ value: "all", label: "All" }, ...filters.options].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFilterValue(option.value);
                    setPage(0);
                  }}
                  className={clsx(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                    filterValue === option.value
                      ? "bg-[var(--series-1)] text-white"
                      : "border border-[var(--border-hairline)] text-text-secondary hover:bg-[var(--surface-2)]",
                  )}
                >
                  {option.label}
                  {option.count !== undefined && (
                    <span className="ml-1 opacity-70">{option.count.toLocaleString()}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-text-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={clsx(
                    "pb-2 pr-3 font-medium",
                    column.align === "right" && "text-right",
                    column.headerClassName,
                  )}
                >
                  {column.sortValue ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={clsx(
                        "inline-flex items-center gap-1 hover:text-text-primary",
                        sort?.key === column.key && "text-[var(--series-1)]",
                      )}
                    >
                      {column.header}
                      <ChevronsUpDown size={11} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {pageRows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-[var(--surface-2)]">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      "py-2.5 pr-3 text-[13px] text-text-secondary",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {pageRows.length === 0 && <p className="py-8 text-center text-[13px] text-text-muted">{emptyMessage}</p>}
      </div>

      {visible.length > pageSize && (
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3 text-[12px] text-text-muted">
          <span className="tabular-nums">
            {(safePage * pageSize + 1).toLocaleString()}–
            {Math.min((safePage + 1) * pageSize, visible.length).toLocaleString()} of{" "}
            {visible.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-hairline)] disabled:opacity-40 enabled:hover:bg-[var(--surface-2)]"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-hairline)] disabled:opacity-40 enabled:hover:bg-[var(--surface-2)]"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
