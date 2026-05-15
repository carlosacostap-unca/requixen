import { expect, test } from "@playwright/test";

test("muestra la pantalla de ingreso de Requixen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Requixen" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
});
