---
name: Maskany
description: Mobile-first property listing platform with WhatsApp contact integration
colors:
  primary: '#e2683d'
  neutral-bg: '#fdfcfa'
  neutral-text: '#2b2621'
  accent: '#84904d'
  whatsapp-green: '#25d366'
  sand-bg: '#faf8f3'
  stone-border: '#e8e4dd'
  amber-star: '#f5b731'
typography:
  display:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: 'clamp(1.75rem, 5.5vw, 2.25rem)'
    fontWeight: 400
    lineHeight: 1.17
    letterSpacing: 'normal'
  headline:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: 'clamp(1.375rem, 4vw, 1.625rem)'
    fontWeight: 700
    lineHeight: 1.23
    letterSpacing: '-0.011em'
  title:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: 'clamp(1rem, 3vw, 1.125rem)'
    fontWeight: 600
    lineHeight: 1.44
    letterSpacing: '-0.011em'
  body:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 400
    lineHeight: 1.47
    letterSpacing: '-0.011em'
  label:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: '0.05em'
rounded:
  sm: '0.375rem'
  md: '0.5rem'
  lg: '0.75rem'
  xl: '1rem'
  2xl: '1.25rem'
  full: '9999px'
spacing:
  xs: '0.25rem'
  sm: '0.5rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2rem'
  2xl: '3rem'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.xl}'
    padding: '11px 20px'
    fontFamily: '{typography.label.fontFamily}'
    fontWeight: 600
    fontSize: '0.9375rem'
  button-secondary:
    backgroundColor: '#ffffff'
    textColor: '{colors.neutral-text}'
    rounded: '{rounded.xl}'
    padding: '11px 20px'
    border: '1px solid {colors.stone-border}'
  button-whatsapp:
    backgroundColor: '{colors.whatsapp-green}'
    textColor: '#ffffff'
    rounded: '{rounded.xl}'
    padding: '11px 20px'
  card-default:
    backgroundColor: '#ffffff'
    rounded: "{rounded['2xl']}"
    padding: '14px'
  input-default:
    backgroundColor: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '11px 14px'
    border: '1px solid {colors.stone-border}'
    textColor: '{colors.neutral-text}'
---

# Design System: Maskany

## 1. Overview

**Creative North Star: "Sunlit Mediterranean Sanctuary"**

Maskany's aesthetic is built around sun-baked Mediterranean warmth — terracotta tiles, limestone walls, and olive groves translated into a mobile-first digital interface. The design rejects cold, sterile, blue-heavy layouts and generic SaaS cards in favor of a palette that feels like a coastal villa at golden hour: warm sand backgrounds, terracotta accents, and deep olive secondary tones.

Every decision serves the frictionless path from discovery to WhatsApp contact. The UI is a frame for photography, not the attraction itself.

**Key Characteristics:**

