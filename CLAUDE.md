UNIPOLE Website — Claude Project Instructions and Current Progress

Project: UNIPOLE Single Page WebsiteProject path: D:\Unippole_Single_page_webUpdated: 04 August 2026Primary stack: Next.js 16.2.11, TypeScript, Tailwind CSS, Framer Motion, GSAP/ScrollTrigger, React Three Fiber, Drei

1. Working Rules

Read this file completely before changing the project.

General rules

Do not redesign existing sections unless the task explicitly requests a redesign.

Preserve the current page order, copy, responsive behaviour and section functionality.

Prefer complete ready-to-use files instead of partial snippets.

Use Tailwind CSS for layout and styling.

Do not create separate CSS files unless the existing component already requires one.

Do not install packages before reading package.json.

Install only genuinely missing packages and report why each package was required.

Preserve reduced-motion support.

Clean up GSAP ScrollTriggers, event listeners, observers and animation frames.

Do not run Git commands.

Do not edit unrelated components.

Run npm run lint and npm run build after changes.

Never report lint or build as successful unless the commands were actually run successfully.

Visual rules

Keep the visual language clean, premium and professional.

Avoid childish or game-like 3D treatments.

Avoid excessive bloom, neon effects, particles, shadows and bouncing animations.

Use #EEEDF0 for mild grey fills and visible control backgrounds where relevant.

Use ADINN red only as a controlled accent.

Keep spacing balanced across large desktop, laptop, tablet and mobile screens.

Do not allow sticky sections or masks to overlap the main navigation.

2. Current Project File Map

Main page integration

src/components/ClientApp.tsx

src/components/home/HomeSections.tsx

src/components/home/InventorySection.tsx

src/components/home/GroundToSkySection.tsx

src/components/home/EnquirySection.tsx

src/components/home/FooterSection.tsx

Existing 3D CTA files

src/components/home/ProceduralUnipole.tsx

src/components/home/CTAUnipoleScene.tsx

src/components/home/ProposalBanner3D.tsx

Main header

src/components/layout/Header.tsx

Current component import rule

ClientApp.tsx must import the installation section from:

import { GroundToSkySection } from "@/components/home/GroundToSkySection";

It must not import GroundToSkySection from HomeSections.tsx.

The page JSX must continue using:

<GroundToSkySection />

3. Hero Section

Completed

Existing Hero structure and visual design preserved.

Silk animated background retained.

GSAP background parallax added.

Hero content moves subtly upward during scroll.

Existing heading, badge and CTA buttons preserved.

Explore Sites scrolls to Inventory.

Campaign planning CTA behaviour preserved where still used.

Reduced-motion support retained.

Do not change without instruction

Hero composition

Existing CTA behaviour

Silk background system

Current typography hierarchy

4. About UNIPOLE Section

Current structure

The original layout is preserved:

Heading on the left

Dynamic paragraph below the heading

Three feature blocks below the paragraph

UNIPOLE image on the right

Completed styling

White section background

Reduced excessive top spacing

Shorter, vertically centred image

Feature icons removed

Red active indicator removed

Active feature uses #EEEDF0

Rounded feature blocks retained

Hover, click and focus-triggered content switching removed

Feature state changes only through scrolling

Current interaction

Desktop section is pinned with GSAP ScrollTrigger

Active feature changes during scroll

Dynamic description updates per stage

Description uses lightweight line-by-line GSAP SplitText reveal

Heavy 3D text rotation and autoSplit were removed

Reduced-motion is respected

ScrollTrigger cleanup is included

Performance rules

Do not reintroduce continuous React state updates during scrub

Do not add hover-controlled feature changes

Do not split every text element

Keep pin duration controlled

5. Why Choose UNIPOLE Advertising Section

Completed

Existing responsive carousel retained

Previous and next buttons retained

Arrow controls use visible #EEEDF0 backgrounds

Pagination dots retained

Image hover zoom removed

Native image dragging disabled

Drag behaviour

Mouse dragging

Touch swiping

Grab and grabbing cursor states

Velocity-aware swipe

Snap to nearest card

Small drag returns to current card

Large or fast drag moves next or previous

Infinite-loop reset without visible jump

Arrow and pagination protection during animation

Vertical mobile scrolling preserved with touch-pan-y

6. Inventory Section

Current source of truth

Project destination:

src/components/home/InventorySection.tsx

Latest feature set:

Dynamic inventory data for 400, 500, 600, 800 and 900 series

Fully clickable cards

Pointer cursor for interactive cards

Selected card image shown inside the modal

Optional variation images supported

Modal navigation controls positioned around the overall modal

Background page scroll locked while modal is open

Only right-side details panel scrolls

Details scrollbar hidden visually

Modal image uses object-contain

Variation cards use filled styling without border strokes

Single filtered result shows CTA below the card

Full inventory view uses four cards in row one and the fifth card with CTA in row two

Do not change without instruction

Inventory data structure

Modal scroll lock

Image containment

Variation navigation

Existing responsive card layout

7. Enquiry / Contact Section

