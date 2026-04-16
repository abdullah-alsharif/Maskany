/**
 * T-024 — ResponsiveImage component tests.
 *
 * Validates the AC items:
 *   - Images use loading="lazy" attribute for below-fold content.
 *   - Image components use thumbnail URLs for cards, full URLs for detail/gallery.
 *   - Property cards use srcset with responsive image sizes.
 *   - WebP format preferred with fallback.
 *   - Image component renders with lazy loading attribute (unit test).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveImage } from '../src/components/ui/responsive-image';

describe('ResponsiveImage (T-024)', () => {
  it('renders an <img> with loading="lazy" by default for below-the-fold use', () => {
    render(<ResponsiveImage src="https://cdn.example.com/cover.webp" alt="Living room view" />);
    const img = screen.getByRole('img', { name: /living room view/i });
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('allows opting in to eager loading for above-the-fold hero imagery', () => {
    render(<ResponsiveImage src="https://cdn.example.com/hero.webp" alt="Hero" priority />);
    const img = screen.getByRole('img', { name: /hero/i });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('decoding', 'sync');
  });

  it('uses the thumbnail URL as the primary src and the full URL inside srcset', () => {
    render(
      <ResponsiveImage
        src="https://cdn.example.com/cover-thumb.webp"
        fullSrc="https://cdn.example.com/cover.webp"
        alt="Cover"
      />,
    );
    const img = screen.getByRole('img', { name: /cover/i });
    expect(img.getAttribute('src')).toContain('cover-thumb.webp');
    const srcset = img.getAttribute('srcset') ?? '';
    expect(srcset).toContain('cover-thumb.webp');
    expect(srcset).toContain('cover.webp');
  });

  it('emits a sizes attribute describing the responsive breakpoints', () => {
    render(
      <ResponsiveImage
        src="https://cdn.example.com/cover-thumb.webp"
        fullSrc="https://cdn.example.com/cover.webp"
        alt="Sizes"
      />,
    );
    const img = screen.getByRole('img', { name: /sizes/i });
    const sizes = img.getAttribute('sizes') ?? '';
    // Mobile-first: full width on small screens, half on tablet, third on desktop.
    expect(sizes).toMatch(/100vw/);
    expect(sizes).toMatch(/50vw/);
    expect(sizes).toMatch(/33vw/);
  });

  it('renders a <picture> with WebP source preferred and a fallback <img>', () => {
    const { container } = render(
      <ResponsiveImage
        src="https://cdn.example.com/cover-thumb.webp"
        fullSrc="https://cdn.example.com/cover.webp"
        fallbackSrc="https://cdn.example.com/cover.jpg"
        alt="Picture fallback"
      />,
    );
    const picture = container.querySelector('picture');
    expect(picture).not.toBeNull();
    const sources = picture?.querySelectorAll('source') ?? [];
    expect(sources.length).toBeGreaterThanOrEqual(1);
    const webpSource = Array.from(sources).find((s) => s.getAttribute('type') === 'image/webp');
    expect(webpSource).toBeTruthy();
    const img = picture?.querySelector('img');
    expect(img?.getAttribute('src')).toContain('cover.jpg');
  });

  it('forwards width, height, and className to the underlying <img>', () => {
    render(
      <ResponsiveImage
        src="https://cdn.example.com/x.webp"
        alt="Forward"
        width={400}
        height={300}
        className="rounded-2xl"
      />,
    );
    const img = screen.getByRole('img', { name: /forward/i });
    expect(img).toHaveAttribute('width', '400');
    expect(img).toHaveAttribute('height', '300');
    expect(img.className).toContain('rounded-2xl');
  });
});
