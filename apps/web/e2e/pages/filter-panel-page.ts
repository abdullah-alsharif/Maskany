/**
 * Page Object — the home-page filter panel.
 *
 * Wraps the panel interactions: open/apply/clear, sort, min/max price,
 * rooms, property-type multiselect, amenities, and rating buttons.
 */
import type { Page } from '@playwright/test';

export class FilterPanelPage {
  constructor(private readonly page: Page) {}

  /**
   * Open the filter panel. The trigger shows an active-count suffix when
   * filters are applied (e.g. "Filters (2 active)"), so match the prefix.
   */
  async open(): Promise<void> {
    await this.page.getByRole('button', { name: /^Filters/ }).click();
  }

  async apply(): Promise<void> {
    const button = this.page.getByRole('button', { name: 'Apply Filters' });
    await button.scrollIntoViewIfNeeded();
    await button.click();
  }

  async clearAll(): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear All' }).click();
  }

  async selectCity(value: string): Promise<void> {
    await this.page.locator('#filter-city').selectOption(value);
  }

  async fillMinPrice(value: string): Promise<void> {
    await this.page.locator('#filter-min-price').fill(value);
  }

  async fillMaxPrice(value: string): Promise<void> {
    await this.page.locator('#filter-max-price').fill(value);
  }

  async selectRooms(value: string): Promise<void> {
    await this.page.locator('#filter-rooms').selectOption(value);
  }

  async selectSort(value: string): Promise<void> {
    await this.page.locator('#filter-sort').selectOption(value);
  }

  /** Select an un-pressed property-type toggle (e.g. "Villa"). */
  async selectType(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, pressed: false }).click();
  }

  /** Select an un-pressed amenity toggle (e.g. "Pool"). */
  async selectAmenity(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label, pressed: false }).click();
  }

  /** Select a minimum-rating option (e.g. "4 stars"). */
  async selectRating(label: string): Promise<void> {
    await this.page.getByRole('button', { name: label }).click();
  }
}