Current project destination

src/components/home/EnquirySection.tsx

Current layout

Desktop:

Left column:

Build with ADINN

Build your landmark

Short supporting paragraph

Phone

Email

WhatsApp

Right column:

Full enquiry form

Mobile and tablet:

Columns stack naturally

Form remains fully visible

No forced desktop height

Current copy

Heading:

Build with ADINN
Build your landmark

Supporting copy:

Planning a new unipole? Share your site details, and our team will guide you from survey to installation.

The following long supporting line was intentionally removed:

We support site assessment, soil analysis, structural planning, fabrication, lighting and complete on-site installation.

Form fields

Full name

Company / Business name

Email

Phone number

Project location

Type of unipole

Site / Project details

Consent checkbox

Unipole options

Standard Unipole

LED Unipole

Special Signage

Behaviour

Submission opens WhatsApp with prefilled project details

Existing validation must be preserved

Keep Tailwind-only layout and spacing

Maintain balanced vertical gaps between rows

8. Footer Section

Current project destination

src/components/home/FooterSection.tsx

Current content

Roadshow logo / ADINN logo area

Short company description

Phone:

+91 73395 09090

+91 95003 88761

Email:

roadshowsales@adinn.co.in

Locations:

Madurai

Chennai

Bangalore

Coimbatore

Social media icons

Large ADINN UNIPOLE TextPressure treatment

Current design direction

Professional, balanced variable-font TextPressure effect

Do not use extreme thin/fat deformation

Do not add heavy shadows

Maintain compact spacing

Logo path currently used: /AdinnLogo.svg

Important

ClientApp.tsx already imports and renders FooterSection.

Do not create or use the unrelated extra file:

src/components/layout/Footer.tsx

9. Industries Served Section

The visible Industries section is intentionally removed.

Do not render:

<IndustriesSection />

Do not recreate the section unless explicitly requested.

If IndustriesSection still exists inside HomeSections.tsx, it may remain as:

export function IndustriesSection() {
  return null;
}

However, ClientApp.tsx should not render <IndustriesSection />.

This avoids the runtime error:

ReferenceError: IndustriesSection is not defined

10. Existing 3D CTA Section

Completed

Procedural React Three Fiber UNIPOLE

Foreground model rotates automatically

Model can be dragged manually

Background UNIPOLE structures remain static

Fixed camera

Dark night environment

Stars and comet-like effects

Ground and background treatment retained

No extra HTML marketing copy placed over the scene

Do not confuse this with GroundToSkySection

The existing 3D CTA and the Ground-to-Sky installation journey are separate sections with separate responsibilities.

11. Ground to Sky Installation Journey

Current project destination

src/components/home/GroundToSkySection.tsx

Figma reference

https://www.figma.com/proto/9h9OMN1I5HpyiiShOSyTrn/Unipole?page-id=0%3A1&node-id=130-2&viewport=6640%2C7755%2C0.85&t=7hmsjA2dLnX0UdGo-1&scaling=min-zoom&content-scaling=fixed

Reference node:

130:2

Required stage order

Site Survey & Soil Analysis

Structural Engineering

Foundation Preparation

Pole Installation

Display Frame Assembly

Electrical & Lighting

Signage Installation

Final Safety Inspection

Required section heading

For From Ground to Sky:

<p className="text-[clamp(1.25rem,1.8vw,1.8rem)] font-medium leading-tight tracking-[-0.025em] text-white">

For The installation journey.:

<h2 className="mt-2 text-[clamp(2.35rem,3.8vw,3.75rem)] font-normal leading-[1] tracking-[-0.045em] text-white">

Current intended layout

Desktop:

Black section background

Centred heading

Sticky 3D visual on the left

Vertical timeline in the middle

Animated stage content on the right

Sticky installation stage heading below the main website header

Tablet:

Reduced 3D and typography sizes

No header overlap

Timeline remains balanced

Mobile:

Stack heading, 3D panel and stages

Do not force desktop sticky split layout

Preserve normal page scrolling

Prevent horizontal overflow

Current unresolved issues

The Ground-to-Sky section is not considered complete yet.

Known issues:

Main header can be clipped or covered by the sticky black mask

Sticky installation stage heading can overlap stage text

Active stage titles may scale at the wrong vertical position

Timeline circles can drift away from the centre line

Procedural UNIPOLE still looks like basic coded geometry

Current lighting does not yet reach professional Blender/Maya quality

The model can appear cropped or underlit on some laptop screens

Header and sticky-mask requirements

Required z-index hierarchy:

Main website header: z-[100] or higher

GroundToSky sticky heading: around z-20 to z-30

Timeline, stage text and Canvas: below sticky heading

The sticky mask must:

Cover only the right stage-content column

Stay below the fixed navigation

Never cover the left 3D panel

Never cover the website header

Use solid black background

Include a subtle divider below

Do not use a large absolute black element extending above the sticky heading.

Stage title motion

Required behaviour:

Starts smaller when entering

Scales up near viewport centre

Reaches full size at centre

Scales down while leaving

