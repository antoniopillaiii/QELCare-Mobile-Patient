import React, { useEffect, useMemo, useState } from "react";

// ============================================================================
// Shared pagination for the patient app — same API and behaviour as the
// website's components/common/Pagination.js so both platforms page identically:
// a footer with "Showing X to Y of Z" and Previous/Next, hidden entirely when
// everything fits on one page.
//
// Styling follows the mobile card look (ClinicUi palette) with 40px touch
// targets, and wraps to two lines on narrow screens.
// ============================================================================

const DEFAULT_PAGE_SIZE = 10;

function buttonStyle(disabled) {
  return {
    minHeight: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #e3ebf5",
    background: "#fff",
    color: "#163a6b",
    fontWeight: 800,
    fontSize: 13,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

// Client-side pagination for an already-loaded/filtered array.
//   `resetKey` — pass a filter/tab signature so changing it returns to page 1.
//   A plain data refresh must NOT change it, or the reader gets yanked back.
export function usePagination(items, pageSize = DEFAULT_PAGE_SIZE, resetKey) {
  // Memoised so a non-array/undefined `items` doesn't produce a fresh []
  // on every render and invalidate the slice below.
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  // Clamp rather than reset so a shrinking list lands on the last page.
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize]
  );

  return { page: safePage, totalPages, pageItems, setPage, pageSize, totalItems: list.length };
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  label = "entries",
}) {
  if (!totalPages || totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div
      style={{
        padding: 14,
        borderTop: "1px solid #eef3f9",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ color: "#6b778c", fontSize: 12, fontWeight: 800 }}>
        Showing {from} to {to} of {totalItems} {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        <span style={{ color: "#8a97a8", fontSize: 12, fontWeight: 800 }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          style={buttonStyle(page <= 1)}
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          style={buttonStyle(page >= totalPages)}
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
