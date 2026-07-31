CTA 3D Scene - Latest Working Specification

Files

src/components/home/ProceduralUnipole.tsx

src/components/home/CTAUnipoleScene.tsx

src/components/home/ProposalBanner3D.tsx

Current Behaviour

One detailed foreground UNIPOLE dominates the CTA.

The foreground model auto-rotates around Y.

Dragging the foreground model rotates it manually.

Vertical drag is limited to a small tilt.

Auto-rotation resumes after release.

The camera remains fixed.

Four background UNIPOLEs remain static.

Visible lamp lenses on the main model slowly brighten and dim.

Billboard artwork exposure is controlled.

Stars, subtle comets, horizon lights and a dark-blue ground provide depth.

There is no CTA copy, CTA button, OrbitControls or blue diagonal overlay.

Framing Controls

Desktop camera in CTAUnipoleScene.tsx:

camera.position.set(0, 2.6, 12.8);
camera.lookAt(0, 2.72, 0);

Canvas default camera:

camera={{
  position: [0, 2.6, 12.8],
  fov: 40,
  near: 0.1,
  far: 80,
}}

Main model:

<MainAutoRotatingUnipole
  position={[0, -5.75, 0.65]}
  scale={1.12}
/>

Manual adjustment

Increase camera Z above 12.8 to zoom out.

Reduce camera Z below 12.8 to zoom in.

Reduce scale={1.12} to make only the main model smaller.

Increase scale={1.12} to make only the main model larger.

Adjust position Y to move the whole main model up or down.

Lamp Animation

The actual lamp materials and point lights animate inside BlinkingLamp in ProceduralUnipole.tsx. This makes the visible light housings pulse, rather than only changing an unrelated scene light.

Validation

npm run lint
npm run build

Only CTA-related errors should be fixed.