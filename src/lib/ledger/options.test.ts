import { describe, expect, it } from "vitest";
import { optionsFromQuestion } from "./options";

describe("optionsFromQuestion", () => {
  it('splits on " or " and drops the trailing question mark', () => {
    expect(optionsFromQuestion("Pin zod 4.4.3 or leave it unpinned?")).toEqual(["Pin zod 4.4.3", "leave it unpinned"]);
  });

  it('splits on " vs "', () => {
    expect(optionsFromQuestion("Redis vs in-memory?")).toEqual(["Redis", "in-memory"]);
    expect(optionsFromQuestion("Redis vs. in-memory")).toEqual(["Redis", "in-memory"]);
  });

  it('splits on " versus "', () => {
    expect(optionsFromQuestion("WebSockets versus polling?")).toEqual(["WebSockets", "polling"]);
  });

  it('splits on " / "', () => {
    expect(optionsFromQuestion("Which runtime: node / bun / deno?")).toEqual(["node", "bun", "deno"]);
  });

  it("keeps only the text after the last colon in a comma list", () => {
    expect(
      optionsFromQuestion("How is the app gated: a cookie, Deployment Protection, or Cloudflare Access?"),
    ).toEqual(["a cookie", "Deployment Protection", "Cloudflare Access"]);
  });

  it("the D1 question yields its three candidates", () => {
    expect(
      optionsFromQuestion(
        "How is the reader app itself gated: a shared access key exchanged for an httpOnly session cookie, Vercel Deployment Protection, or Cloudflare Access?",
      ),
    ).toEqual([
      "a shared access key exchanged for an httpOnly session cookie",
      "Vercel Deployment Protection",
      "Cloudflare Access",
    ]);
  });

  it("more than four candidates yields none", () => {
    expect(optionsFromQuestion("Pick one: a1, b2, c3, d4, or e5?")).toEqual([]);
  });

  it("fragments under two characters are dropped", () => {
    expect(optionsFromQuestion("a or bb?")).toEqual([]);
    expect(optionsFromQuestion("Which: aa, b, or cc?")).toEqual(["aa", "cc"]);
  });

  it("a question with no separator yields none", () => {
    expect(optionsFromQuestion("Should we ship?")).toEqual([]);
    expect(optionsFromQuestion("")).toEqual([]);
    expect(optionsFromQuestion(null)).toEqual([]);
  });

  it("does not split words like 'for' or 'oracle'", () => {
    expect(optionsFromQuestion("Use the oracle for scoring?")).toEqual([]);
  });
});
