# Maskany Frontend Design System — "Sunlit Stone"

When implementing any frontend UI task, follow this design system exactly. The design system components already exist in `apps/web/src/` — import and reuse them.

## Aesthetic Direction

**Theme**: Warm Mediterranean luxury — terracotta warmth, limestone neutrals, olive accents.
**Feel**: Like sunlit stone architecture — solid, warm, trustworthy. Photography-forward.
**Anti-patterns**: No purple gradients, no generic Inter/Roboto fonts, no cold blue palettes, no generic card shadows.

## Fonts

- **Display headings** (app name, page titles): `font-display` → DM Serif Display (serif)
- **Everything else** (body, labels, buttons): `font-sans` → Plus Jakarta Sans (sans-serif)

## Color Usage

| Token                      | Usage                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `terracotta-500` (#e2683d) | Primary CTAs, active states, accent highlights                    |
| `stone-*`                  | Text hierarchy (950 for headings, 600 for body, 400 for captions) |
| `sand-50` (#fdfcfa)        | Page backgrounds                                                  |
| `olive-*`                  | Secondary accents, nature/chalet badges                           |
| `amber-400` (#f5b731)      | Star ratings                                                      |
| `whatsapp` (#25d366)       | WhatsApp buttons exclusively                                      |
| `white`                    | Card backgrounds, input backgrounds                               |

## Existing Components (import these, don't recreate)

| Component                                | Path                                  | Usage                                                     |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `Button`                                 | `components/ui/button`                | All buttons (primary, secondary, ghost, whatsapp, danger) |
| `Badge`                                  | `components/ui/badge`                 | Property type badges, status indicators                   |
| `Skeleton`, `SkeletonCard`               | `components/ui/skeleton`              | Loading states                                            |
| `BottomSheet`                            | `components/ui/bottom-sheet`          | Filter panel, modals on mobile                            |
| `EmptyState`, `NoResults`, `NoFavorites` | `components/ui/empty-state`           | Empty/zero states                                         |
| `BottomNav`                              | `components/layout/bottom-nav`        | Fixed bottom navigation                                   |
| `Header`                                 | `components/layout/header`            | Top header with back/share                                |
| `PropertyCard`                           | `components/property/property-card`   | Listing grid cards                                        |
| `CategoryBar`                            | `components/property/category-bar`    | Category chip selector                                    |
| `SearchBar`                              | `components/property/search-bar`      | Search input with filter toggle                           |
| `ImageGallery`                           | `components/property/image-gallery`   | Swipeable image gallery                                   |
| `FavoriteButton`                         | `components/property/favorite-button` | Heart toggle                                              |
| `WhatsAppFab`, `WhatsAppIconButton`      | `components/property/whatsapp-button` | WhatsApp contact                                          |
| `StarRating`, `RatingDistribution`       | `components/review/star-rating`       | Rating display/input                                      |
| `ReviewCard`                             | `components/review/review-card`       | Individual review                                         |
| `OtpInput`, `OtpCountdown`               | `components/auth/otp-input`           | 6-digit OTP entry                                         |

## Type definitions (import these)

| Type file      | Path             |
| -------------- | ---------------- |
| Property types | `types/property` |
| Review types   | `types/review`   |
| User types     | `types/user`     |

## Design tokens (import for programmatic access)

| Export                                                                           | Path                   |
| -------------------------------------------------------------------------------- | ---------------------- |
| `colors`, `typography`, `propertyTypeConfig`, `amenityConfig`, `priceUnitLabels` | `styles/design-tokens` |

## Styling Conventions

- CSS utility classes via Tailwind CSS 4 — no separate CSS modules
- Import `@import "tailwindcss"` in `styles/index.css` (already configured)
- Mobile-first: write base styles for mobile, add `sm:`, `md:`, `lg:` for larger screens
- Use `animate-fade-in`, `animate-slide-up`, `animate-scale-in` for entrances
- Use `animate-stagger-1` through `animate-stagger-6` for staggered card reveals
- Card pattern: `rounded-2xl bg-white shadow-[var(--shadow-card)]`
- Card hover: `hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-300`
- Page container: `page-content` class (has bottom padding for nav)
- Touch targets: minimum `min-w-[44px] min-h-[44px]` on all interactive elements
- Active press feedback: `active:scale-[0.97]` on buttons
- Grain texture: add `grain-overlay` class to body for subtle texture

## Layout Patterns

- **Listing grid**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4`
- **Page padding**: `px-4` horizontal, `py-4` vertical
- **Section spacing**: `space-y-6` between major sections
- **Card spacing**: `gap-4` in grids
- **Bottom nav clearance**: handled by `page-content` class
