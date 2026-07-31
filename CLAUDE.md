ADINN UNIPOLE Website — Current Claude Context

Active project root

Always work only inside:

D:\Unippole_Single_page_web

Before editing, confirm the terminal location:

cd "D:\Unippole_Single_page_web"
Get-Location

The output must be:

D:\Unippole_Single_page_web

Do not make active website changes inside:

D:\unipole_new\adinn-unipole-premium-current-backup

That folder is only a backup/reference source. It may be read only when a specific reusable file is requested.

Do not rename, move, replace or restructure either project folder.

Current project priority

The current task is a small, protected Hero update.

Update only the existing Hero background to use the Silk animated effect.

Do not redesign or rebuild the website.

Do not change the overall structure, section order, page composition, content, navigation, typography, spacing, buttons, business flow or responsive behaviour.

Make the smallest complete change required.

Important scope clarification

The separate 3D UNIPOLE assembly/model experience has not been implemented or approved in this active project yet.

Therefore, do not create, copy, restore or integrate any of the following as part of the current work:

AssemblyScene.tsx
HeroScene.tsx
UnipoleModel.tsx
Scroll-driven Assembly
3D UNIPOLE model
Drag-to-rotate model
Scroll-to-assemble stages
Foundation / Pole / Frame / Lighting 3D sequence
Drei model helpers
GLTF model loading

Do not add a 3D billboard model to the main Hero.

Do not add a separate 3D section.

Do not change the homepage order to make space for a 3D section.

3D assembly work is a future task and is outside the current scope.

The Silk effect is allowed because it is only an animated shader background. It must not be turned into a 3D UNIPOLE scene.

Current Hero update

Required result

Preserve the existing Hero exactly as it currently appears, except for replacing the broken image-based background layers with Silk.

Keep unchanged:

Hero height

Hero layout

Hero text

Heading line breaks

Supporting copy

Buttons

Button actions

Text alignment

Foreground layout

Existing reveal animation

Existing scroll behaviour

Existing responsive behaviour

Header interaction

Navigation anchors

Mobile layout

Accessibility attributes

Do not redesign the Hero into a split layout.

Do not add cards, statistics, badges, location counts, format counts or extra content.

Do not add React Bits sample branding or sample copy.

Broken Hero assets

The active project currently requests missing Hero assets such as:

/images/hero/evening-sky.jpg
/images/hero/distant-unipoles.png
/images/hero/main-unipole.png
/images/hero/road-foreground.png
/images/hero/cloud-01.png
/images/hero/cloud-02.png
/images/hero/cloud-03.png
/images/hero/light-trails.png

These references return 404 errors in the active project.

Remove only these missing Hero background-layer references from the active Hero implementation.

Do not delete unrelated images.

Do not change image paths used by other sections.

Do not create empty placeholder files with these names.

Silk component source

A working Silk component is available in the backup project at:

D:\unipole_new\adinn-unipole-premium-current-backup\src\components\ui\Silk.tsx

It may be copied into the active project only when required.

Preferred target location, if compatible with the active project structure:

D:\Unippole_Single_page_web\src\components\ui\Silk.tsx

Before copying:

Inspect the active project structure.

Confirm whether src/components/ui exists.

Confirm the current import alias configuration.

Confirm whether a Silk component already exists.

Do not create duplicate Silk implementations.

Copy only Silk.tsx from the backup project.

Do not copy the backup project’s Hero, Header, CSS, page composition, sections, layouts, contexts or data files.

Silk settings

Use these exact settings unless the user explicitly requests a later visual adjustment:

<Silk
  speed={5}
  scale={1}
  color="#b83f52"
  noiseIntensity={1.5}
  rotation={0}
/>

Do not replace these settings with a public React Bits example.

Do not add sample logos, badges, navigation, headings or buttons from React Bits.

Hero layering

Use this layer order:

Silk animated background

Existing readability overlay or gradient

Existing foreground decorative content that is already working

Existing Hero text and actions

Existing Header

Required CSS behaviour:

Hero wrapper:
position: relative
isolation: isolate
overflow: hidden

Silk wrapper:
position: absolute
inset: 0
z-index: 0
pointer-events: none
width: 100%
height: 100%

Existing overlay:
z-index: 1
must remain translucent

Existing Hero foreground content:
position: relative
z-index: 2

The Silk wrapper and Canvas must fill the complete Hero.

Do not place an opaque white background or fully opaque gradient above Silk.

Do not allow the Canvas to capture clicks or touch events.

Do not change the Header while fixing Hero layering unless a Hero-only stacking issue makes one tiny z-index adjustment strictly necessary.

Dependency rules

Inspect package.json before installing anything.

The project may already contain Three.js or React Three Fiber.

Use existing packages when available.

Do not install or add dependencies for the future 3D assembly experience.

Do not install:

Drei solely for this task

GLTF loaders solely for this task

Additional 3D model libraries

Shadcn packages

React Bits packages through CLI

Do not run:

npx shadcn add ...
pnpm dlx shadcn ...

