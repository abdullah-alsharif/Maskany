---
name: Maskany
description: Mobile-first property listing platform with WhatsApp contact integration
colors:
  primary: '#e2683d'
  neutral-bg: '#fdfcfa'
  neutral-text: '#2b2621'
  accent: '#84904d'
typography:
  display:
    fontFamily: 'DM Serif Display, Georgia, serif'
    fontSize: '36px'
    fontWeight: 400
    lineHeight: 1.17
    letterSpacing: 'normal'
  body:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.47
    letterSpacing: '-0.011em'
rounded:
  sm: '6px'
  md: '8px'
  lg: '12px'
  xl: '16px'
  2xl: '20px'
spacing:
  sm: '8px'
  md: '16px'
  lg: '24px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.xl}'
    padding: '11px 20px'
  button-secondary:
    backgroundColor: '#ffffff'
    textColor: '{colors.neutral-text}'
    rounded: '{rounded.xl}'
    padding: '11px 20px'
---

# Design System: Maskany

## 1. Overview

**Creative North Star: "Sunlit Mediterranean Sanctuary"**

Maskany's aesthetic is built around "Sunlit Stone" — a warm Mediterranean luxury meets clean digital interfaces. The design rejects sterile, cold, blue-heavy layouts and generic SaaS cards in favor of terracotta warmth, limestone neutrals, and deep olive accents. It is designed specifically for mobile-first property seekers who want a highly visual, zero-friction discovery process ending in immediate WhatsApp contact.

**Key Characteristics:**

- Warm, light-drenched limestone background instead of cold white.
- Clear structural borders and high contrast typography (serif headings, sans body).
- Bottom-docked mobile control layouts and large tap targets.

## 2. Colors

The color palette captures sun-baked terracotta, warm stone, and olive grove greens.

### Primary

