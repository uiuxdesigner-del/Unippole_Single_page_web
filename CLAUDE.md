# ADINN UNIPOLE Website — Project Context

## Project root

```text
D:\unipole_new\adinn-unipole-premium
```

Always work inside this folder.

Do not modify the older project located at:

```text
D:\Unippole_Single_page_web
```

Before editing, confirm the terminal is inside the correct project:

```powershell
cd "D:\unipole_new\adinn-unipole-premium"
Get-Location
```

---

## Project objective

Build a professional, premium and responsive ADINN UNIPOLE website for users to:

- Understand UNIPOLE advertising
- Understand its business value
- Browse available UNIPOLE locations
- Filter available inventory
- View individual site details
- Add suitable sites to a campaign plan
- Request availability or a campaign proposal

The website must feel intentionally designed, not like a generic template.

Use:

- Strong visual hierarchy
- Realistic UNIPOLE imagery
- Restrained animation
- Generous spacing
- Clear booking and shortlisting actions
- Careful responsive behaviour
- Premium editorial layouts
- Clean mobile interactions

The current system is a campaign-planning and proposal-request experience.

Do not describe a site as instantly booked unless the system genuinely reserves and confirms that site.

Preferred terminology:

- Add to Campaign Plan
- View Campaign Plan
- Request Availability
- Request Proposal
- Build Campaign Plan

Avoid using `Book Now` unless direct confirmed booking is implemented.

---

## Core technology

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Poppins
- Framer Motion
- Lenis
- GSAP
- ScrollTrigger
- React Three Fiber
- Drei
- Three.js
- Lucide React

Do not convert the project to another framework.

Do not replace an existing animation library without a clear technical reason.

Do not add new dependencies unless strictly necessary.

---

## Brand and visual direction

Use:

- ADINN red
- Black
- White
- Controlled warm-neutral backgrounds
- Poppins throughout
- Clean editorial layouts
- Large product-focused imagery
- Smooth, restrained animation
- Thin dividers where useful
- Minimal shadows
- Realistic UNIPOLE imagery
- Good mobile spacing
- Readable typography
- Clear campaign-planning actions

Avoid:

- Generic SaaS card grids
- Excessive glassmorphism
- Harsh glow effects
- Large decorative gradient blobs
- Repeated three-card layouts
- Cartoon icons
- Fake statistics
- Fake testimonials
- Placeholder-looking design
- Platform branding
- Website-builder wording
- Excessive bouncing animations
- Unnecessary scale animations
- Unnecessary decorative sections
- Repetitive galleries

---

## Current source structure

```text
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── icon.svg
│   ├── apple-icon.png
│   └── opengraph-image.jpg
│
├── components/
│   ├── ClientApp.tsx
│   │
│   ├── home/
│   │   ├── HomeSections.tsx
│   │   ├── HeroSection.tsx
│   │   ├── HeroSection.module.css
│   │   ├── InventorySection.tsx
│   │   ├── AssemblyScene.tsx
│   │   ├── DayNightCompare.tsx
│   │   ├── EnquirySection.tsx
│   │   └── FooterSection.tsx
│   │
│   ├── layout/
│   │   └── Header.tsx
│   │
│   ├── three/
│   │   ├── HeroScene.tsx
│   │   └── UnipoleModel.tsx
│   │
│   ├── product/
│   │   └── ProductModal.tsx
│   │
│   ├── campaign/
│   │   ├── CampaignPlanDrawer.tsx
│   │   └── AddedToPlanToast.tsx
│   │
│   ├── text/
│   │   └── ScrollFloat.tsx
│   │
│   └── ui/
│       ├── BrandButton.tsx
│       ├── PlaceholderImage.tsx
│       └── Silk.tsx
│
├── context/
│   └── CampaignPlanContext.tsx
│
├── hooks/
│   ├── useLenis.ts
│   ├── useFocusTrap.ts
│   └── useReducedMotion.ts
│
├── config/
│   └── site.ts
│
├── data/
│   └── unipoles.ts
│
├── lib/
│   ├── campaign-plan.ts
│   ├── inventory.ts
│   └── utils.ts
│
└── types/
    └── unipole.ts
```

The local project may contain recent files or changes beyond this list.

Always inspect the actual project before editing.

