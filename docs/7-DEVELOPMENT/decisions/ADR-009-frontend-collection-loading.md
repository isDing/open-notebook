# ADR-009: Defer dialog work and cache the source library

- **Status**: Accepted
- **Date**: 2026-09-20

## Context

Dashboard providers eagerly mounted source, note, and podcast dialogs, including
their data hooks and editor dependencies, even when no dialog was open. The source
library managed offset pagination and sorting with shared mutable refs, allowing
late responses from an old sort to overwrite current results. Hovering rows also
re-rendered the entire page.

## Decision

- Use Next.js dynamic imports and a shared `DeferredMount` boundary for dialogs.
  Load on first use; retain mounted state afterward to preserve drafts and pending
  work. Keep query-driven modal URLs and existing creation entry points.
- Use a TanStack infinite query for the source library. Include sort in the cache
  key, forward its abort signal to the existing API client, and use the existing
  sources key prefix so mutations continue to invalidate the library.
- Disable automatic retries for the new query. Preserve loaded pages on failure;
  expose manual retry. Deduplicate overlapping offset pages by source ID.
- Use IntersectionObserver for pagination, with a manual load-more control. Keep
  search and type filters local to loaded pages, as before; no new backend API.
- Keep row hover in CSS. Defer collection search updates and skip offscreen
  notebook painting using native content visibility rather than adding a list
  virtualization dependency.
- Prefetch sidebar and collection routes on hover or focus through a shared
  navigation link instead of downloading every visible destination on entry.
- Retain the blue/slate palette and dark tokens; use white light-mode surfaces for
  clearer separation from the canvas. Share title, empty-state, search and loading
  treatments, and respect reduced-motion preferences.

## Alternatives considered

Eager mounting keeps first-open latency low but burdens every route with unused
code and queries. Unmounting every closed dialog drops drafts and can interrupt
pending work. A new virtualization package adds complexity before it is needed.

## Consequences

First-use dialogs incur a chunk request; subsequent opens preserve existing form
semantics. Local source filtering is still limited to fetched data (pagination
continues while its sentinel is visible). Offset pagination can still miss items
when the server collection changes between requests; deduplication prevents
duplicate rows but is not a substitute for backend cursor pagination.

No dependency, schema, authentication, or deployment changes are required.
