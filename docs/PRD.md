# Maskany — Property Listing Platform

## 1. Project Overview

### 1.1 Purpose

Maskany is a mobile-first property listing web application that allows users to browse rental and sale listings for apartments, rooms, chalets, villas, houses, and similar accommodation types. Users contact property owners exclusively through WhatsApp. There is no in-app chat system and no payment functionality.

### 1.2 Target Platforms

- Mobile web (primary experience)
- iOS app via Capacitor
- Android app via Capacitor
- Desktop web (responsive)

### 1.3 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL — schema managed by `Kysely` migrations (TypeScript schema builder), queries via `Kysely` (type-safe SQL builder)
- **Testing**: Vitest (unit/integration with real DB), Playwright (E2E)
- **Mobile**: Capacitor
- **Auth**: Twilio SMS OTP + Email OTP via Nodemailer
- **Media**: Photos via `sharp` (WebP, thumbnails), Videos via `fluent-ffmpeg` (poster frames)
- **Monorepo**: pnpm workspaces (`apps/api` and `apps/web`)

### 1.4 Design Philosophy

- Airbnb-inspired clean, modern UI
- Mobile-first responsive design
- Card-based listing layouts
- Smooth transitions and skeleton loading states
- Professional photography-focused image presentation
- Intuitive bottom navigation for mobile

## 2. Authentication System

### 2.1 Registration

Users register by providing:

- Full name
- Mobile number (with country code selector)
- Email address (optional)
- User type: "Browser" (default) or "Property Owner"

Upon registration, an OTP is sent to the provided mobile number via Twilio SMS. The user must verify the OTP within 5 minutes to complete registration.

### 2.2 Login

Users can log in using either:

- **Mobile number**: Enter phone number → receive OTP via SMS → verify
- **Email address**: Enter email → receive OTP via email → verify

No passwords are stored. Authentication is entirely OTP-based.

### 2.3 OTP Verification

- OTP codes are 6 digits, valid for 5 minutes
- Maximum 3 OTP requests per phone/email per hour (rate limiting)
- OTP delivery via Twilio for SMS
- OTP delivery via Nodemailer (SMTP) for email
- After successful verification, a JWT access token (15 min) and refresh token (7 days) are issued

### 2.4 Session Management

- JWT-based authentication with access/refresh token pattern
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Token refresh endpoint to obtain new access tokens
- Logout endpoint to invalidate refresh tokens

## 3. Property Listings

### 3.1 Data Model

Each property listing contains:

- **id**: UUID primary key
- **title**: Short descriptive title (max 120 chars)
- **summary**: Brief summary (max 300 chars)
- **description**: Full detailed description (rich text)
- **propertyType**: Enum — apartment, room, chalet, villa, house, studio, penthouse, duplex, other
- **location**: Object with city, area/district, country, and optional coordinates (lat/lng)
- **price**: Number (display only — no transactions)
- **currency**: String (e.g., "SAR", "AED", "USD")
- **priceUnit**: Enum — per_night, per_month, per_year, total
- **rooms**: Number of bedrooms
- **bathrooms**: Number of bathrooms
- **area**: Size in square meters
- **amenities**: Array of strings (wifi, parking, pool, gym, ac, furnished, etc.)
- **images**: Array of image objects (url, thumbnail, alt text, order)
- **whatsappNumber**: Property owner's WhatsApp number (with country code)
- **ownerId**: Reference to user who created the listing
- **status**: Enum — active, inactive, draft
- **averageRating**: Computed from reviews
- **reviewCount**: Computed from reviews
- **createdAt**: Timestamp
- **updatedAt**: Timestamp

### 3.2 Property CRUD Operations

- **Create**: Authenticated property owners can create listings
- **Read**: Anyone (including unauthenticated users) can view listings
- **Update**: Only the listing owner can edit
- **Delete**: Only the listing owner can soft-delete (set status to inactive)
- **List**: Paginated listing with cursor-based pagination (20 items per page)

### 3.3 Media Handling (Photos + Videos)

- Support upload of up to **10 images** and **3 videos** per listing
- **Images** processed server-side using `sharp`:
  - Original stored at max 1920px width
  - Thumbnail generated at 400px width
  - WebP format conversion for optimization
- **Videos** accepted in mp4, mov, webm formats (max 50MB each):
  - Stored as-is (no transcoding in v1)
  - Poster-frame thumbnail extracted at 1-second mark via `fluent-ffmpeg`
  - Duration metadata extracted and stored
- Media records stored in `property_media` table with `media_type` column (IMAGE or VIDEO)
- Media served from `/uploads/` static directory
- First image is the cover/hero image
- Media reordering supported via drag-and-drop (frontend)

### 3.4 Property Detail View

The detail page displays:

- Full-screen image gallery with swipe navigation (mobile) and arrow navigation (desktop)
- Title, summary, property type badge
- Location with area and city
- Price with currency and unit
- Room/bathroom/area specs
- Full description
- Amenities as icon chips
- "Contact on WhatsApp" floating action button
- Reviews and ratings section
- Owner info (name, member since)

### 3.5 Property Listing View

Grid layout showing property cards with:

- Cover image (lazy loaded)
- Title
- Location (city, area)
- Price
- Property type badge
- Star rating and review count
- Number of rooms

## 4. Search and Filters

