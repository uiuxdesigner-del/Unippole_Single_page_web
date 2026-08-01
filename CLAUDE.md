UNIPOLE Website — UI/UX Development Progress

Project: UNIPOLE Single Page WebsiteProject path: D:\Unippole_Single_page_webUpdated: 01 August 2026Primary stack: Next.js 16, TypeScript, Tailwind CSS, Framer Motion, GSAP/ScrollTrigger, React Three Fiber

1. Current Source of Truth

Use the latest updated Home Sections file:

HomeSections_Why_Drag_Fixed.tsx

Replace it in the project as:

src/components/home/HomeSections.tsx

The latest Inventory section file is:

InventorySection_modal_scroll_image_fix.tsx

Replace it in the project as:

src/components/home/InventorySection.tsx

The current 3D CTA implementation uses:

src/components/home/ProceduralUnipole.tsx

src/components/home/CTAUnipoleScene.tsx

src/components/home/ProposalBanner3D.tsx

2. Hero Section

Completed

Preserved the existing Hero structure and visual design.

Silk animated background retained.

Added smooth GSAP parallax movement to the background.

Hero content moves slightly upward while scrolling.

Existing heading, badge and CTA buttons are preserved.

Explore Sites scrolls to the Inventory section.

Plan Campaign opens the campaign planning interface.

Reduced-motion support is preserved.

3. About UNIPOLE Section

Structure

The original layout was preserved:

Heading on the left.

Dynamic description below the heading.

Three feature content blocks below the description.

UNIPOLE image on the right.

No new timeline, extra cards or redesigned structure.

Completed UI Changes

Section background is pure white.

Reduced the excessive top spacing.

Image height was reduced.

Image remains vertically centred with balanced space above and below.

Removed all feature icons.

Removed the small red active indicator line.

Feature blocks use a mild grey filled background.

Active feature background:

#EEEDF0

Text colours remain unchanged.

Rounded feature blocks retained.

Hover interaction was removed.

Click interaction was removed.

Focus-triggered content changes were removed.

Feature state now changes only according to scrolling.

Scroll Behaviour

The section is pinned on desktop using GSAP ScrollTrigger.

During scrolling:

Single Pole Structure becomes active.

Maximum Visibility becomes active.

Strategic Locations becomes active.

The main paragraph updates according to the active scroll stage.

Text Animation

Dynamic description uses GSAP SplitText.

Animation is line-by-line.

Heavy 3D rotation was removed.

autoSplit was removed from this section to reduce repeated recalculation.

Animation uses a lightweight upward fade.

Reduced-motion preference is respected.

Performance Changes

To reduce hanging and unnecessary browser work:

Removed scroll scrub.

State updates happen only when the active feature index changes.

Removed hover-driven state updates.

Removed heavy 3D SplitText rotation.

Only the changing description is split.

Section pin duration was shortened.

ScrollTrigger cleanup is included.

4. Why Choose UNIPOLE Advertising Section

Completed UI

Existing carousel design preserved.

Card sizes remain responsive.

Previous and next navigation buttons are retained.

Arrow buttons now have a visible background without requiring hover:

#EEEDF0

Pagination dots remain available.

Images no longer use hover zoom.

Native browser image dragging is disabled.

Drag Interaction

The carousel now supports:

Mouse dragging.

Touch swiping.

Grab cursor.

Grabbing cursor while dragging.

Velocity-aware swipe behaviour.

Smooth snap to the nearest card.

Small drag returns to the current card.

Larger or faster drag moves to the next or previous card.

Infinite-loop reset without a visible jump.

Arrow and pagination interactions are protected while animation or dragging is active.

Vertical page scrolling remains available through touch-pan-y.

5. Inventory Section

Completed

Dynamic inventory data added for:

400 series

500 series

600 series

800 series

900 series

Complete inventory cards are clickable.

Pointer cursor is shown on interactive cards.

Inventory popup uses the selected card image.

Optional variation-specific images are supported.

Variation navigation arrows are positioned on the overall modal.

Background page scrolling is locked while the modal is open.

Only the right details panel scrolls.

Details scrollbar is hidden visually.

Popup image uses object-contain to prevent unwanted cropping.

Variation cards use filled styling without border strokes.

Filtered single-card view includes the campaign CTA beneath it.

Full inventory view uses:

Four cards in the first row.

Fifth card and CTA in the second row.

6. 3D CTA Section

Completed

Procedural React Three Fiber UNIPOLE model implemented.

Main foreground UNIPOLE rotates automatically.

Main model can be manually dragged.

Background UNIPOLE structures remain static.

Camera remains fixed.

Dark night environment retained.

Stars and comet-like visual effects included.

Ground and background treatment retained.

No extra HTML marketing copy was added over the 3D CTA.

7. Industries Served Section

The complete visible section was removed:

Industries Served

Trusted across every category that needs visibility.

To avoid breaking the existing import in ClientApp.tsx, the export remains as:

export function IndustriesSection() {
  return null;
}

This keeps the application import stable while rendering no section.

8. Important Design Rules Followed

Do not redesign the existing page structure unless specifically requested.

Implement animations inside the existing UI.

Keep the About section clean and lightweight.

Use white as the About section background.

Use #EEEDF0 for active grey fills and visible control backgrounds.

Avoid excessive shadows, heavy 3D text effects and unnecessary hover effects.

Preserve responsive behaviour.

Respect reduced-motion accessibility.

Prefer ready-to-use complete code instead of partial fragments.

9. Current Main File Mapping

Downloaded file

Project destination

HomeSections_Why_Drag_Fixed.tsx

src/components/home/HomeSections.tsx

InventorySection_modal_scroll_image_fix.tsx

src/components/home/InventorySection.tsx

10. Recommended Verification

After placing the latest files in the project, run:

npm run lint
npm run build

The final build was not independently rerun in this chat after the latest carousel drag update, so lint and production build verification are still required in the local project.

11. Current Expected Result

The website should now provide:

Animated Hero with smooth parallax.

Existing About layout with sticky scroll-controlled content.

Lightweight GSAP line animation.

Centred, shorter About image.

Grey active feature blocks without icons, hover or red line.

Proper mouse and touch dragging in the Why Choose carousel.

Visible carousel arrow backgrounds.

Removed Industries section.

Dynamic Inventory cards and improved modal behaviour.

Interactive procedural 3D CTA.