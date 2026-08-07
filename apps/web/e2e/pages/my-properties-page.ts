/**
 * Page Object — the owner's "My properties" page.
 *
 * Covers navigation, listing cards, status toggling, and the delete flow
 * (Delete <title> → "Yes, delete listing" → listing gone).
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { goto } from '../test-helpers';

export class MyPropertiesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await goto(this.page, '/my-properties');
    await expect(this.page.getByRole('heading', { level: 1, name: 'My properties' })).toBeVisible({
      timeout: 10_000,
    });
  }

  async clickNewListing(): Promise<void> {
    await this.page.getByRole('link', { name: 'New listing' }).click();
    await expect(this.page).toHaveURL(/\/properties\/create$/);
  }

  card(title: string): Locator {
    return this.page.getByRole('article').filter({ hasText: title });
  }

  /** Delete `title` via the confirm dialog and wait for it to disappear. */
  async deleteProperty(title: string): Promise<void> {
    const deleteButton = this.page.getByRole('button', {
      name: `Delete ${title}`,
      exact: true,
    });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    await this.page.getByRole('button', { name: 'Yes, delete listing' }).click();
    await expect(this.page.getByRole('heading', { name: title, exact: true })).not.toBeVisible({
      timeout: 10_000,
    });
  }

  /** Toggle a listing between Active and Inactive and wait for the status chip. */
  async toggleStatus(title: string, target: 'Active' | 'Inactive'): Promise<void> {
    const action = target === 'Active' ? 'Activate' : 'Deactivate';
    await this.page.getByRole('button', { name: `${action} ${title}` }).click();
    await expect(this.card(title).getByText(target)).toBeVisible({ timeout: 10_000 });
  }
}