- **Terracotta Warmth** (#e2683d): Used for primary call-to-actions, active navigation states, and high-importance highlights. Represents the heat and character of raw clay tiles.

### Neutral

- **Sunlit Sand** (#fdfcfa): The core canvas background, giving a warm, premium feel.
- **Limestone Dark** (#2b2621): The primary text color, avoiding harsh pure black.
- **Warm Stone Border** (#e8e4dd): Used for dividers, list item separator lines, and container borders.

### Accent

- **Olive Deep** (#84904d): Accent depth used for secondary tags, checkmarks, and distinct property configurations (e.g. amenities/status).
- **WhatsApp Green** (#25d366): Dedicated contact action color, isolated for high visibility.

**The Ten Percent Accent Rule.** Terracotta (#e2683d) and WhatsApp green (#25d366) must represent less than 10% of any given surface. Their scarcity ensures they stand out.

## 3. Typography

**Display Font:** DM Serif Display (with Georgia, serif fallback)
**Body Font:** Plus Jakarta Sans (with system-ui, sans-serif fallback)

**Character:** A high-contrast pairing where editorial, serif headlines suggest home luxury and style, while geometric sans body copy provides high-readability search details.

### Hierarchy

- **Display** (400, 36px, 1.17): Used for large page titles and hero typography.
- **Headline** (700, 26px, 1.23): Used for view header sections.
- **Title** (600, 18px, 1.44): Used for subheadings and card titles.
- **Body** (400, 15px, 1.47): Used for property descriptions and long copy (max 65-75ch).
- **Label** (500, 12px, 0.05em, uppercase): Used for sub-info, category names, and button labels.

## 4. Elevation

The elevation system relies primarily on flat surfaces, clean lines, and subtle shadows for interactable components only. We avoid multi-layered depth.

### Shadow Vocabulary

- **Interactive Card Glow** (`box-shadow: 0 1px 3px rgba(43, 38, 33, 0.06), 0 1px 2px rgba(43, 38, 33, 0.04)`): Ambient low shadow for property cards at rest.
- **Hover Lift** (`box-shadow: 0 8px 25px rgba(43, 38, 33, 0.1), 0 2px 6px rgba(43, 38, 33, 0.06)`): Applied when a user hovers or focuses an interactable card.
- **Bottom Navigation Sheet** (`box-shadow: 0 -4px 32px rgba(43, 38, 33, 0.12)`): Separates fixed navigation layouts from underlying scrolling property feeds.

**The Flat-By-Default Rule.** Layouts are flat and use bordered dividers at rest. Elevation is used exclusively to denote temporary overlay state (modals, sheets) or user focus.

## 5. Components

### Buttons

- **Shape:** Softly rounded corners (16px radius, `var(--radius-xl)`).
- **Primary:** Terracotta background with bold white text. Min-height (44px).
- **Secondary:** Solid white background with a thin stone border and dark text.
- **WhatsApp:** Explicitly colored (#25d366) with white text and an SVG icon.

### Chips

- **Style:** Compact pill-shaped badges (9999px radius) with subtle backgrounds (e.g., olive-100/terracotta-100) and matching text.

### Cards / Containers

- **Corner Style:** Large rounded corners (16px/20px radius).
- **Background:** Crisp white (#ffffff) to stand out against the sunlit sand background.
- **Padding:** Generous internal padding (14px/16px) for spacious visual layouts.

### Inputs / Fields

- **Style:** Clean border-stone-300 text fields with 12px radius.
- **Focus:** Highlighted with a terracotta outline (`var(--color-terracotta-400)`).

### Navigation

- **Style:** Sticky header and fixed bottom navigation bar with a blur background (`backdrop-blur-lg`) and thin top border.

## 6. Do's and Don'ts

### Do:

- **Do** align all active touch indicators with Terracotta-600 or WhatsApp-Green.
- **Do** ensure all body copy does not exceed a maximum width of 75ch for legibility.
- **Do** maintain a minimum touch target size of 44x44px for every interactable element.

### Don't:

- **Don't** use pure `#000` or `#fff` for neutral text/backgrounds. Use tinted limestone and sand.
- **Don't** use gradient text under any circumstances.
- **Don't** use border-left or border-right colored stripes on callouts or alert banners.
- **Don't** use glassmorphism decoratively.
- **Don't** create identical static card grids without micro-animations on interaction.

## 7. Component Reference

| Component | Import path | Usage |
|---|---|---|
| `Button` | `components/ui/button` | primary, secondary, ghost, whatsapp, danger variants |
| `Badge` | `components/ui/badge` | Property type badges, status |
| `Skeleton`, `SkeletonCard` | `components/ui/skeleton` | Loading states |
| `BottomSheet` | `components/ui/bottom-sheet` | Filter panel, mobile modals |
| `EmptyState`, `NoResults`, `NoFavorites` | `components/ui/empty-state` | Empty/zero states |
| `BottomNav` | `components/layout/bottom-nav` | Fixed bottom navigation |
| `Header` | `components/layout/header` | Top header with back/share |
| `PropertyCard` | `components/property/property-card` | Listing grid cards |
| `CategoryBar` | `components/property/category-bar` | Category chip selector |
| `SearchBar` | `components/property/search-bar` | Search input |
| `ImageGallery` | `components/property/image-gallery` | Swipeable gallery |
| `FavoriteButton` | `components/property/favorite-button` | Heart toggle |
| `WhatsAppFab`, `WhatsAppIconButton` | `components/property/whatsapp-button` | WhatsApp contact |
| `StarRating`, `RatingDistribution` | `components/review/star-rating` | Rating display/input |
| `ReviewCard` | `components/review/review-card` | Individual review |
| `OtpInput`, `OtpCountdown` | `components/auth/otp-input` | 6-digit OTP entry |

### Key types

| Types | Import path |
|---|---|
| Property | `types/property` |
| Review | `types/review` |
| User | `types/user` |

### Design tokens

| Export | Import path |
|---|---|
| `colors`, `typography`, `propertyTypeConfig`, `amenityConfig`, `priceUnitLabels` | `styles/design-tokens` |
