# UNIPOLE Website — Claude Code Instructions

Updated: 04 August 2026

## Project

Project root: `D:\Unippole_Single_page_web`

This is a premium single-page UNIPOLE advertising website for ADINN Advertising Services Ltd.

## Technology

- Next.js 16.2.11
- React
- TypeScript
- Tailwind CSS v4
- Framer Motion
- GSAP
- ScrollTrigger
- SplitText
- Lenis
- Three.js
- React Three Fiber
- Drei

## Mandatory Working Rules

1. Read this file before editing the project.
2. Work only on files directly related to the current task.
3. Do not scan the complete repository unless a required import cannot be resolved.
4. Do not inspect `node_modules`, `.next`, build output or unrelated sections.
5. Preserve the existing page order, content, UI, animation, responsive behaviour and functionality unless the task explicitly requests a change.
6. Do not redesign unrelated components.
7. Do not remove working code simply to make a file smaller.
8. Use Tailwind CSS for layout and styling.
9. Do not create separate CSS files unless the current component already depends on one.
10. Read `package.json` before installing anything.
11. Install only genuinely missing packages.
12. Report every installed package and why it was required.
13. Preserve reduced-motion support.
14. Clean up GSAP ScrollTriggers, observers, event listeners and animation frames.
15. Do not run Git commands.
16. Edit the actual project files directly.
17. Run lint and build only after implementation is complete.
18. Never claim lint or build passed unless the commands were actually run successfully.

## Claude Code Response Rules

When using Claude Code:

- Edit the actual local files.
- Do not print complete changed files in the final response unless explicitly requested.
- Do not repeat the original prompt.
- Do not give a long project summary after every task.
- Report only:
  - files inspected
  - files changed
  - important changes
  - lint result
  - build result
  - remaining issue

When the user asks for manual copy code:

- Provide one complete ready-to-use file.
- Include imports, types, components and exports.
- Do not provide partial snippets.
- Do not provide download links or ZIP files.
- The user prefers copying code directly from the chat.

## Context and Token Usage

Keep the Claude Code context small.

For every task:

- Inspect only the named files.
- Do not search the complete project by default.
- Do not repeat previous prompts.
- Do not print large unchanged files.
- Do not read `PROJECT_PROGRESS.md` unless previous implementation history is required.
- Use `/compact` when continuing the same task.
- Use `/clear` only after important progress is saved in `PROJECT_PROGRESS.md`.

This file must contain permanent project rules only.

Completed work, current bugs and the next task belong in `PROJECT_PROGRESS.md`.

## Main Project Files

Application:

- `src/components/ClientApp.tsx`
- `src/components/layout/Header.tsx`

Home sections:

- `src/components/home/HomeSections.tsx`
- `src/components/home/InventorySection.tsx`
- `src/components/home/GroundToSkySection.tsx`
- `src/components/home/EnquirySection.tsx`
- `src/components/home/FooterSection.tsx`

Existing 3D CTA:

- `src/components/home/ProceduralUnipole.tsx`
- `src/components/home/CTAUnipoleScene.tsx`
- `src/components/home/ProposalBanner3D.tsx`

Assets:

- `public/images/`
- `public/models/`
- `public/AdinnLogo.svg`

## ClientApp Integration

`GroundToSkySection` must be imported from:

`import { GroundToSkySection } from "@/components/home/GroundToSkySection";`

Keep:

`<GroundToSkySection />`

Do not import `GroundToSkySection` from `HomeSections.tsx`.

Do not render:

`<IndustriesSection />`

The visible Industries section is intentionally removed.

An old compatibility export may remain inside `HomeSections.tsx`:

`export function IndustriesSection() { return null; }`

Do not recreate the visible Industries section unless explicitly requested.

## Visual Design Rules