Do not assume that a component, path, import or asset exists solely because it appears in this document.

---

# Approved homepage composition

## Main composition file

The primary homepage composition is expected to be controlled by:

```text
src/components/ClientApp.tsx
```

However, inspect the actual project before editing because the section composition may have moved to another file.

Possible composition files include:

```text
src/components/ClientApp.tsx
src/app/page.tsx
src/components/home/HomePage.tsx
```

Do not assume the file name without checking.

---

## Final approved homepage order

The active homepage must follow this order:

1. Header
2. Hero
3. About Unipole
4. Why Choose UNIPOLE Advertising
5. Available Inventory
6. Day & Night — Visible Through Every Hour
7. Scroll-driven Assembly — How a UNIPOLE Takes Shape
8. The Installation Journey
9. Industries Served
10. How Outdoor Presence Supports Growth
11. FAQ
12. Enquiry
13. Footer

Supporting overlays and drawers must remain outside or after the visible page composition:

14. CampaignPlanDrawer
15. ProductModal
16. AddedToPlanToast

Expected composition structure:

```tsx
<Header />

<main>
  <HeroSection />
  <WhatIsUnipoleSection />
  <WhyChooseSection />
  <InventorySection />
  <DayNightCompare />
  <AssemblyScene />
  <GroundToSkySection />
  <IndustriesSection />
  <BusinessGrowthSection />
  <FaqSection />
  <EnquirySection />
</main>

<FooterSection />

<CampaignPlanDrawer />
<ProductModal />
<AddedToPlanToast />
```

The actual component names may differ slightly.

Identify each section using both its component name and its visible heading.

---

## Section identification

### Hero

Visible content:

```text
NEW
Premium outdoor visibility

One pole. Maximum brand visibility.
```

Actions:

```text
Explore Sites
Plan Campaign
```

### About

Visible heading:

```text
About Unipole
```

### Why Choose

Visible headings:

```text
Why Choose
UNIPOLE Advertising
```

### Inventory

Visible headings:

```text
Available Inventory
Browse UNIPOLE locations.
```

### Day and Night

Visible headings:

```text
Day & Night
Visible Through Every Hour
```

### Assembly

Visible headings:

```text
Scroll-driven assembly
How a UNIPOLE takes shape.
```

Stages:

```text
01 Foundation
02 Pole
03 Support
04 Frame
05 Display
06 Lighting
07 Campaign Surface
08 Complete
```

### Installation

Visible headings:

```text
From Ground to Sky
The installation journey.
```

### Industries

Visible headings:

```text
Industries Served
Trusted across every category that needs visibility.
```

### Business Growth

Visible headings:

```text
Business Growth Journey
How outdoor presence supports growth.
```

### FAQ

Visible headings:

```text
FAQ
Answers to common questions.
```

### Enquiry

Visible heading:

```text
Request a campaign proposal.
```

---

## Homepage ordering rules

- About Unipole must appear directly after Hero.
- Why Choose UNIPOLE Advertising must appear directly after About Unipole.
- Available Inventory must appear directly after Why Choose.
- Day & Night must appear directly after Available Inventory.
- Scroll-driven Assembly must appear directly after Day & Night.
- The Installation Journey must appear after Scroll-driven Assembly.
- Industries Served must appear before Business Growth.
- Business Growth must appear before FAQ.
- FAQ must appear before Enquiry.
- Enquiry must appear before Footer.
- Footer must remain the final visible website section.
- Every active section must render exactly once.
- Do not duplicate sections while reordering them.
- When moving a section, remove it from its previous position.
- Reordering sections must not change their internal functionality.
- Reordering sections must not change IDs or navigation anchors.

---

# Sections not included in the active homepage

## Campaign Gallery

The Campaign Gallery section is no longer required.

Removed visible content includes:

```text
Campaign Gallery
Recent brand presence.
```

Removed filters include:

```text
All
Real Estate
Retail
Healthcare
Education
Automobile
FMCG
Jewellery
Corporate
```

Rules:

- Do not render `GallerySection` on the homepage.
- Do not restore Campaign Gallery unless explicitly requested.
- Remove `<GallerySection />` from the homepage composition.
- If `GallerySection` is not used anywhere else, its component and gallery-only data may be removed.
- If it is used elsewhere, keep the component and remove only its homepage rendering.
- Remove unused gallery-only imports, state and constants when safe.
- Do not remove shared components that are used elsewhere.
- Do not remove `PlaceholderImage` solely because GallerySection was removed.
- Do not modify unrelated gallery-independent functionality.