### 4.1 Search

- Full-text search across title, summary, description, location fields
- Search bar prominently positioned at top of listing page
- Debounced input (300ms) to reduce API calls
- Search results replace the main listing grid
- "No results" state with suggestions

### 4.2 Category Navigation

Top-level category tabs/chips for quick filtering:

- All
- Apartments
- Rooms
- Chalets
- Villas
- Houses
- Studios
- Other

Displayed as a horizontally scrollable chip bar below the search bar.

### 4.3 Filters

Filter panel (slide-up sheet on mobile, sidebar on desktop):

- **Property Type**: Multi-select checkboxes
- **Location**: City dropdown + area text input
- **Price Range**: Min/max number inputs with slider
- **Rooms**: Dropdown (1, 2, 3, 4, 5+)
- **Bathrooms**: Dropdown (1, 2, 3+)
- **Rating**: Minimum rating (1-5 stars)
- **Amenities**: Multi-select chips
- **Sort By**: Newest, price low-to-high, price high-to-low, highest rated

Filters applied via query parameters for shareable/bookmarkable URLs.

### 4.4 Filter API

- All filter parameters accepted as query params on GET /api/properties
- Filters are composable (AND logic)
- Server-side filtering and sorting with Prisma
- Response includes total count for pagination

## 5. Reviews and Ratings

### 5.1 Rating System

- Star-based rating from 1 to 5 (half-star increments)
- Users must be authenticated to leave a rating
- One rating per user per property
- Users can update their existing rating
- Average rating computed and stored on property (updated on each review change)

### 5.2 Comments/Reviews

Each review contains:

- **rating**: 1-5 (required)
- **comment**: Text content (optional, max 1000 chars)
- **userId**: Reference to authenticated user
- **propertyId**: Reference to property
- **createdAt**: Timestamp
- **updatedAt**: Timestamp

### 5.3 Review Display

- Reviews shown below property details
- Sorted by newest first
- Rating distribution bar chart (5-star, 4-star, etc.)
- Average rating prominently displayed
- Paginated (10 per page)
- Each review shows: user name, rating stars, comment text, date

### 5.4 Review Moderation

- Property owners cannot review their own listings
- Reviews can be reported (flagged) by users
- No automatic moderation in v1

## 6. WhatsApp Integration

### 6.1 Contact Button

Every property listing displays a prominent "Contact on WhatsApp" button:

- Floating action button (FAB) on property detail page
- Uses WhatsApp deep link: `https://wa.me/{number}?text={message}`
- Number format: international format without + or spaces (e.g., 966501234567)

### 6.2 Pre-filled Message

When the WhatsApp button is clicked, the message is pre-filled with:

```
Hi, I'm interested in your property listing: "{property.title}" (Ref: {property.id}).
Listed on Maskany.
```

### 6.3 Contact Methods

- WhatsApp button on property cards (icon only)
- WhatsApp FAB on property detail page (full button)
- No phone calls, no email, no in-app messaging

## 7. Mobile and Capacitor

### 7.1 Mobile-First Layout

- Bottom navigation bar with 4 tabs: Home, Search, Favorites, Profile
- Pull-to-refresh on listing pages
- Swipe gestures for image gallery
- Touch-optimized tap targets (minimum 44x44px)
- Safe area insets for notch/home indicator
- Smooth scrolling with momentum

### 7.2 Capacitor Configuration

- App name: "Maskany"
- Bundle ID: `com.maskany.app`
- Plugins: StatusBar, SplashScreen, Keyboard, Haptics
- Deep link support for shared property URLs
- Native splash screen and app icon

### 7.3 Offline Considerations

- Skeleton loading states while data fetches
- Error states with retry buttons
- Cached listing data via TanStack Query (stale-while-revalidate)
- No offline-first in v1

## 8. Non-Functional Requirements

### 8.1 Performance

- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Lazy loading for images below the fold
- Virtual scrolling for long listing pages
- Image optimization (WebP, thumbnails, responsive srcset)
- API response times < 200ms for listing queries

### 8.2 Security

- Input validation on all API endpoints (zod schemas)
- SQL injection prevention via Prisma parameterized queries
- XSS prevention via React's default escaping
- Rate limiting on auth endpoints
- CORS configured for web domain only
- Helmet.js for security headers
- JWT stored in httpOnly cookies (web) or secure storage (native)

### 8.3 Testing Strategy

- **Unit tests**: Service functions, utilities, validators (Vitest, real DB)
- **Integration tests**: API endpoints with real PostgreSQL test database (Vitest + supertest)
- **E2E tests**: Critical user flows with Playwright (real browser, real API, real DB)
- **No mocks**: All tests run against real infrastructure
- **Test database**: Separate PostgreSQL database, migrated and seeded before test runs, cleaned between tests

### 8.4 SEO (Web Version)

- Semantic HTML5 elements
- Meta tags (title, description, og:image) per listing
- Structured data (JSON-LD) for property listings
- Sitemap.xml generation
- Clean URL structure (/properties/:id/:slug)

### 8.5 Accessibility

- WCAG 2.1 AA compliance
- Proper heading hierarchy
- Alt text on all images
- Keyboard navigation support
- Screen reader labels on interactive elements
- Focus management on route changes
- Color contrast ratios meeting AA standards
