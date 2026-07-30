# ADINN UNIPOLE — Next.js Website

A premium, conversion-focused UNIPOLE outdoor-advertising website for ADINN Advertising Services. The interface uses a light editorial design system inspired by the clarity, product storytelling, spacing, and motion quality associated with leading global technology and luxury-product websites—without copying any reference site.

## Tech Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS v4
- Poppins via `next/font/google`
- Framer Motion
- Lenis smooth scrolling
- React Three Fiber + Drei
- Lucide React icons

## Main Features

- Responsive premium homepage
- Interactive 3D UNIPOLE hero
- Reversible scroll-driven 3D assembly with lightweight native scroll progress
- Drag-to-rotate interaction after assembly completes
- Editorial “Why Choose UNIPOLE” section
- City and location-type discovery
- Searchable, filterable UNIPOLE inventory
- URL-synchronised product-details modal using `?site=<id>`
- Persistent campaign plan using localStorage
- Campaign-plan drawer and confirmation toast
- Day/night comparison
- Installation journey, industry list, gallery, FAQ, enquiry form, and footer
- Keyboard, reduced-motion, focus-management, and responsive support

## Folder Structure

```text
src/
  app/
    layout.tsx            Root metadata, Poppins font, global CSS
    page.tsx              App Router homepage
    globals.css           Tailwind v4 tokens and design system
  components/
    ClientApp.tsx         Client boundary, providers, global overlays, page composition
    home/                 Homepage sections
    campaign/             Campaign-plan drawer and toast
    product/              Product-details modal
    layout/               Header and mobile navigation
    three/                Hero and UNIPOLE 3D model
    ui/                   Shared buttons, placeholders, and UI primitives
  config/site.ts          Contact details, navigation, WhatsApp helper
  context/                Campaign-plan provider
  data/unipoles.ts        Typed inventory data
  hooks/                  Lenis, focus trap, reduced motion
  lib/                    Inventory and campaign-plan helpers
  types/unipole.ts        TypeScript domain types
```

## Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```bash
npm run lint
npm run build
npm run start
```

## Update Contact Details

Edit `src/config/site.ts`:

- Email
- Phone
- WhatsApp number
- Address
- Social links
- Navigation labels

The current contact details are placeholders and must be replaced before launch.

## Replace Placeholder Images

The project currently uses `src/components/ui/PlaceholderImage.tsx` where real photography is unavailable.

To add real site photography:

1. Add images under `public/images/`.
2. Update `dayImage`, `nightImage`, and `galleryImages` in `src/data/unipoles.ts`.
3. Replace placeholder rendering with `next/image` where required.

## Update Inventory

Edit `src/data/unipoles.ts`. Filters, counts, campaign-plan entries, and the product modal resolve from this typed data source.

## Deployment

### Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Keep the framework preset as Next.js.
4. Deploy.

No environment variables are currently required.

## Design Direction

- Poppins typography
- White, warm-white, and soft-grey surfaces
- Controlled ADINN red accents
- Thin borders and minimal shadows
- Editorial layouts rather than repetitive card grids
- Product-focused motion and hierarchy
- Fully responsive and accessible interactions
