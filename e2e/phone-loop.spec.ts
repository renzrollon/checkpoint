import { expect, test } from "@playwright/test";

/**
 * The phone loop (use-checkpoint-from-phone task 4.1), on the fixture adapter
 * at 375 px: a push link opened signed out survives sign-in, an answer and an
 * approval on a non-default branch read fresh after a reload, the chrome home
 * link stays on that branch, and the Branch field opens another one.
 */

const KEY = "e2e-access-key";
const CHANGE = "add-user-auth";
const REF = "carlrollon/sunstar";
const PUSH_LINK = `/changes/${CHANGE}?repo=fixture%2Frepo&ref=carlrollon%2Fsunstar`;

test("push link → sign in → answer and approve → reload fresh → home stays on the branch → open main", async ({ page }) => {
  // 1. Signed out, the push link goes through sign-in and lands on the change.
  await page.goto(PUSH_LINK);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Access key").fill(KEY);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(CHANGE);
  await expect(page).toHaveURL(new RegExp(`/changes/${CHANGE}\\?repo=fixture%2Frepo&ref=carlrollon%2Fsunstar$`));
  await expect(page.locator(".change-header .ref-line").getByText(REF, { exact: true })).toBeVisible();

  // 2. Answer D1, approve, reload: the approval reads without a stale label.
  await page.getByRole("tab", { name: "Ledger" }).click();
  await page.getByRole("button", { name: "a session cookie" }).click();
  await page.getByRole("button", { name: "Answer" }).click();
  await expect(page.getByRole("status").filter({ hasText: "D1 answered" })).toBeVisible();

  const bar = page.getByRole("region", { name: "Decision" });
  const approve = bar.getByRole("button", { name: "Approve" });
  await expect(approve).not.toHaveAttribute("aria-disabled", "true");
  await approve.click();
  await expect(bar.getByRole("status")).toHaveText(`Approved and committed to ${REF}`);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(CHANGE);
  const reloadedBar = page.getByRole("region", { name: "Decision" });
  await expect(reloadedBar.getByText(/^approved · .* UTC · [0-9a-f]{7}$/)).toBeVisible();
  // The decision is fresh. (The fixture's risk is recorded for a head the
  // adapter never produces, so the risk reading is stale on every ref.)
  await expect(reloadedBar.getByText(/branch has moved/)).toHaveCount(0);
  await expect(reloadedBar.getByText(/stale/)).toHaveCount(0);

  // 3. The chrome home link opens the inbox for the same branch.
  await page.getByRole("link", { name: "Checkpoint", exact: true }).click();
  await expect(page).toHaveURL(/\/\?repo=fixture%2Frepo&ref=carlrollon%2Fsunstar$/);
  await expect(page.locator(".inbox-header").getByText(REF, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(CHANGE) })).toHaveAttribute(
    "href",
    `/changes/${CHANGE}?repo=fixture%2Frepo&ref=carlrollon%2Fsunstar`,
  );

  // 4. The Branch field opens main, keeping the repository.
  await page.getByLabel("Branch").fill("main");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page).toHaveURL(/\/\?repo=fixture%2Frepo&ref=main$/);
  await expect(page.locator(".inbox-header").getByText("main", { exact: true })).toBeVisible();
});
