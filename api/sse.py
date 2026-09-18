"""Shared headers for Server-Sent Events endpoints."""

# Every SSE response must send these headers.
#
# no-transform: intermediaries (e.g. the Next.js proxy) must not compress or
# buffer the stream. Gzip buffering holds chunks until the stream ends, which
# silently kills per-token streaming — the whole answer arrives at once.
SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}
