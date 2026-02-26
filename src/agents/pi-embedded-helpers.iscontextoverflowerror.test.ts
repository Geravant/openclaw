import { describe, expect, it } from "vitest";
import { isContextOverflowError } from "./pi-embedded-helpers.js";

describe("isContextOverflowError", () => {
  it("matches known overflow hints", () => {
    const samples = [
      "request_too_large",
      "Request exceeds the maximum size",
      "context length exceeded",
      "Maximum context length",
      "prompt is too long: 208423 tokens > 200000 maximum",
      "Context overflow: Summarization failed",
      "413 Request Entity Too Large",
    ];
    for (const sample of samples) {
      expect(isContextOverflowError(sample)).toBe(true);
    }
  });

  it("matches Anthropic 'Request size exceeds model context window' error", () => {
    // Anthropic returns this error format when the prompt exceeds the context window.
    // Without this fix, auto-compaction is NOT triggered because neither
    // isContextOverflowError nor pi-ai's isContextOverflow recognizes this pattern.
    // The user sees: "LLM request rejected: Request size exceeds model context window"
    // instead of automatic compaction + retry.
    const anthropicRawError =
      '{"type":"error","error":{"type":"invalid_request_error","message":"Request size exceeds model context window"}}';
    expect(isContextOverflowError(anthropicRawError)).toBe(true);
  });

  it("matches 'exceeds model context window' in various formats", () => {
    const samples = [
      "Request size exceeds model context window",
      "request size exceeds model context window",
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Request size exceeds model context window"}}',
      "The request size exceeds model context window limit",
    ];
    for (const sample of samples) {
      expect(isContextOverflowError(sample)).toBe(true);
    }
  });

  it("matches Anthropic 'extra usage is required' 429 error", () => {
    // Anthropic returns HTTP 429 with this message when context is too large.
    // Without this, the error is classified as rate_limit (retry forever)
    // instead of context_overflow (compact + retry).
    const samples = [
      "Extra usage is required for long context requests",
      '429 {"type":"error","error":{"type":"request_too_large","message":"Extra usage is required for long context requests. See https://docs.anthropic.com/en/docs/about-claude/models#extended-context-window"}}',
      "extra usage is required",
    ];
    for (const sample of samples) {
      expect(isContextOverflowError(sample)).toBe(true);
    }
  });

  it("ignores unrelated errors", () => {
    expect(isContextOverflowError("rate limit exceeded")).toBe(false);
    expect(isContextOverflowError("request size exceeds upload limit")).toBe(false);
    expect(isContextOverflowError("model not found")).toBe(false);
    expect(isContextOverflowError("authentication failed")).toBe(false);
  });
});