- Keep the UI clean, premium and professional.
- Avoid childish styling.
- Avoid game-like 3D effects.
- Avoid excessive shadows.
- Avoid heavy bloom, particles, neon glow and bouncing animations.
- Use ADINN red only as a controlled accent.
- Use `#EEEDF0` for mild active backgrounds and visible control backgrounds.
- Keep spacing balanced on large desktop, laptop, tablet and mobile.
- Prevent horizontal overflow.
- Preserve the current page order.
- Do not change established colours without approval.

## Hero Section

Source: `src/components/home/HomeSections.tsx`

Preserve:

- Silk background
- GSAP parallax
- Subtle content movement during scroll
- Existing heading and badge
- Explore Sites CTA
- Campaign planning CTA behaviour
- Reduced-motion support
- Current typography hierarchy

Do not redesign the Hero unless explicitly requested.

## About UNIPOLE Section

Source: `src/components/home/HomeSections.tsx`

Current layout:

- Heading on the left
- Dynamic paragraph
- Three feature blocks
- Dynamic image on the right
- White background
- Active feature uses `#EEEDF0`
- No feature icons
- No red active indicator

Desktop behaviour:

- The section is pinned with GSAP ScrollTrigger.
- The active feature changes according to scroll progress.
- Description and image must change at the same time.
- Description uses a lightweight SplitText line reveal.
- Do not add hover-controlled feature switching.
- Avoid continuous React state updates during scrub.

Expected image paths:

- `/images/unipole-about.jpg`
- `/images/high-visibility.jpg`
- `/images/strategic-placement.jpg`

Expected local files:

- `public/images/unipole-about.jpg`
- `public/images/high-visibility.jpg`
- `public/images/strategic-placement.jpg`

Important:

- Verify that all three files exist.
- Verify that all three files are different images.
- Do not silently show the same fallback image for every feature.
- Missing image paths previously caused the same image to appear for every stage.

Use:

`<AnimatePresence mode="sync" initial={false}>`

Recommended image transition:

`duration: reducedMotion ? 0 : 0.22`

Recommended entry values:

- opacity: 0
- y: 8
- scale: 1.01

Recommended exit values:

- opacity: 0
- y: -6
- scale: 0.995

Keep the image wrapper dimensions fixed to prevent layout shifting and long grey flashes.

## Why Choose UNIPOLE Section

Source: `src/components/home/HomeSections.tsx`

Preserve:

- Responsive carousel
- Mouse dragging
- Touch swiping
- Grab and grabbing cursor
- Previous and next controls
- `#EEEDF0` arrow backgrounds
- Pagination dots
- Velocity-aware movement
- Snap-back after small drag
- Infinite loop reset
- Native vertical mobile scrolling

Do not restore image hover zoom.

Do not enable native browser image dragging.

## Inventory Section

Source: `src/components/home/InventorySection.tsx`

Preserve:

- 400, 500, 600, 800 and 900 series
- Fully clickable cards
- Pointer cursor
- Selected image inside the modal
- Optional variation images
- Background page scroll lock
- Right-side details scrolling
- Hidden details scrollbar
- `object-contain` modal image
- Variation navigation
- Existing responsive card layout
- Single-result CTA placement

Do not change the inventory data structure unless explicitly requested.

## Enquiry Section

Source: `src/components/home/EnquirySection.tsx`

Desktop layout:

Left column:

- Build with ADINN
- Build your landmark
- Supporting paragraph
- Phone
- Email
- WhatsApp

Right column:

- Complete enquiry form

Current supporting copy:

“Planning a new unipole? Share your site details, and our team will guide you from survey to installation.”

Form fields:

- Full name
- Company or business name
- Email
- Phone number
- Project location
- Type of unipole
- Site or project details
- Consent checkbox

Unipole options:

- Standard Unipole
- LED Unipole
- Special Signage

Submission opens WhatsApp with prefilled project details.

Preserve validation and responsive stacking.

## Footer Section

Source: `src/components/home/FooterSection.tsx`

Current contacts:

