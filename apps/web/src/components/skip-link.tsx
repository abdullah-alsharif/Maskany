/**
 * SkipLink — a keyboard-only "Skip to main content" link (T-025, PRD §8.5).
 *
 * Visually hidden via Tailwind's `sr-only` utility until it receives focus, at
 * which point `focus:not-sr-only` brings it into view at the top-left corner.
 * Keyboard users press Tab once on every page and can instantly jump past the
 * bottom-nav / header chrome into the main landmark at `#main-content`.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-terracotta-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-terracotta-700"
    >
      Skip to main content
    </a>
  );
}
