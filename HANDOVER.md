# ADINN UNIPOLE — Project Handover

## Project Overview

This is a production-ready Next.js 16 App Router website built with TypeScript, Tailwind CSS v4, and Poppins.

## Completed Features

- Next.js App Router root layout and homepage
- Poppins through `next/font/google`
- Light premium ADINN design system
- Fixed responsive header and mobile navigation
- Interactive 3D hero
- Reversible 8-stage 3D UNIPOLE assembly
- Completed-model drag rotation
- Professional editorial Why Choose section
- Key Locations interaction
- Searchable and filterable inventory
- Product-details modal with `?site=<id>` history behaviour
- Campaign-plan context and localStorage persistence
- Campaign-plan drawer and Added-to-Plan toast
- Day/night comparison
- From Ground to Sky process
- Business Growth Journey
- Campaign Gallery and lightbox
- Industries Served
- How It Works
- FAQ
- Validated enquiry form with WhatsApp handoff
- Footer and contact actions
- Reduced-motion and keyboard support

## Important Files

| Area | File |
| --- | --- |
| Root layout / Poppins / metadata | `src/app/layout.tsx` |
| Homepage | `src/app/page.tsx` |
| Client providers and page composition | `src/components/ClientApp.tsx` |
| Global design system | `src/app/globals.css` |
| Main homepage sections | `src/components/home/*` |
| 3D model | `src/components/three/UnipoleModel.tsx` |
| Assembly scene | `src/components/home/AssemblyScene.tsx` |
| Inventory | `src/components/home/InventorySection.tsx` |
| Product modal | `src/components/product/ProductModal.tsx` |
| Campaign plan | `src/context/CampaignPlanContext.tsx` and `src/components/campaign/*` |
| Site data | `src/data/unipoles.ts` |
| Contact settings | `src/config/site.ts` |

## Known Content Limitations

1. Contact information in `src/config/site.ts` is placeholder data.
2. Inventory contains sample data and must be replaced with verified ADINN inventory.
3. Site and campaign photography is represented by designed placeholders.
4. The map is a stylised SVG, not a geographic map service.
5. Enquiry and proposal actions use WhatsApp; no backend or CRM is connected.
6. Privacy and Terms links require real legal pages.

## Maintenance

- Add inventory in `src/data/unipoles.ts`.
- Update branding and contact information in `src/config/site.ts`.
- Adjust colours and typography tokens in `src/app/globals.css`.
- Replace placeholder imagery with assets inside `public/images/` and use `next/image`.
- Bump the localStorage key in `src/lib/campaign-plan.ts` when the stored schema changes.

## Run Locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run lint
npm run build
```

## Deploy to Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Vercel should detect Next.js automatically.
4. Deploy the `main` branch.

## Handover Package

The ZIP contains the full source code. Extract it, run `npm install`, then `npm run dev`.
