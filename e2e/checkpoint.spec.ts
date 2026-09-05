import { expect, test } from "@playwright/test";

/**
 * The one smoke the brief asks for, on the fixture adapter at 375 px: sign
 * in, find the two changes, open the one waiting on a person, answer D1 by
 * tapping a chip, watch Approve become enabled, approve, and read back what
 * the app committed through the test-only fixture file route.
 */

const KEY = "e2e-access-key";
const CHANGE = "add-user-auth";
const LEDGER = `openspec/changes/${CHANGE}/decisions.md`;
const CHECKPOINT = `openspec/changes/${CHANGE}/checkpoint.json`;

test("sign in, answer D1 from a chip, approve, and find both files committed", async ({ page }) => {
  await page.goto(`/login?next=/`);
  await page.getByLabel("Access key").fill(KEY);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Inbox: two changes, blocking first.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([CHANGE, "add-report-flag"]);
  await expect(page.getByText("1 needs you")).toBeVisible();
  await expect(page.getByText("main", { exact: true })).toBeVisible();

  // Change page.
  await page.getByRole("link", { name: new RegExp(CHANGE) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(CHANGE);
  await expect(page.getByText("1 needs you, 3 resolved, 0 invalid, of 4 rows")).toBeVisible();
  const bar = page.getByRole("region", { name: "Decision" });
  const approve = bar.getByRole("button", { name: "Approve" });
  await expect(approve).toHaveAttribute("aria-disabled", "true");
  await expect(bar.getByText("1 decision still needs you")).toBeVisible();

  // Ledger tab: answer D1 by tapping a chip.
  await page.getByRole("tab", { name: "Ledger" }).click();
  await expect(page).toHaveURL(/#ledger$/);
  await page.getByRole("button", { name: "a session cookie" }).click();
  await expect(page.getByLabel("Your answer")).toHaveValue("a session cookie");
  await page.getByRole("button", { name: "Answer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "D1 answered" })).toBeFocused();
  await expect(page.getByText("human decision", { exact: false })).toBeVisible();
  await expect(page.getByText("0 needs you, 4 resolved, 0 invalid, of 4 rows")).toBeVisible();

  // Approve is offered now.
  await expect(approve).not.toHaveAttribute("aria-disabled", "true");
  await approve.click();
  await expect(bar.getByRole("status")).toHaveText("Approved and committed to main");
  await expect(bar.getByRole("status")).toBeFocused();
  await expect(bar.getByText(/^approved · .* UTC · [0-9a-f]{7}$/)).toBeVisible();

  // What landed on the branch.
  const ledger = await page.request.get(`/api/fixture/file?path=${LEDGER}&ref=main`);
  expect(ledger.status()).toBe(200);
  const ledgerText: string = (await ledger.json()).text;
  expect(ledgerText).toContain("| D1 | How is the app gated: a session cookie, Vercel Deployment Protection, or Cloudflare Access? | agent_resolved | a session cookie | human decision ");
  expect(ledgerText).toContain(" via Checkpoint |");
  expect(ledgerText).not.toContain("needs_human");

  const checkpoint = await page.request.get(`/api/fixture/file?path=${CHECKPOINT}&ref=main`);
  expect(checkpoint.status()).toBe(200);
  const written = JSON.parse((await checkpoint.json()).text);
  expect(written.schema).toBe("interlock.checkpoint/1");
  expect(written.decision.state).toBe("approved");
  expect(written.decision.decidedBy).toBe("checkpoint");
  expect(written.decision.headSha).toMatch(/^[0-9a-f]{40}$/);
  expect(written.request.risk.class).toBe("medium");
  expect(written.senderNote).toBe("kept as an unknown top-level field");
});