- `+91 73395 09090`
- `+91 95003 88761`
- `roadshowsales@adinn.co.in`

Locations:

- Madurai
- Chennai
- Bangalore
- Coimbatore

Preserve:

- ADINN logo
- Company description
- Social media icons
- Large ADINN UNIPOLE TextPressure effect
- Professional variable-font deformation
- Compact spacing
- No excessive shadows
- No extreme thin or thick distortion

Logo path:

`/AdinnLogo.svg`

Do not create or use:

`src/components/layout/Footer.tsx`

`ClientApp.tsx` already imports and renders `FooterSection`.

## Existing 3D CTA

Files:

- `src/components/home/ProceduralUnipole.tsx`
- `src/components/home/CTAUnipoleScene.tsx`
- `src/components/home/ProposalBanner3D.tsx`

This section is separate from the Ground-to-Sky installation journey.

Do not merge their responsibilities.

Do not modify the existing 3D CTA unless the task explicitly targets it.

## Ground-to-Sky Installation Section

Source: `src/components/home/GroundToSkySection.tsx`

Figma reference:

`https://www.figma.com/proto/9h9OMN1I5HpyiiShOSyTrn/Unipole?page-id=0%3A1&node-id=130-2`

Reference node:

`130:2`

Required stage order:

1. Site Survey & Soil Analysis
2. Structural Engineering
3. Foundation Preparation
4. Pole Installation
5. Display Frame Assembly
6. Electrical & Lighting
7. Signage Installation
8. Final Safety Inspection

Required heading text:

- From Ground to Sky
- The installation journey.

Heading classes:

From Ground to Sky:

`text-[clamp(1.25rem,1.8vw,1.8rem)] font-medium leading-tight tracking-[-0.025em] text-white`

The installation journey:

`mt-2 text-[clamp(2.35rem,3.8vw,3.75rem)] font-normal leading-[1] tracking-[-0.045em] text-white`

Active stage title classes:

`origin-left bg-gradient-to-r from-[#FD8D94] to-[#7A6EE6] bg-clip-text text-[clamp(2.8rem,5vw,5.7rem)] font-medium leading-[0.95] tracking-[-0.05em] text-transparent`

## Ground-to-Sky Layout

Desktop:

- Black background
- Centred section heading
- Large sticky 3D scene on the left
- Vertical timeline in the middle
- Animated stage content on the right
- Sticky “installation stage” heading

Canvas requirements:

- Do not place the Canvas inside a compressed decorative card.
- Remove unnecessary border, shadow and card styling.
- Use the complete available left-column space.
- Preserve the website’s normal outer margin.
- Keep the complete board, pole, rear frame and foundation visible.
- Do not crop the model.
- Keep “Drag to rotate” positioned over the Canvas.

Tablet:

- Reduce scene scale and typography.
- Keep the complete model visible.
- Keep the timeline balanced.

Mobile:

- Use normal stacked scrolling.
- Do not force the desktop sticky split layout.
- Prevent horizontal overflow.
- Stage 8 sticky holding may be disabled on mobile.

## Stage Content Motion

Stages 1 to 7:

- Enter smaller.
- Scale up near viewport centre.
- Reach full size at the centre.
- Scale down while leaving.
- Work in forward and reverse scroll.
- Description fades and translates smoothly.
- Number circle scales with the active title.

Stage 8:

- Enters the centre like the other stages.
- Reaches full active size.
- Remains centred until the section ends.
- Must not continue moving upward.
- Must not scale down while scrolling toward the section end.
- Releases naturally during reverse scrolling.
- Must not use permanent `position: fixed`.
- Must not create excessive empty space below the section.
- The completed UNIPOLE must remain visible while Stage 8 is held.

## Heading and Mask Behaviour

The navigation may visually sit above the black section background.

However:

