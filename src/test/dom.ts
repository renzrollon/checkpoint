import { screen, within } from "@testing-library/react";

/**
 * Match an element whose full text content (descendants included) is `text`,
 * choosing the innermost such element. `getByText` only looks at an element's
 * own text nodes, which misses readings whose value and denominator are
 * separate spans.
 */
export function byFullText(text: string, root: HTMLElement = document.body): HTMLElement {
  const matches = within(root)
    .queryAllByText((_, el) => el?.textContent?.replace(/\s+/g, " ").trim() === text)
    .filter((el) => !Array.from(el.children).some((c) => c.textContent?.replace(/\s+/g, " ").trim() === text));
  if (matches.length === 0) {
    throw new Error(`No element with full text "${text}"\n${root.textContent}`);
  }
  return matches[0];
}

export function hasFullText(text: string, root: HTMLElement = document.body): boolean {
  try {
    byFullText(text, root);
    return true;
  } catch {
    return false;
  }
}

export { screen };
