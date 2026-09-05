import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("shows raw HTML as text and never creates a script element", () => {
    const { container } = render(<Markdown text={"Intro\n\n<script>alert(1)</script>\n\nAfter"} />);
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(document.querySelector("script")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("opens links in a new tab with rel noopener noreferrer", () => {
    render(<Markdown text={"See [the brief](https://example.test/brief)."} />);
    const link = screen.getByRole("link", { name: "the brief" });
    expect(link.getAttribute("href")).toBe("https://example.test/brief");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders tables and task lists", () => {
    const { container } = render(
      <Markdown text={"| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] open\n"} />,
    );
    expect(container.querySelector(".md-scroll table")).not.toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
  });
});
