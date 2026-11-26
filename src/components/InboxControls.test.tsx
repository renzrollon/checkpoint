import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InboxControls } from "./InboxControls";

describe("InboxControls", () => {
  it("has a GET Branch form with the repo as a hidden input", () => {
    const { container } = render(<InboxControls repo="a/b" repos={["a/b"]} />);
    const form = container.querySelector("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(screen.getByLabelText("Branch")).toBeTruthy();
    const hidden = container.querySelector(
      'input[type="hidden"]',
    ) as HTMLInputElement;
    expect([hidden.name, hidden.value]).toEqual(["repo", "a/b"]);
    expect(screen.queryByRole("navigation", { name: "Repository" })).toBeNull();
  });

  it("lists repositories as links without ref, marking the current one", () => {
    render(<InboxControls repo="a/b" repos={["a/b", "c/d"]} />);
    const current = screen.getByRole("link", { name: "a/b" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.getAttribute("href")).toBe("/?repo=a%2Fb");
    const other = screen.getByRole("link", { name: "c/d" });
    expect(other.getAttribute("aria-current")).toBeNull();
    expect(other.getAttribute("href")).toBe("/?repo=c%2Fd");
  });
});