- Stage content must not cover the main navigation.
- Stage content must not cover “From Ground to Sky”.
- Stage content must not cover “The installation journey.”
- The sticky “installation stage” heading must remain below the main section heading.
- A black mask may cover only the right stage-content column.
- The mask must not cover the 3D scene.
- Do not use a large absolute black element extending above the sticky heading.

Recommended z-index order:

- Main website header: `z-[100]` or higher
- Installation sticky heading: `z-20` to `z-30`
- Canvas, timeline and stage content: below the sticky heading

Do not redesign the main navigation.

## Timeline Alignment

Use one dedicated timeline column.

The vertical line and every numbered circle must use the same centre axis.

Recommended alignment:

- Vertical line: `left-1/2`
- Number circle: `left-1/2 -translate-x-1/2`

Do not position the line and circles using unrelated left values.

Number 8 must remain centred on the timeline during the final hold.

## Ground-to-Sky 3D Sequence

Required sequence:

1. Site and environment preview
2. Engineering wireframe
3. Foundation and anchor bolts
4. Pole installation
5. Rear frame assembly
6. Maintenance platform, ladder and lights
7. Front signage installation
8. Final lighting and safety inspection

Rear frame:

- Must be a separate group.
- Must enter from behind the pole.
- Must lock onto the rear mounting structure.
- Must have visible depth.
- Must include visible cross bracing.

Signage panel:

- Must be a separate group.
- Must enter from the camera-facing front side.
- Must move backward and seat onto the rear frame.
- Must not grow from rods.
- Must not intersect the pole.
- Reverse scrolling must reverse the sequence cleanly.

## Required UNIPOLE Structure

The model should contain or convincingly represent:

- Foundation
- BasePlate
- AnchorBolts
- Pole
- GussetPlates
- RearMount
- MainSupportBeam
- CantileverBrackets
- RearFrame
- CrossBracing
- MaintenancePlatform
- Ladder
- LightArms
- FloodLights
- SignageBoard
- ElectricalDetails

Correct structural hierarchy:

Foundation → Base plate → Tapered pole → Rear mounting head → Horizontal support beam → Cantilever brackets → Rear billboard frame → Front signage panel

Critical requirements:

- The pole must not pass through the visible billboard face.
- The pole must end below and behind the billboard.
- The front artwork must remain uninterrupted.
- From a side angle, the rear mounting structure must be visible.

## 3D Environment

Trees:

- Do not use only one cylinder and one sphere.
- Use slightly tapered trunks.
- Use multiple foliage clusters.
- Vary cluster size, position, scale and rotation.
- Use irregular silhouettes.
- Use subtle green variations.
- Avoid identical cloned trees.
- Keep trees secondary to the UNIPOLE.

Road and buildings:

- Keep road material subtle.
- Keep lane markings controlled.
- Use buildings with varied heights and depths.
- Use subtle window lighting.
- Do not add heavy particles or unnecessary traffic effects.

## Billboard Lighting

Remove decorative floodlights placed on or near the road.

All billboard lights must:

- Attach to the billboard frame or light arms.
- Use believable mounting brackets.
- Face the advertising board.
- Illuminate only the signage panel.
- Not point toward the road, trees, foundation or sky.

Each fixture should include:

- Metal housing
- Glass lens
- Mounting yoke
- Side brackets
- Rear cooling fins
- Dark powder-coated finish
- Controlled emissive lens

Actual illumination must come from Three.js `spotLight`.

Create dedicated `THREE.Object3D` targets across the board face.

Assign every spotlight to a board target.

Lighting behaviour:

- Before Stage 6: intensity is zero or very low.
- During Stage 6: lights gradually turn on.
- During Stages 7 and 8: the board is fully illuminated.

Use:

- Warm-neutral white
- Approximately 4000K to 5000K
- Medium spotlight angle
- Soft penumbra
- Believable distance and decay
- Controlled intensity

Avoid:

- Excessive bloom
- Neon glow
- Light facing the road
- Decorative foundation lights
- Overexposed board artwork