- Warm, light-drenched limestone background (#fdfcfa) instead of cold white.
- Single modern sans-serif family (Plus Jakarta Sans) across all roles for a clean, cohesive look.
- Flat-by-default surfaces with elevation reserved for interactive states.
- Generous touch targets (44px minimum), bottom-docked navigation, and swipe-friendly interactions throughout.
- The grain-overlay texture adds a subtle tactile material feel to the canvas.

## 2. Colors

The palette captures three natural materials: terracotta (fired clay), stone (limestone), and olive (Mediterranean groves), grounded by warm sand tones.

### Primary

- **Terracotta Warmth** (#e2683d): Used for primary action buttons, active navigation states, and high-importance highlights. Scarce by design — no more than 10% of any surface.

### Accent

- **Olive Deep** (#84904d): Secondary accent for tags, checkmarks, amenities, and status indicators. Provides a muted green counterpoint to the warm terracotta.

### Neutral

- **Sunlit Sand** (#fdfcfa): The core canvas background. Warm without being yellow.
- **Limestone Dark** (#2b2621): Primary text color. Avoids harsh pure black.
- **Warm Stone** (#e8e4dd): Borders, dividers, and container outlines.
- **Sand Wash** (#faf8f3): Secondary surface background for chips and subtle containers.
- **Limestone Mid** (#72675a): Secondary text and muted content.

### Functional

- **WhatsApp Green** (#25d366): Exclusively reserved for contact actions. High-visibility, used sparingly.
- **Amber Star** (#f5b731): Ratings and review stars.
- **Error** (#d93025), **Success** (#0d7c3f), **Info** (#1a73e8): Semantic states.

**The Ten Percent Accent Rule.** Terracotta (#e2683d) and WhatsApp green (#25d366) must represent less than 10% of any given surface. Their scarcity ensures they signal something meaningful.

## 3. Typography

**Font:** Plus Jakarta Sans (with system-ui, sans-serif fallback) — single family across all roles.

**Character:** A warm, modern sans-serif that balances approachability with professionalism. Plus Jakarta Sans has a soft humanist feel that suits the welcoming luxury brand, while its clean geometric skeleton keeps the interface looking sharp and contemporary on mobile. One family eliminates visual competition between heading and body roles.

### Hierarchy

- **Display** (Plus Jakarta Sans, 400, clamp(1.75rem–2.25rem), 1.17): Large page titles and hero typography on property detail and marketing sections. Letter-spacing -0.02em.
- **Headline** (Plus Jakarta Sans, 700, clamp(1.375rem–1.625rem), 1.23): Section headers and view titles.
- **Title** (Plus Jakarta Sans, 600, clamp(1rem–1.125rem), 1.44): Card titles and subheadings.
- **Body** (Plus Jakarta Sans, 400, 0.9375rem, 1.47): Property descriptions, metadata, long copy. Max line length 75ch.
- **Label** (Plus Jakarta Sans, 500, 0.75rem, 0.05em tracking, uppercase): Badges, category chips, button labels, metadata tags.

### Type Scale

All body text uses `letter-spacing: -0.011em` by default for optical refinement at small sizes.

## 4. Elevation

Maskany uses a flat-by-default elevation model. Surfaces sit on the same plane; depth is communicated through thin stone borders (#e8e4dd), background tint changes, and subtle shadows reserved exclusively for interactive or temporary states.

### Shadow Vocabulary

- **Card Rest** (`box-shadow: 0 1px 3px rgba(43, 38, 33, 0.06), 0 1px 2px rgba(43, 38, 33, 0.04)`): Barely perceptible ambient lift for property cards at rest.
- **Card Hover** (`box-shadow: 0 8px 25px rgba(43, 38, 33, 0.1), 0 2px 6px rgba(43, 38, 33, 0.06)`): Applied on card interaction.
- **Sheet** (`box-shadow: 0 -4px 32px rgba(43, 38, 33, 0.12)`): Separates bottom sheets and modals from the underlying page.
- **FAB** (`box-shadow: 0 4px 16px rgba(37, 211, 102, 0.3), 0 2px 6px rgba(37, 211, 102, 0.15)`): WhatsApp FAB glow.

**The Flat-By-Default Rule.** Layouts are flat and use bordered dividers at rest. Elevation is used exclusively to denote temporary overlay states (modals, sheets) or user focus (hover, active).

## 5. Components

### Buttons

- **Shape:** Softly rounded corners (16px radius, var(--radius-xl)).
- **Primary:** Terracotta (#e2683d) background, white text, semibold. Min-height 44px. Hover darkens to terracotta-600; active presses to terracotta-700 with a subtle inset shadow.
- **Secondary:** White background, 1px stone border, stone-800 text. Hover adds stone-50 tint.
- **Ghost:** No background, stone-600 text. Hover adds stone-100 tint.
- **WhatsApp:** WhatsApp green (#25d366) background, white text, green-tinted shadow/FAB glow.
- **Danger:** Red-600 background, white text.
- **Sizes:** sm (h-9, 12px radius), md (h-11, 16px radius), lg (h-13, 16px radius).
- **Behavior:** Active scale press (0.96), disabled at 50% opacity, focus-visible ring in terracotta-500.

### Chips / Badges

- **Style:** Compact pill shapes (9999px radius) with tinted background matching the content type (terracotta-100 for apartments/villas, olive-100 for rooms/chalets, stone-200 for other).
- **Text:** 12px uppercase label, 500 weight, matching darker shade of the background hue.

### Cards

- **Corner Style:** Large rounded corners (20px radius, var(--radius-2xl)).
- **Background:** Crisp white (#ffffff) against the sand-50 page background.
- **Shadow Strategy:** Ambient rest shadow (card), hover lift on interaction.
- **Internal Padding:** 14px (tight) to 16px (standard) for mobile-optimized density.

### Inputs / Fields

- **Style:** Clean 1px stone-300 border, white background, 12px radius.
- **Focus:** Terracotta-400 ring replaces the border on focus.
- **Padding:** 11px vertical, 14px horizontal.
- **Error:** Red-600 border with error text below.

### Navigation

- **Bottom Nav:** Fixed to viewport bottom with backdrop blur, thin stone-200 top border, 4 tabs (Home, Search, Favorites, Profile). Active tab uses terracotta-500 icon/text.
- **Header:** Sticky top header with optional back button, title, and action slot. Blur background, bottom border.

## 6. Do's and Don'ts

### Do:

- **Do** align all active touch indicators with Terracotta-500 or WhatsApp green.
- **Do** ensure all body copy does not exceed 75ch for legibility.
- **Do** maintain a minimum touch target size of 44×44px for every interactable element.
- **Do** use `prefers-reduced-motion` to gate all animations; show content immediately when reduced motion is preferred.
- **Do** use the grain overlay texture for tactile warmth on the page canvas.
- **Do** use the `active:scale-[0.96]` press effect on all interactive cards and buttons for physical feedback.

### Don't:

- **Don't** use pure `#000` or `#fff` for neutral text or backgrounds. Use tinted limestone and sand.
- **Don't** use gradient text under any circumstances.
- **Don't** use border-left or border-right colored stripes on callouts or alert banners.
- **Don't** use glassmorphism decoratively.
- **Don't** create identical static card grids without staggered entry animations on interaction.
- **Don't** use bounce or elastic easing curves — stick to ease-out-expo and ease-spring for all motion.
- **Don't** animate CSS layout properties (width, height, top, left) — use transform and opacity only.
- **Don't** use generic SaaS blue or purple accents; the palette is warm terracotta, stone, olive.
- **Don't** stack nested cards; cards must be direct children of a flat page surface.