Works forward and backward

Description fades and translates smoothly

Number circle scales with active title

Avoid abrupt active-index jumps

Prefer GSAP transform animation over React state updates per frame

Suggested active heading style:

className="origin-left bg-gradient-to-r from-[#FD8D94] to-[#7A6EE6] bg-clip-text text-[clamp(2.8rem,5vw,5.7rem)] font-medium leading-[0.95] tracking-[-0.05em] text-transparent"

Timeline alignment

Use one shared timeline column

Centre the vertical line within that column

Centre every number circle using the same axis

Do not position circles and line with unrelated absolute values

Left and right columns must remain balanced

Required 3D sequence

Site/environment preview

Engineering wireframe and measurement state

Foundation and anchor bolts

Pole installation

Rear structural frame assembly

Maintenance platform, ladder and professional lighting

Front signage panel installation

Final lighting and safety inspection

Critical frame and board motion

Rear structural frame must be its own group

Frame enters from behind the pole

Frame locks onto the rear support

Advertising board must be a separate group

Board enters from the front

Board seats onto the finished frame

Board must not grow from rods

Reverse scrolling must reverse the sequence cleanly

Required 3D structure

The model should contain or convincingly represent:

Tapered galvanized steel pole

Concrete foundation

Thick base plate

Anchor bolts, nuts and washers

Welded gusset plates

Rear steel frame with real depth

Cross-bracing

Structural truss support

Maintenance walkway

Access ladder

Light mounting arms

Professional floodlight housings

Billboard frame thickness

Separate front signage panel

Bevelled edges

Realistic proportions

Material direction

Galvanized steel: high metalness, moderate roughness

Painted frame: darker steel with visible edge highlights

Concrete: high roughness, non-metallic

Signage: non-metallic printed surface

Light lenses: controlled emissive or glass material

Do not use pure black materials that hide structural details

Lighting direction

Neutral key light

Soft fill light

Rim light

Contact shadows

Stage 6 onward: real spotlights aimed toward the board

Warm-neutral light around 4000K–5000K

Controlled emissive strength

No extreme bloom

No neon or gaming appearance

Interaction

Keep drag-to-rotate

Limit vertical rotation

Prevent upside-down or awkward views

Disable wheel zoom or avoid blocking page scroll

Keep the model inside the visible camera frame

Preserve reduced-motion support

12. Production-Quality 3D Model Requirement

A procedural model built only from boxes and cylinders cannot honestly match a professional Blender or Maya production asset.

Before rebuilding the procedural model, inspect:

public/

for existing:

.glb
.gltf

files.

If a suitable model exists:

Load it with useGLTF

Reuse the real named parts

Animate the individual parts with GSAP or refs

Preserve realistic PBR materials

Recommended model destination:

public/models/adinn-unipole.glb

Recommended object names:

Foundation
BasePlate
AnchorBolts
Pole
GussetPlates
RearFrame
CrossBracing
MaintenancePlatform
Ladder
LightArms
FloodLights
SignageBoard

If no real model is found:

Improve the procedural fallback only as far as practical

Do not claim Blender/Maya-level quality

Clearly state that a real GLB is still required

Optional packages

Read package.json first.

Expected existing packages:

three
@react-three/fiber
@react-three/drei
gsap
framer-motion

Optional only when justified:

npm install @react-three/postprocessing postprocessing
npm install -D gltfjsx @gltf-transform/cli

Do not install these automatically without explaining why.

13. Header Rules

Main header file:

src/components/layout/Header.tsx

The outer fixed header wrapper must remain above sticky section masks.

Recommended z-index:

z-[100]

Do not redesign the header.

Do not change navigation order, button styling or dimensions unless required for responsive overflow.

Only adjust:

z-index

safe top position

width constraints

responsive overflow protection

14. Verification Checklist

After changes, run:

npm run lint
npm run build

Confirm:

No duplicate imports

No undefined components

No IndustriesSection runtime error

Header remains visible above every section

No horizontal overflow

Sticky sections release correctly

ScrollTrigger cleanup works

Reduced-motion still works

3D Canvas does not block page scrolling

Mobile does not use the desktop pinned layout

Build passes with Next.js 16.2.11 and Turbopack

15. Current Completion Status

Completed

Hero parallax

About sticky content

About lightweight SplitText animation

Why Choose drag carousel

Inventory cards and modal

Separate enquiry section

Footer with locations, social icons and TextPressure

Existing 3D CTA

Industries section removed from visible page

In progress / requires refinement

Ground-to-Sky installation journey

Header and sticky-mask interaction

Viewport-centred stage title scaling

Timeline-centre alignment

Professional 3D lighting

Production-quality realistic UNIPOLE model

Final lint and build verification after the latest GroundToSky changes

16. Required Final Report for Future Changes

After completing a task, report:

Files inspected

Files changed

Imports added or removed

Packages installed and why

Main implementation changes

Responsive changes

Accessibility and reduced-motion handling

Lint result

Build result

Remaining limitations

Do not provide only partial snippets when a complete implementation was requested.