---

## Key Locations and How It Works

`KeyLocationsSection` and `HowItWorksSection` are not part of the currently approved homepage order.

Rules:

- Do not render them on the active homepage unless explicitly requested.
- Do not automatically delete their component files.
- Preserve them if they are used on another page.
- Do not restore them simply because they appear in older documentation or older code.
- Remove unused homepage imports when they cause lint errors.

---

# Homepage imports

## Hero source

Use one active HeroSection implementation only.

Preferred import:

```tsx
import { HeroSection } from "@/components/home/HeroSection";
```

Do not import another `HeroSection` from `HomeSections.tsx` at the same time.

If `HomeSections.tsx` still contains an older duplicate HeroSection export:

1. Search the project for all HeroSection imports.
2. Confirm which implementation is active.
3. Preserve the approved active implementation.
4. Remove the duplicate only after confirming it is unused.
5. Do not accidentally remove the approved hero.

---

## HomeSections imports

Import only the sections that are actively used:

```tsx
import {
  WhatIsUnipoleSection,
  WhyChooseSection,
  GroundToSkySection,
  IndustriesSection,
  BusinessGrowthSection,
  FaqSection,
} from "@/components/home/HomeSections";
```

Dedicated components should be imported from their own files when applicable:

```tsx
import { HeroSection } from "@/components/home/HeroSection";
import { InventorySection } from "@/components/home/InventorySection";
import { AssemblyScene } from "@/components/home/AssemblyScene";
import { DayNightCompare } from "@/components/home/DayNightCompare";
import { EnquirySection } from "@/components/home/EnquirySection";
import { FooterSection } from "@/components/home/FooterSection";
```

Inspect actual exports before changing imports.

Do not import `GallerySection` into the active homepage composition.

---

# Current approved Hero

## Hero implementation

The approved hero uses:

- Silk animated background
- ScrollFloat heading animation
- GSAP ScrollTrigger parallax
- Framer Motion reveal animation
- Reduced-motion support
- Explore Sites action
- Plan Campaign action

Approved badge:

```text
NEW
Premium outdoor visibility
```

Approved heading:

```text
One pole. Maximum brand visibility.
```

Approved actions:

```text
Explore Sites
Plan Campaign
```

---

## Hero behaviour

Preserve:

- Silk animated background
- Current ADINN red colour treatment
- ScrollFloat heading animation
- Background parallax
- Content parallax
- Framer Motion content reveal
- Reduced-motion handling
- Explore Sites scrolling to `#inventory`
- Plan Campaign opening the campaign-plan interaction
- Responsive centre alignment
- No horizontal overflow

Do not:

- Replace the Silk hero with an older photographic hero
- Restore the old “Visibility That Stays” heading
- Add a split-column layout
- Add a card-like outer hero container
- Add a rounded hero frame
- Add fake statistics
- Add cities, formats or sites statistics
- Add an “Interactive structure” badge
- Add WebGL to the main hero
- Add large artificial light beams
- Add excessive scale or bounce effects
- Change unrelated sections while adjusting the hero

The Three.js structure belongs to the separate Scroll-driven Assembly section.

---

## ScrollFloat component

Canonical component path:

```text
src/components/text/ScrollFloat.tsx
```

Canonical import:

```tsx
import ScrollFloat from "@/components/text/ScrollFloat";
```

Do not maintain two different ScrollFloat implementations.

If this duplicate exists:

```text
src/components/ScrollFloat.tsx
```

Search all imports before removing it.

Only delete the duplicate after confirming that no component still depends on it.

The Hero may use `playOnMount` because it is visible immediately when the page loads.

Preserve the current heading semantics, accessibility ID and reduced-motion behaviour.

---

# Header requirement

File:

```text
src/components/layout/Header.tsx
```

Before scrolling:

- Transparent
- No full-width grey background
- No border
- No ring
- No outer rounded frame
- No horizontal stroke
- White navigation text over the Hero

After scrolling:

- Subtle white or warm-white background
- Light blur is acceptable
- Dark navigation text
- Restrained shadow
- Smooth transition