## 3D Model Quality

Before rebuilding the model, inspect:

- `public/`
- `public/models/`

Look for:

- `.glb`
- `.gltf`

If a suitable model exists:

- Load it with `useGLTF`.
- Preserve its geometry.
- Preserve its PBR materials.
- Animate its named parts.
- Do not replace it with simple procedural boxes.

Recommended model path:

`public/models/adinn-unipole.glb`

Recommended object names:

- Foundation
- BasePlate
- AnchorBolts
- Pole
- GussetPlates
- RearMount
- RearFrame
- CrossBracing
- MaintenancePlatform
- Ladder
- LightArms
- FloodLights
- SignageBoard
- ElectricalDetails

A procedural model made only from basic boxes and cylinders cannot honestly match Blender or Maya production quality.

When no GLB exists:

- Improve the procedural model as far as practical.
- Use realistic proportions.
- Use bevelled geometry where practical.
- Use physically believable materials.
- Clearly report that a production GLB is still recommended.

## Material Direction

Galvanized steel:

- High metalness
- Moderate roughness
- Light grey colour
- Visible edge highlights
- Not mirror-like

Painted frame:

- Dark charcoal steel
- Must remain visible against the black background
- Do not use pure black

Concrete:

- Non-metallic
- High roughness
- Slight surface variation

Signage:

- Non-metallic printed surface
- Satin finish
- Correct front-facing orientation

Floodlights:

- Dark coated metal
- Glass lens
- Controlled emissive material
- Visible mounting brackets

## Camera and Interaction

Preserve:

- Drag-to-rotate
- Disabled wheel zoom
- Normal page scrolling
- Reduced-motion support

Prevent:

- Upside-down views
- Extreme vertical rotation
- Awkward angles
- Billboard cropping
- Foundation cropping
- Canvas blocking page scrolling

Recommended OrbitControls direction:

- `enableZoom={false}`
- `enablePan={false}`
- `enableDamping`
- `minPolarAngle={1.1}`
- `maxPolarAngle={1.65}`
- `minAzimuthAngle={-0.8}`
- `maxAzimuthAngle={0.8}`

Adjust the camera position, FOV, model scale and OrbitControls target together.

Do not solve model framing only by moving the camera extremely close.

## Performance Rules

- Use `dpr={[1, 1.5]}`.
- Reuse materials and geometries.
- Avoid unnecessary React state changes inside `useFrame`.
- Animate refs directly.
- Use instancing where practical.
- Pause or reduce rendering when the section is outside the viewport.
- Keep texture sizes controlled.
- Avoid heavy postprocessing.
- Preserve laptop and mobile performance.

## Package Rules

Read `package.json` before installing anything.

Expected existing packages:

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `gsap`
- `framer-motion`

Optional packages only when justified:

- `@react-three/postprocessing`
- `postprocessing`
- `gltfjsx`
- `@gltf-transform/cli`

Do not install optional packages automatically.

## Verification

After completing a code task, run:

`npm run lint`

`npm run build`

Verify:

- No duplicate imports
- No undefined components
- No IndustriesSection runtime error
- No hydration error
- No missing image path
- No missing model path
- No undefined GLTF nodes
- No ScrollTrigger memory leaks
- Header remains visible
- Main installation heading is not covered
- Stage 8 remains centred
- Timeline remains aligned
- Canvas does not block page scrolling
- No horizontal overflow
- Mobile does not use the desktop pinned layout
- Reverse scrolling works
- Reduced-motion support works

## Final Claude Code Report

After completing a task, report only:

1. Files inspected
2. Files changed
3. Main implementation changes
4. Packages installed and why
5. Responsive behaviour
6. Reduced-motion handling
7. Lint result
8. Build result
9. Remaining limitation

Do not include:

- Repeated prompts
- Long project history
- Unchanged source code
- Complete repository summaries
- Unsupported claims