The local Silk component should be used directly.

Current website protection

Before editing, inspect the actual current files in:

D:\Unippole_Single_page_web

Do not assume the file structure from the backup project matches the active project.

Possible Hero locations may include:

src/components/home/HeroSection.tsx
src/components/home/HeroSection.module.css
src/components/sections/HeroSection.tsx
src/components/ClientApp.tsx
src/app/page.tsx
src/app/globals.css

Find the active Hero by tracing imports from the rendered page.

Modify only:

The active Hero component

Its directly related Hero stylesheet

One local Silk component file, if needed

Do not create a second Hero.

Do not import a Hero from the backup project.

Do not replace the active page composition.

Sections that must remain unchanged

Preserve every current section exactly in its current order.

Do not reorder, remove, duplicate or redesign any section while implementing Silk.

Do not modify:

Header

About / What is a UNIPOLE

Why Choose

Inventory

Day and Night

Installation journey

Industries

Business growth

FAQ

Enquiry

Footer

Product details modal

Campaign plan

Toast notifications

Site data

Filters

Forms

The actual active website is the source of truth for section order.

Do not apply an order from an older prompt, backup project or outdated document.

About / What is a UNIPOLE protection

The “What is a UNIPOLE” section is not part of the current Hero Silk task.

Do not change its content, image, layout, icons, spacing or animation while implementing Silk.

A later task may update that section separately.

Header protection

Preserve the current Header design and behaviour.

Do not add or remove:

Backgrounds

Borders

Rings

Shadows

Navigation links

Mobile menu behaviour

Scroll state behaviour

Only adjust a Header z-index when strictly required to keep the unchanged Header above the Hero, and report that change clearly.

Asset rules

Before referencing any asset, confirm the physical file exists.

Use PowerShell when needed:

Get-ChildItem "D:\Unippole_Single_page_web\public" -Recurse -File

Never invent an asset path.

Never create empty image placeholders.

Do not use a missing file merely because it appeared in an older prompt.

The Hero Silk background should remove the need for the broken Hero image-layer files listed above.

Responsive requirements

Preserve the current responsive layout.

Check approximately:

360px
390px
640px
768px
1024px
1280px
1440px

Confirm:

No horizontal overflow

Hero content remains readable

Buttons remain reachable

Header does not overlap important content

Silk fills the Hero

Silk does not affect page height

Silk does not block clicks

Text remains readable over the animated background

Mobile layout remains unchanged

Other sections remain visually unchanged

Accessibility and motion

Preserve existing accessibility attributes and heading semantics.

Preserve reduced-motion support when already present.

When reduced motion is enabled:

Do not introduce intense motion

Keep the Hero readable

Avoid unnecessary movement

Do not break the existing reveal logic

Do not remove focus-visible styles or keyboard behaviour.

Strict editing rules

Read this file completely before making changes.

Work only in D:\Unippole_Single_page_web.

Inspect the current active Hero before editing.

Make the smallest complete change.

Do not redesign unrelated UI.

Do not copy the backup website structure.

Do not reorder sections.

Do not add the unimplemented 3D assembly experience.

Do not add a 3D UNIPOLE model to the Hero.

Do not change content unless explicitly requested.

Do not change business logic.

Do not change section IDs or navigation anchors.

Do not change inventory data.

Do not change campaign-plan behaviour.

Do not run Git commands.

Do not rename project folders.

Do not claim a file was changed unless it was actually changed.

Do not claim validation passed unless the command was actually run.

Do not fix unrelated pre-existing warnings or errors without reporting them first.

Validation commands

Run from the active project:

cd "D:\Unippole_Single_page_web"

Then run:

npm run lint
npm run build

Fix only errors caused by the Hero Silk implementation.

For local preview:

npm run dev

Open the exact local URL printed by Next.js.

Confirm the browser no longer requests the missing Hero image-layer files.

The following console warning is not the cause of the broken Hero and does not need unrelated refactoring during this task:

THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.

Report it as a pre-existing warning if it remains.

Final validation checklist

Before reporting completion, confirm:

Correct project folder was used

Only the active Hero background was changed

Silk component was copied or created only once

Exact Silk settings were used

Broken Hero asset references were removed

No missing Hero image requests remain

Existing Hero content is unchanged

Existing Hero layout is unchanged

Existing Hero buttons still work

Header remains unchanged

All other sections remain unchanged

Section order remains unchanged

No 3D assembly section was added

No 3D UNIPOLE model was added to the Hero

No files were copied from the backup except Silk.tsx, when needed

No horizontal overflow exists

Mobile Hero remains usable

TypeScript passes

Build passes

Lint result is reported honestly

Expected completion report

Report only:

Files inspected

Files copied

Files modified

Active Hero component identified

Missing Hero image references removed

Silk settings used

What was intentionally not changed

Confirmation that no 3D assembly/model work was added

Lint result

Build result

Remaining pre-existing warnings or limitations

Do not provide a vague completion message.

Do not claim success without actual command results.