Do not add unnecessary `border-b` styling to the header wrapper.

Header navigation must continue working with Lenis and existing section anchors.

The Inventory navigation must continue scrolling to:

```text
#inventory
```

---

# About Unipole

The About section must:

- Explain what a UNIPOLE is
- Preserve the current interactive feature list
- Preserve active-item behaviour
- Preserve reduced-motion support
- Preserve its image and responsive layout
- Remain directly below the Hero
- Remain directly above Why Choose

Do not redesign it while changing homepage order.

---

# Why Choose UNIPOLE Advertising

The Why Choose section must remain directly before Available Inventory.

It must preserve the six benefit items:

```text
01 High Visibility
02 Strategic Placement
03 Strong Brand Recall
04 Day and Night Presence
05 Large Creative Impact
06 Flexible Campaign Planning
```

## Carousel design

The approved carousel direction is:

- Large rounded visual cards
- Image above
- Heading and description below
- Clean white background
- Two complete cards visible on desktop where space permits
- Partial neighbouring cards visible on both sides
- One centred card on tablet and mobile
- Smooth previous and next navigation
- Pagination dots
- Equal visual spacing
- Responsive typography
- No horizontal page overflow

## Card sizing requirement

Card width and image height must be independently adjustable.

Use one clearly named configuration object, for example:

```tsx
const WHY_CARD_DIMENSIONS = {
  extraLargeDesktop: {
    cardWidth: 520,
    imageHeight: 360,
    gap: 24,
  },
  largeDesktop: {
    cardWidth: 460,
    imageHeight: 320,
    gap: 24,
  },
  desktop: {
    cardWidth: 390,
    imageHeight: 285,
    gap: 20,
  },
};
```

Rules:

- `cardWidth` controls only card width.
- `imageHeight` controls only image height.
- `gap` controls spacing between cards.
- Do not use a fixed aspect-ratio class when independent height control is required.
- Do not keep multiple conflicting size configurations.
- Do not keep obsolete values such as both `WHY_CARD_SCALE` and `WHY_CARD_SIZE`.
- Keep card title sizes responsive.
- Keep descriptions readable without excessive empty space.
- Keep all cards visually balanced.

---

# Available Inventory

## Position

Available Inventory must appear directly after Why Choose UNIPOLE Advertising.

It must remain within the first five main content sections because browsing and shortlisting sites is a primary website objective.

Approved journey:

```text
Understand the product
→ Understand the benefits
→ Browse available locations
→ Add locations to campaign plan
→ Request proposal
```

---

## Inventory functionality to preserve

Preserve:

- Available Inventory heading
- Browse UNIPOLE locations heading
- Result count
- Search field
- City filter
- Area filter
- Size filter
- Illumination filter
- Availability filter
- Reset filters
- Inventory cards
- Site images
- Media code
- City
- Area
- Dimensions
- Illumination
- Facing direction
- Availability status
- Pricing status
- Details action
- Add action
- View Campaign Plan action
- Product modal behaviour
- Campaign-plan behaviour
- URL behaviour
- Local-storage persistence
- Responsive grid
- Empty state
- Section ID

Required anchor:

```text
#inventory
```

Do not change inventory data while moving the section.

Do not duplicate InventorySection.

Do not describe the Add action as confirmed booking.

---

# Day and Night

Visible headings:

```text
Day & Night
Visible Through Every Hour
```

The Day & Night section must appear:

- After Available Inventory
- Before Scroll-driven Assembly

Preserve:

- Existing comparison interaction
- Day and night visuals
- Existing slider or interaction behaviour
- Responsive layout
- Existing images
- Existing accessibility support
- Existing animations

Do not redesign it while changing section order.

---

# Scroll-driven Assembly

Visible headings:

```text
Scroll-driven assembly
How a UNIPOLE takes shape.
```

Supporting instruction:

```text
Scroll to assemble the structure step by step.
Scroll back to reverse it.
When complete, drag the model to rotate it.
```

Required stages:

```text
01 Foundation
02 Pole
03 Support
04 Frame
05 Display
06 Lighting
07 Campaign Surface
08 Complete
```

Preserve:

- Scroll-driven stage progression
- Reverse progression when scrolling upward
- Existing GSAP and ScrollTrigger logic
- Three.js model
- React Three Fiber scene
- Drag-to-rotate behaviour
- Reduced-motion behaviour
- Responsive layout
- Stage labels
- ScrollTrigger cleanup
- Existing refs
- Existing model loading
- Existing performance safeguards

Do not replace or remove:

```text
src/components/three/HeroScene.tsx
src/components/three/UnipoleModel.tsx
src/components/home/AssemblyScene.tsx
```

These files belong to the Assembly experience, not the main Hero.

---

# Installation Journey

Visible headings:

```text
From Ground to Sky
The installation journey.
```

This section must appear directly after Scroll-driven Assembly.

Preserve the installation stages:

- Site Identification
- Structural Planning
- Foundation Preparation
- Pole Installation
- Display Frame Setup
- Electrical and Lighting
- Campaign Mounting
- Final Inspection

Do not redesign it while changing section order.

---

# Industries Served

Visible headings:

```text
Industries Served
Trusted across every category that needs visibility.
```

This section must appear:

- After The Installation Journey
- Before Business Growth

Preserve the existing industry list and icons.

Do not replace the industry list with fake customer logos or testimonials.

---

# Business Growth

Visible headings:

```text
Business Growth Journey
How outdoor presence supports growth.
```

This section must appear:

- After Industries Served
- Before FAQ

Preserve the existing business-growth journey:

- Strategic Location
- Campaign Visibility
- Repeated Exposure
- Brand Recall
- Customer Consideration
- Business Enquiry

Do not add fake performance statistics.

---

# FAQ

Visible headings:

```text
FAQ
Answers to common questions.
```

The FAQ must appear:

- After Business Growth
- Before Enquiry

Preserve:

- Accordion interaction
- Existing questions and answers
- Keyboard accessibility
- `aria-expanded`
- Current responsive design
- Current opening and closing behaviour

---

# Enquiry

Visible heading:

```text
Request a campaign proposal.
```

The Enquiry section must appear directly before Footer.

Preserve:

- Current form fields
- Validation
- Submission handling
- Campaign-plan integration
- Existing contact information
- Existing responsive layout
- Existing success and error handling

Do not change form business logic while reordering sections.

---

# Footer

Footer must:

- Remain the final visible website section
- Preserve existing links
- Preserve contact details
- Preserve branding
- Preserve legal information
- Preserve responsive behaviour

Campaign drawers, product modals and toast overlays may render after Footer in the React tree because they are overlays, but Footer must remain the final visible page section.

---

# Existing public assets

Original usable images may exist in:

```text
public/images/
public/images/unipole/
public/images/hero/
```

Important existing fallback image:

```text
public/images/unipole/hero.webp
```

Before referencing any asset, confirm that the physical file exists.

Use:

```powershell
Get-ChildItem "D:\unipole_new\adinn-unipole-premium\public\images" -Recurse -File
```

Never invent an asset path.

Do not create empty placeholders for missing assets.

Do not reference any of the following unless the files physically exist:

```text
public/images/hero/evening-sky.jpg
public/images/hero/cloud-01.png
public/images/hero/cloud-02.png
public/images/hero/cloud-03.png
public/images/hero/distant-unipoles.png
public/images/hero/main-unipole.png
public/images/hero/road-foreground.png
public/images/hero/light-trails.png
```

---

# Campaign-plan behaviour to preserve

Keep working:

- CampaignPlanProvider
- CampaignPlanContext
- Local-storage persistence
- CampaignPlanDrawer
- AddedToPlanToast
- ProductModal
- Inventory filters
- Add to Campaign Plan
- Remove from Campaign Plan
- View Campaign Plan
- Product modal URL behaviour
- Lenis scroll management
- Focus trapping
- Focus restoration
- Body-scroll locking
- Keyboard accessibility

Do not redesign or break campaign-plan behaviour while editing layout or section order.

---

# Responsive requirements

Test the website at approximately:

```text
360px
390px
640px
768px
1024px
1280px
1440px
1600px and above
```

Confirm:

- No horizontal overflow
- No clipped headings
- No overlapping navigation
- No cards extending outside the viewport
- No broken carousel positioning
- No oversized text on laptops
- No unreadably small text on mobile
- Touch controls remain usable
- Buttons remain reachable
- Inventory filters wrap correctly
- Campaign Plan remains usable
- Day & Night remains usable
- Assembly remains usable
- Footer remains readable

---

# Accessibility requirements

Preserve:

- Semantic heading hierarchy
- `aria-labelledby`
- `aria-expanded`
- `aria-current`
- Button labels
- Carousel labels
- Focus-visible states
- Keyboard navigation
- Reduced-motion support
- Accessible modal behaviour
- Focus trapping
- Focus restoration
- Screen-reader status announcements where already implemented

Do not remove accessibility attributes to simplify code.

---

# Strict working rules

## Scope protection

Make the smallest complete change required.

When the task is only to reorder sections:

- Change only the homepage composition order.
- Do not edit internal section JSX.
- Do not change internal styling.
- Do not change content.
- Do not change animations.
- Do not change business logic.
- Do not change section IDs.
- Do not change inventory data.
- Do not change campaign-plan behaviour.
- Do not change modal behaviour.
- Do not change Header or Footer design.
- Do not modify unrelated files.

When the task is only to adjust one section:

- Edit only that section and its directly related styling.
- Do not redesign neighbouring sections.
- Do not restructure unrelated components.
- Do not remove working functionality.

---

## General rules

- Inspect the current file before editing.
- Inspect all relevant imports before deleting anything.
- Do not assume a file exists.
- Do not assume an asset exists.
- Do not duplicate components.
- Do not leave obsolete duplicate implementations.
- Do not delete unrelated sections.
- Do not change routing architecture.
- Do not change the framework.
- Do not run Git commands unless explicitly requested.
- Do not add dependencies unless strictly necessary.
- Preserve current business behaviour.
- Preserve current responsive behaviour.
- Preserve current animations unless the task specifically changes them.
- Remove only imports and code made unused by the requested change.
- Report exact files modified.
- Do not claim validation passed unless commands were actually run.

---

# Current implementation priority

When this document conflicts with older code, older prompts or older documentation:

1. Inspect the actual current source files.
2. Preserve working functionality.
3. Follow the latest approved project decision.
4. Use this document as the current source of truth.
5. Update this document after an approved structural change.
6. Never restore an older section or layout solely because it exists in old code.
7. Never restore Campaign Gallery unless explicitly requested.
8. Never restore the previous photographic Hero unless explicitly requested.
9. Never restore an old homepage order after the current order has been approved.

---

# Validation commands

Run commands from:

```powershell
cd "D:\unipole_new\adinn-unipole-premium"
```

Then run:

```powershell
npm run lint
npm run build
```

Fix every error caused by the requested change.

Do not change unrelated components merely to silence unrelated warnings without first reporting them.

For local preview:

```powershell
npm run dev
```

Use the exact local URL printed by Next.js.

---

# Final validation checklist

Before reporting completion, confirm:

- Correct project folder was used
- Homepage sections follow the approved order
- Hero appears first
- About appears after Hero
- Why Choose appears after About
- Inventory appears after Why Choose
- Day & Night appears after Inventory
- Assembly appears after Day & Night
- Installation appears after Assembly
- Industries appears before Business Growth
- FAQ appears before Enquiry
- Enquiry appears before Footer
- Footer is the final visible section
- Campaign Gallery is not rendered
- Inventory is not duplicated
- No other section is duplicated
- No section ID was changed
- `#inventory` navigation works
- No broken-image icons
- No missing asset paths
- No horizontal overflow
- Header has no unwanted stroke before scrolling
- Hero content is readable
- Why Choose carousel is responsive
- Why Choose card width and image height are independently adjustable
- Inventory filters work
- Product modal works
- Campaign Plan works
- Day & Night works
- Assembly scroll animation works
- Assembly reverses when scrolling upward
- Assembly model remains draggable when complete
- FAQ works
- Enquiry form works
- Mobile layout is readable
- TypeScript passes
- Lint passes
- Production build passes

---

# Expected completion report

Report only:

1. Files inspected
2. Files modified
3. Previous homepage order
4. New homepage order
5. What was changed
6. What was intentionally not changed
7. Removed section status
8. Asset paths used
9. Lint result
10. Build result
11. Remaining limitations

Do not provide a vague completion message.

Do not claim success without confirming the actual command results.