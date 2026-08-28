"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

const INSTALLATION_STEPS = [
  {
    title: "Site Survey & Soil Analysis",
    description:
      "Completing utility clearance, total-station survey, borehole sampling and soil-strength verification before structural work begins.",
  },
  {
    title: "Structural Engineering",
    description:
      "Engineering the foundation, tapered pole, rear frame and wind-load requirements for long-term safety.",
  },
  {
    title: "Foundation Preparation",
    description:
      "Preparing a reinforced concrete foundation with accurately aligned anchor bolts and base plates.",
  },
  {
    title: "Pole Installation",
    description:
      "Lifting and securing the primary galvanized steel pole with precise vertical alignment and bracing.",
  },
  {
    title: "Display Frame Assembly",
    description:
      "Bringing the structural frame from behind the pole and locking it into the mounting assembly.",
  },
  {
    title: "Electrical & Lighting",
    description:
      "Installing protected cabling, rear maintenance access and precisely aimed top floodlights for reliable night visibility.",
  },
  {
    title: "Signage Installation",
    description:
      "Bringing the finished display panel from the front and seating it cleanly onto the completed rear frame.",
  },
  {
    title: "Quality Certification & Handover",
    description:
      "Verifying structural alignment, electrical performance and finishing before issuing the final handover certificate.",
  },
] as const;

const clamp01 = (value: number) =>
  Math.min(1, Math.max(0, value));

const smoothStep = (
  start: number,
  end: number,
  value: number,
) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

const damp = (
  current: number,
  target: number,
  smoothing: number,
  delta: number,
) =>
  THREE.MathUtils.lerp(
    current,
    target,
    1 - Math.exp(-smoothing * delta),
  );

type Vec3 = [number, number, number];

/* CAMERA ADJUSTMENT SETTINGS
   POSITION: X = left/right, Y = eye height, Z = camera distance.
   TARGET: the point that always stays in focus while rotating. It is placed
   at the centre of the UNIPOLE, so dragging cannot move the structure away.
   FOV: decrease for more zoom; increase for less zoom.
   Keep POSITION.x and TARGET.x at 0 for straight one-point perspective. */
const INITIAL_CAMERA_POSITION: Vec3 = [0, 1.75, 29.5];
const INITIAL_CAMERA_TARGET: Vec3 = [0, 5.15, -3];
const INITIAL_CAMERA_FOV = 38;

/* INTERACTION ADJUSTMENT SETTINGS
   Rotation is available from Stage 1. Angles are measured in radians.
   0.35 rad is approximately 20 degrees left/right.

   PAN RATIO controls how much more horizontal travel is allowed than
   vertical travel. Increase the ratio for less vertical movement.

   The maximum polar angle deliberately stays below the road-flip point.
   Reduce MIN_POLAR to allow more elevated/upward orbit; never increase
   MAX_POLAR beyond 1.72 or the camera can pass underneath the road. */
const CAMERA_MIN_POLAR_ANGLE = 1.42;
const CAMERA_MAX_POLAR_ANGLE = 1.7;
const CAMERA_MIN_AZIMUTH_ANGLE = -0.42;
const CAMERA_MAX_AZIMUTH_ANGLE = 0.42;
const CAMERA_HORIZONTAL_PAN_LIMIT = 2.5;
const CAMERA_PAN_X_TO_Y_RATIO = 5.75;
const CAMERA_VERTICAL_PAN_LIMIT =
  CAMERA_HORIZONTAL_PAN_LIMIT / CAMERA_PAN_X_TO_Y_RATIO;
const CAMERA_DEPTH_PAN_LIMIT = 0.55;
const CAMERA_ROTATE_SPEED = 0.4;
const CAMERA_PAN_SPEED = 0.62;
const CAMERA_MIN_WORLD_HEIGHT = 0.72;

/* NIGHT LIGHT ADJUSTMENT RATIOS
   Change only these two values when tuning night brightness:
   0.75 = dim, 1.0 = natural base, 1.5 = strong, 2.0 = very bright.
   Each ratio independently controls the visible glow and real illumination. */
const UNIPOLE_NIGHT_LIGHT_RATIO = 1.35;
const STREET_NIGHT_LIGHT_RATIO = 1.25;
const UNIPOLE_LIGHT_BASE_INTENSITY = 38;
const STREET_LIGHT_BASE_INTENSITY = 18;

type ModelProps = {
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
  dayMode: boolean;
};

function useUnipoleArtworkTexture() {
  const [texture, setTexture] =
    useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    /* Matches the taller real-world 48 x 20 ft display ratio while using
       fewer pixels than the old wide texture. */
    const logicalWidth = 1350;
    const logicalHeight = 600;

    const canvas = document.createElement("canvas");
    canvas.width = logicalWidth;
    canvas.height = logicalHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    const redGradient = context.createLinearGradient(0, 0, 0, logicalHeight);
    redGradient.addColorStop(0, "#dc292e");
    redGradient.addColorStop(1, "#a3131c");
    context.fillStyle = redGradient;
    context.fillRect(0, 0, logicalWidth, logicalHeight);

    /* Charcoal sweep on the right side of the reference artwork. */
    const charcoalGradient = context.createLinearGradient(
      logicalWidth * 0.56,
      0,
      logicalWidth,
      logicalHeight,
    );
    charcoalGradient.addColorStop(0, "#343438");
    charcoalGradient.addColorStop(1, "#101115");
    context.fillStyle = charcoalGradient;
    context.beginPath();
    context.moveTo(logicalWidth * 0.72, 0);
    context.lineTo(logicalWidth, 0);
    context.lineTo(logicalWidth, logicalHeight);
    context.lineTo(logicalWidth * 0.58, logicalHeight);
    context.bezierCurveTo(
      logicalWidth * 0.7,
      logicalHeight * 0.68,
      logicalWidth * 0.76,
      logicalHeight * 0.34,
      logicalWidth * 0.72,
      0,
    );
    context.closePath();
    context.fill();

    /* Large white curve entering from the lower-left. */
    context.fillStyle = "#f2f1ed";
    context.beginPath();
    context.moveTo(0, logicalHeight * 0.55);
    context.bezierCurveTo(
      logicalWidth * 0.2,
      logicalHeight * 0.6,
      logicalWidth * 0.25,
      logicalHeight * 0.92,
      logicalWidth * 0.4,
      logicalHeight,
    );
    context.lineTo(0, logicalHeight);
    context.closePath();
    context.fill();

    /* Deep-red lower wave gives the board the same layered depth. */
    context.fillStyle = "#ba1821";
    context.beginPath();
    context.moveTo(0, logicalHeight * 0.72);
    context.bezierCurveTo(
      logicalWidth * 0.18,
      logicalHeight * 0.71,
      logicalWidth * 0.27,
      logicalHeight * 0.93,
      logicalWidth * 0.43,
      logicalHeight,
    );
    context.lineTo(logicalWidth * 0.33, logicalHeight);
    context.bezierCurveTo(
      logicalWidth * 0.2,
      logicalHeight * 0.9,
      logicalWidth * 0.12,
      logicalHeight * 0.74,
      0,
      logicalHeight * 0.78,
    );
    context.closePath();
    context.fill();

    /* Two precise diagonal ribbons reproduce the premium centre sweep. */
    context.fillStyle = "#f5f4f0";
    context.beginPath();
    context.moveTo(logicalWidth * 0.55, logicalHeight);
    context.lineTo(logicalWidth * 0.72, 0);
    context.lineTo(logicalWidth * 0.76, 0);
    context.lineTo(logicalWidth * 0.6, logicalHeight);
    context.closePath();
    context.fill();

    context.fillStyle = "#e7e5e0";
    context.beginPath();
    context.moveTo(logicalWidth * 0.47, logicalHeight);
    context.lineTo(logicalWidth * 0.66, 0);
    context.lineTo(logicalWidth * 0.68, 0);
    context.lineTo(logicalWidth * 0.5, logicalHeight);
    context.closePath();
    context.fill();

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;
    nextTexture.needsUpdate = true;
    setTexture(nextTexture);

    return () => {
      nextTexture.dispose();
    };
  }, []);

  return texture;
}

/* Creates deliberate, correctly-spelled signage in the browser. No AI image
   or generated lettering is used anywhere in the streetscape. */
function useExactLabelTexture(
  label: string,
  background = "#172027",
  foreground = "#f5f2e9",
) {
  const [texture, setTexture] =
    useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(255,255,255,0.22)";
    context.lineWidth = 5;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    context.fillStyle = foreground;
    context.font = "700 54px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 3);

    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 2;
    nextTexture.needsUpdate = true;
    setTexture(nextTexture);

    return () => nextTexture.dispose();
  }, [background, foreground, label]);

  return texture;
}

const UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const UNIT_CYLINDER_GEOMETRY = new THREE.CylinderGeometry(
  1,
  1,
  1,
  18,
  1,
);

const GUSSET_SHAPE = new THREE.Shape();
GUSSET_SHAPE.moveTo(0, 0);
GUSSET_SHAPE.lineTo(0.62, 0);
GUSSET_SHAPE.lineTo(0, 0.78);
GUSSET_SHAPE.closePath();

const GUSSET_GEOMETRY = new THREE.ExtrudeGeometry(GUSSET_SHAPE, {
  depth: 0.11,
  bevelEnabled: false,
});
GUSSET_GEOMETRY.translate(0, 0, -0.055);

const steelMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
const standardMaterialCache = new Map<
  string,
  THREE.MeshStandardMaterial
>();

function getSteelMaterial(color: string, roughness: number) {
  const key = `${color}-${roughness}`;
  const cached = steelMaterialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.9,
    roughness,
    envMapIntensity: 0.9,
  });
  steelMaterialCache.set(key, material);
  return material;
}

function getStandardMaterial(
  color: string,
  roughness: number,
  metalness = 0,
) {
  const key = `${color}-${roughness}-${metalness}`;
  const cached = standardMaterialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
  standardMaterialCache.set(key, material);
  return material;
}

function SteelMaterial({
  color = "#878d92",
  roughness = 0.36,
}: {
  color?: string;
  roughness?: number;
}) {
  const material = getSteelMaterial(color, roughness);
  return <primitive attach="material" object={material} />;
}

type BoxInstance = {
  position: Vec3;
  size: Vec3;
  rotation?: Vec3;
};

function InstancedBoxes({
  items,
  material,
  castShadow = false,
  receiveShadow = false,
}: {
  items: BoxInstance[];
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    items.forEach((item, index) => {
      const [rotationX, rotationY, rotationZ] =
        item.rotation ?? ([0, 0, 0] as Vec3);
      helper.position.set(...item.position);
      helper.scale.set(...item.size);
      helper.rotation.set(rotationX, rotationY, rotationZ);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[UNIT_BOX_GEOMETRY, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

function InstancedGeometry({
  items,
  geometry,
  material,
  castShadow = false,
  receiveShadow = false,
}: {
  items: BoxInstance[];
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    items.forEach((item, index) => {
      helper.position.set(...item.position);
      helper.scale.set(...item.size);
      helper.rotation.set(...(item.rotation ?? ([0, 0, 0] as Vec3)));
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

const LIGHT_HALO_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const INSTANCED_LIGHT_HALO_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const LIGHT_HALO_FRAGMENT_SHADER = `
  uniform vec3 glowColor;
  uniform float glowOpacity;
  varying vec2 vUv;
  void main() {
    float distanceFromCentre = distance(vUv, vec2(0.5));
    float halo = 1.0 - smoothstep(0.03, 0.5, distanceFromCentre);
    halo = pow(halo, 2.15);
    gl_FragColor = vec4(glowColor, halo * glowOpacity);
  }
`;

function createLightHaloMaterial(
  color: string,
  opacity: number,
  instanced = false,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(color) },
      glowOpacity: { value: opacity },
    },
    vertexShader: instanced
      ? INSTANCED_LIGHT_HALO_VERTEX_SHADER
      : LIGHT_HALO_VERTEX_SHADER,
    fragmentShader: LIGHT_HALO_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

const LIGHT_HALO_GEOMETRY = new THREE.PlaneGeometry(1, 1);
const UNIPOLE_LIGHT_HALO_MATERIAL = createLightHaloMaterial(
  "#ffe7ac",
  Math.min(0.72, 0.38 * UNIPOLE_NIGHT_LIGHT_RATIO),
);
const STREET_LIGHT_HALO_MATERIAL = createLightHaloMaterial(
  "#fff0c8",
  Math.min(0.68, 0.32 * STREET_NIGHT_LIGHT_RATIO),
  true,
);

function BoxMember({
  position,
  size,
  rotation = [0, 0, 0],
  color = "#73797e",
}: {
  position: Vec3;
  size: Vec3;
  rotation?: Vec3;
  color?: string;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={size}
      geometry={UNIT_BOX_GEOMETRY}
      castShadow
      receiveShadow
    >
      <SteelMaterial color={color} />
    </mesh>
  );
}

function BeamBetween({
  start,
  end,
  radius = 0.06,
  color = "#696f74",
}: {
  start: Vec3;
  end: Vec3;
  radius?: number;
  color?: string;
}) {
  const transform = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );

    return { length, midpoint, quaternion };
  }, [end, start]);

  return (
    <mesh
      position={transform.midpoint}
      quaternion={transform.quaternion}
      scale={[radius, transform.length, radius]}
      geometry={UNIT_CYLINDER_GEOMETRY}
      castShadow
    >
      <SteelMaterial color={color} roughness={0.34} />
    </mesh>
  );
}

function AnchorBolt({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.68, 18]} />
        <meshStandardMaterial
          color="#33383d"
          metalness={0.9}
          roughness={0.36}
        />
      </mesh>

      {/* Washer */}
      <mesh position={[0, 0.205, 0]} castShadow>
        <cylinderGeometry args={[0.115, 0.115, 0.025, 16]} />
        <meshStandardMaterial
          color="#2c3034"
          metalness={0.88}
          roughness={0.4}
        />
      </mesh>

      {/* Nut */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 6]} />
        <meshStandardMaterial
          color="#24282c"
          metalness={0.88}
          roughness={0.38}
        />
      </mesh>
    </group>
  );
}

function ElectricalDetails() {
  return (
    <group name="ElectricalDetails">
      {/* Conduit run along the pole face, ending at the mounting head */}
      <BeamBetween
        start={[0.62, 0.9, 0.2]}
        end={[0.55, 7.8, 0.1]}
        radius={0.032}
        color="#262a2d"
      />

      {/* Base junction box */}
      <mesh position={[0.66, 0.95, 0.3]} castShadow>
        <boxGeometry args={[0.24, 0.32, 0.13]} />
        <meshStandardMaterial
          color="#23282b"
          metalness={0.68}
          roughness={0.46}
        />
      </mesh>
      <mesh position={[0.66, 0.95, 0.37]}>
        <boxGeometry args={[0.18, 0.24, 0.02]} />
        <meshStandardMaterial
          color="#3a4044"
          metalness={0.55}
          roughness={0.5}
        />
      </mesh>

      {/* Upper junction box near the mounting head */}
      <mesh position={[0.55, 7.85, 0.16]} castShadow>
        <boxGeometry args={[0.2, 0.26, 0.11]} />
        <meshStandardMaterial
          color="#23282b"
          metalness={0.68}
          roughness={0.46}
        />
      </mesh>
    </group>
  );
}

/*
 * Vertical layout notes (local to PoleAndBase / poleRef, which itself sits
 * at outer-model position.y = 0.66):
 *
 * The pole intentionally ends well below the rear frame's resting bottom
 * edge (outer y ~= 9.33). A dedicated mounting head, support beam and
 * cantilever brackets bridge that gap so the pole never visually enters
 * the billboard face — only the mounting assembly does.
 */
const POLE_BASE_Y = 0.45;
const POLE_HEIGHT = 7.5;
const POLE_TOP_Y = POLE_BASE_Y + POLE_HEIGHT;

/* Where the rear frame's bottom-centre sits once seated, expressed in
   PoleAndBase-local space (outer target minus the poleRef y-offset). */
const FRAME_CONNECT_Y = 8.7;
const FRAME_CONNECT_Z = -0.68;
const BOARD_WIDTH = 9.5;
const BOARD_HEIGHT = 4.35;
const BOARD_HALF_WIDTH = BOARD_WIDTH / 2;
const BOARD_HALF_HEIGHT = BOARD_HEIGHT / 2;

function RearMountingHead() {
  return (
    <group name="RearMount">
      {/* Cap plate at the pole top */}
      <mesh position={[0, POLE_TOP_Y + 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.46, 0.16, 28]} />
        <SteelMaterial color="#5a6165" roughness={0.4} />
      </mesh>

      {/* Deep transition collar distributes the frame load into the mast. */}
      <mesh position={[0, POLE_TOP_Y + 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.64, 0.52, 0.34, 28]} />
        <SteelMaterial color="#666d72" roughness={0.36} />
      </mesh>

      {/* Heavy twin-axis mounting head used by real cantilever unipoles. */}
      <BoxMember
        position={[0, POLE_TOP_Y + 0.43, -0.03]}
        size={[2.35, 0.22, 0.5]}
        color="#565d61"
      />
      <BoxMember
        position={[0, POLE_TOP_Y + 0.38, -0.38]}
        size={[0.5, 0.28, 1.08]}
        color="#596065"
      />

      {/* Main support beam rising from the mounting head to the rear frame */}
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.24, 0.02]}
        end={[0, FRAME_CONNECT_Y, FRAME_CONNECT_Z]}
        radius={0.2}
        color="#5a6165"
      />

      {/* Cantilever brackets bracing the beam to the frame's lower corners */}
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.2, -0.05]}
        end={[-1.85, FRAME_CONNECT_Y - 0.35, FRAME_CONNECT_Z - 0.05]}
        radius={0.095}
      />
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.2, -0.05]}
        end={[1.85, FRAME_CONNECT_Y - 0.35, FRAME_CONNECT_Z - 0.05]}
        radius={0.095}
      />

      {[-1, 1].map((side) => (
        <BeamBetween
          key={side}
          start={[side * 0.48, POLE_TOP_Y + 0.48, -0.05]}
          end={[side * 1.28, FRAME_CONNECT_Y - 0.08, FRAME_CONNECT_Z]}
          radius={0.075}
          color="#656c70"
        />
      ))}
    </group>
  );
}

function PoleAndBase() {
  return (
    <group>
      <mesh
        name="Pole"
        position={[0, POLE_BASE_Y + POLE_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.44, 0.72, POLE_HEIGHT, 32]} />
        <meshStandardMaterial
          color="#c5c9cc"
          metalness={0.9}
          roughness={0.38}
          envMapIntensity={1.05}
        />
      </mesh>

      <mesh name="BasePlate" position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[0.82, 0.82, 0.22, 24]} />
        <meshStandardMaterial
          color="#8f9599"
          metalness={0.88}
          roughness={0.4}
        />
      </mesh>

      <group name="GussetPlates">
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(
          (rotation, index) => (
            <mesh
              key={index}
              position={[
                Math.cos(rotation) * 0.42,
                0.57,
                -Math.sin(rotation) * 0.42,
              ]}
              rotation={[0, rotation, 0]}
              geometry={GUSSET_GEOMETRY}
              castShadow
            >
              <SteelMaterial color="#747a7e" />
            </mesh>
          ),
        )}
      </group>

      <RearMountingHead />
      <ElectricalDetails />
    </group>
  );
}

function RearStructuralFrame() {
  const verticalPosts = [-4.35, -2.9, -1.45, 0, 1.45, 2.9, 4.35];

  return (
    <group>
      <BoxMember
        position={[0, BOARD_HALF_HEIGHT, -0.52]}
        size={[BOARD_WIDTH, 0.18, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[0, -BOARD_HALF_HEIGHT, -0.52]}
        size={[BOARD_WIDTH, 0.18, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[-BOARD_HALF_WIDTH + 0.09, 0, -0.52]}
        size={[0.18, BOARD_HEIGHT, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[BOARD_HALF_WIDTH - 0.09, 0, -0.52]}
        size={[0.18, BOARD_HEIGHT, 0.24]}
        color="#6b7074"
      />

      {verticalPosts.map((x) => (
        <BoxMember
          key={x}
          position={[x, 0, -0.95]}
          size={[0.08, BOARD_HEIGHT - 0.34, 0.08]}
          color="#656b6f"
        />
      ))}

      <group name="CrossBracing">
        {verticalPosts.map((x, index) => (
          <BeamBetween
            key={x}
            start={[x - 0.52, -1.88, -0.92]}
            end={[x + 0.52, 1.88, -0.92]}
            radius={0.045}
            color={index % 2 === 0 ? "#5e6468" : "#70767a"}
          />
        ))}

        <BeamBetween
          start={[-2.6, -2.52, -0.7]}
          end={[-0.9, -3.75, -0.15]}
          radius={0.1}
        />
        <BeamBetween
          start={[2.6, -2.52, -0.7]}
          end={[0.9, -3.75, -0.15]}
          radius={0.1}
        />
        <BeamBetween
          start={[-2.2, -2.1, -0.6]}
          end={[-0.7, -0.25, -0.15]}
          radius={0.075}
        />
        <BeamBetween
          start={[2.2, -2.1, -0.6]}
          end={[0.7, -0.25, -0.15]}
          radius={0.075}
        />
      </group>

      <BoxMember
        position={[0, -2.55, -0.7]}
        size={[5.8, 0.28, 0.36]}
        color="#666c70"
      />

      <BoxMember
        position={[0, -3.75, -0.15]}
        size={[2.35, 0.3, 0.44]}
        color="#62686c"
      />
    </group>
  );
}

function MaintenanceDeck() {
  const panelInstances = useMemo(
    () =>
      [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75].map((x) => ({
        position: [x, 0.11, 0] as Vec3,
        size: [1.02, 0.07, 1.34] as Vec3,
      })),
    [],
  );

  const slatInstances = useMemo(
    () =>
      [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75].flatMap((x) =>
        [-0.44, -0.22, 0, 0.22, 0.44].map((z) => ({
          position: [x, 0.16, z] as Vec3,
          size: [0.9, 0.025, 0.03] as Vec3,
        })),
      ),
    [],
  );

  const guardPosts = useMemo(
    () =>
      [-4.35, -2.9, -1.45, -0.42, 0.42, 1.45, 2.9, 4.35].map((x) => ({
        position: [x, 0.62, -0.72] as Vec3,
        size: [0.045, 1.05, 0.045] as Vec3,
      })),
    [],
  );

  const ladderRungs = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        position: [0, -0.22 - index * 0.4, -1.06] as Vec3,
        size: [0.48, 0.035, 0.035] as Vec3,
      })),
    [],
  );

  const ladderStandoffs = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => ({
        position: [0, -0.45 - index * 1.02, -0.82] as Vec3,
        size: [0.58, 0.045, 0.48] as Vec3,
      })),
    [],
  );

  return (
    <group position={[0, -2.56, 0.72]}>
      <BoxMember
        position={[0, 0, 0]}
        size={[9.15, 0.15, 1.6]}
        color="#7f8589"
      />

      <InstancedBoxes
        items={panelInstances}
        material={getSteelMaterial("#93989c", 0.36)}
        castShadow
        receiveShadow
      />
      <InstancedBoxes
        items={slatInstances}
        material={getSteelMaterial("#63686c", 0.36)}
        castShadow
        receiveShadow
      />

      {/* Rear-only guardrail keeps the advertising face completely clear. */}
      <InstancedBoxes
        items={guardPosts}
        material={getSteelMaterial("#72797e", 0.38)}
      />
      {/* The rear rail has a central access opening for the ladder. */}
      {[-2.42, 2.42].map((x) => (
        <group key={x}>
          <BoxMember
            position={[x, 0.54, -0.72]}
            size={[4.05, 0.045, 0.045]}
            color="#72797e"
          />
          <BoxMember
            position={[x, 1.03, -0.72]}
            size={[4.05, 0.05, 0.05]}
            color="#72797e"
          />
        </group>
      ))}

      {/* Full-height rear access ladder: centred behind the mast, held away
          by steel standoffs, and connected directly to the catwalk opening. */}
      <BoxMember
        position={[-0.24, -3.62, -1.06]}
        size={[0.045, 7.32, 0.045]}
        color="#697075"
      />
      <BoxMember
        position={[0.24, -3.62, -1.06]}
        size={[0.045, 7.32, 0.045]}
        color="#697075"
      />
      <InstancedBoxes
        items={ladderRungs}
        material={getSteelMaterial("#697075", 0.4)}
      />
      <InstancedBoxes
        items={ladderStandoffs}
        material={getSteelMaterial("#5f666b", 0.42)}
      />
      <BoxMember
        position={[0, -3.62, -1.1]}
        size={[0.035, 7.12, 0.035]}
        color="#9ba2a6"
      />
      {[-0.24, 0.24].map((x) => (
        <BoxMember
          key={x}
          position={[x, 0.68, -1.06]}
          size={[0.045, 1.7, 0.045]}
          color="#697075"
        />
      ))}
    </group>
  );
}

function FloodLight({
  position,
  dayMode,
  rotation = [0, 0, 0],
}: {
  position: Vec3;
  dayMode: boolean;
  rotation?: Vec3;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Galvanized mounting yoke */}
      <mesh position={[0, -0.2, -0.02]} castShadow>
        <boxGeometry args={[0.5, 0.055, 0.08]} />
        <meshStandardMaterial
          color="#7d858a"
          metalness={0.88}
          roughness={0.28}
        />
      </mesh>

      <mesh position={[-0.22, -0.08, -0.02]} castShadow>
        <boxGeometry args={[0.055, 0.27, 0.08]} />
        <meshStandardMaterial
          color="#71797e"
          metalness={0.9}
          roughness={0.27}
        />
      </mesh>

      <mesh position={[0.22, -0.08, -0.02]} castShadow>
        <boxGeometry args={[0.055, 0.27, 0.08]} />
        <meshStandardMaterial
          color="#71797e"
          metalness={0.9}
          roughness={0.27}
        />
      </mesh>

      {/* Adjustable hinge knuckle between yoke and housing */}
      <mesh
        position={[0, -0.02, -0.06]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.045, 0.045, 0.14, 12]} />
        <meshStandardMaterial
          color="#5a6166"
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>

      {/* Powder-coated floodlight housing */}
      <RoundedBox
        args={[0.56, 0.32, 0.42]}
        radius={0.045}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial
          color="#20262a"
          metalness={0.76}
          roughness={0.22}
          envMapIntensity={1.2}
        />
      </RoundedBox>

      {/* Rectangular bezel matches a weatherproof commercial sign light. */}
      <RoundedBox
        position={[0, 0, 0.205]}
        args={[0.48, 0.26, 0.028]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#6b7278"
          metalness={0.7}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Recessed glass lens and reflector */}
      <RoundedBox
        position={[0, 0, 0.222]}
        args={[0.4, 0.2, 0.035]}
        radius={0.025}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color="#fff5d6"
          emissive="#ffe5a3"
          emissiveIntensity={
            dayMode ? 0.16 : 5.2 * UNIPOLE_NIGHT_LIGHT_RATIO
          }
          roughness={0.08}
          metalness={0.05}
          clearcoat={1}
          clearcoatRoughness={0.08}
          toneMapped={false}
        />
      </RoundedBox>

      <mesh position={[0, 0, 0.246]}>
        <planeGeometry args={[0.32, 0.13]} />
        <meshBasicMaterial
          color="#fffdf3"
          transparent
          opacity={
            dayMode
              ? 0.16
              : Math.min(1, 0.82 * UNIPOLE_NIGHT_LIGHT_RATIO)
          }
          toneMapped={false}
        />
      </mesh>

      {!dayMode && (
        <mesh
          position={[0, 0, 0.255]}
          scale={[
            0.9 * UNIPOLE_NIGHT_LIGHT_RATIO,
            0.54 * UNIPOLE_NIGHT_LIGHT_RATIO,
            1,
          ]}
          geometry={LIGHT_HALO_GEOMETRY}
          material={UNIPOLE_LIGHT_HALO_MATERIAL}
          renderOrder={6}
        />
      )}
    </group>
  );
}

/* Fixture x-positions across the top rail. All billboard illumination now
   lives up here, structurally attached to the frame — no ground-level or
   base-mounted fixtures remain. */
const BOARD_LIGHT_X = [-3.75, -1.88, 0, 1.88, 3.75] as const;

/* Five fixtures remain visible, while three slightly wider real lights
   produce the same even wash with substantially less per-pixel lighting. */
const BOARD_LIGHT_SOURCE_X = [-3.35, 0, 3.35] as const;

/* The lighting group is mounted at the billboard's vertical centre.
   Keep this value aligned with the RearFrame and SignageBoard Y position. */
const BOARD_LIGHT_GROUP_Y = 11.55;

/* LIGHT POSITION ADJUSTMENT
   Increase this number to move every floodlight higher.
   Decrease it to bring every floodlight closer to the billboard.
   Recommended range: 0 to 0.8. */
const BOARD_LIGHT_RISE = 0.12;

function LightingRig({ dayMode }: { dayMode: boolean }) {
  return (
    <group>
      <BoxMember
        position={[0, BOARD_HALF_HEIGHT + 0.08, -0.02]}
        size={[8.35, 0.13, 0.22]}
        color="#4b5157"
      />
      <group name="LightArms">
        {BOARD_LIGHT_X.map((x) => (
          <group key={x}>
            {/* Mounting bracket plate where the arm meets the top rail */}
            <BoxMember
              position={[x, BOARD_HALF_HEIGHT, -0.14]}
              size={[0.16, 0.16, 0.22]}
              color="#4b5157"
            />
            <BeamBetween
              start={[x, BOARD_HALF_HEIGHT + 0.04, -0.06]}
              end={[x, BOARD_HALF_HEIGHT + 0.66 + BOARD_LIGHT_RISE, 0.72]}
              radius={0.065}
              color="#454a4e"
            />
          </group>
        ))}
      </group>

      <group name="FloodLights">
        {BOARD_LIGHT_X.map((x) => (
          <FloodLight
            key={x}
            dayMode={dayMode}
            position={[
              x,
              BOARD_HALF_HEIGHT + 0.7 + BOARD_LIGHT_RISE,
              0.78,
            ]}
            rotation={[0.82, 0, 0]}
          />
        ))}
      </group>
    </group>
  );
}

function FrontDisplayPanel({ dayMode }: { dayMode: boolean }) {
  const texture = useUnipoleArtworkTexture();

  return (
    <group>
      <RoundedBox
        args={[BOARD_WIDTH - 0.34, BOARD_HEIGHT - 0.26, 0.16]}
        radius={0.035}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#f4f4f1"}
          emissive="#ffffff"
          emissiveIntensity={
            dayMode ? 0.015 : 0.16 * UNIPOLE_NIGHT_LIGHT_RATIO
          }
          roughness={0.46}
          metalness={0.02}
        />
      </RoundedBox>

      <BoxMember
        position={[0, BOARD_HALF_HEIGHT, -0.02]}
        size={[BOARD_WIDTH - 0.12, 0.12, 0.23]}
        color="#7a8084"
      />
      <BoxMember
        position={[0, -BOARD_HALF_HEIGHT, -0.02]}
        size={[BOARD_WIDTH - 0.12, 0.12, 0.23]}
        color="#7a8084"
      />
      <BoxMember
        position={[-BOARD_HALF_WIDTH + 0.05, 0, -0.02]}
        size={[0.12, BOARD_HEIGHT, 0.23]}
        color="#7a8084"
      />
      <BoxMember
        position={[BOARD_HALF_WIDTH - 0.05, 0, -0.02]}
        size={[0.12, BOARD_HEIGHT, 0.23]}
        color="#7a8084"
      />
    </group>
  );
}

function SoftBeamBetween({
  start,
  end,
  radius = 0.07,
  color,
}: {
  start: Vec3;
  end: Vec3;
  radius?: number;
  color: string;
}) {
  const transform = useMemo(() => {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const midpoint = a.clone().add(b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );

    return { length, midpoint, quaternion };
  }, [end, start]);

  return (
    <mesh
      position={transform.midpoint}
      quaternion={transform.quaternion}
      scale={[radius, transform.length, radius]}
      geometry={UNIT_CYLINDER_GEOMETRY}
      material={getStandardMaterial(color, 0.72, 0.02)}
      castShadow
    />
  );
}

function SurveyTripod({
  position = [-0.34, 0.02, 1.85],
  rotationY = 0.2,
  scale = 0.72,
}: {
  position?: Vec3;
  rotationY?: number;
  scale?: number;
}) {
  return (
    <group
      name="SurveyTripod"
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      <BeamBetween
        start={[0, 1.12, 0]}
        end={[-0.62, 0, 0.42]}
        radius={0.035}
        color="#899197"
      />
      <BeamBetween
        start={[0, 1.12, 0]}
        end={[0.62, 0, 0.42]}
        radius={0.035}
        color="#899197"
      />
      <BeamBetween
        start={[0, 1.12, 0]}
        end={[0, 0, -0.62]}
        radius={0.035}
        color="#899197"
      />

      <mesh position={[0, 1.12, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.12, 24]} />
        <meshStandardMaterial
          color="#3d4449"
          metalness={0.72}
          roughness={0.34}
        />
      </mesh>

      <RoundedBox
        position={[0, 1.3, 0.03]}
        args={[0.58, 0.3, 0.34]}
        radius={0.05}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial
          color="#f0a51d"
          roughness={0.42}
          metalness={0.18}
        />
      </RoundedBox>

      <mesh
        position={[0, 1.3, 0.235]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.105, 0.105, 0.12, 24]} />
        <meshStandardMaterial
          color="#171c20"
          metalness={0.55}
          roughness={0.22}
        />
      </mesh>

      <mesh position={[0, 1.3, 0.305]}>
        <circleGeometry args={[0.07, 24]} />
        <meshPhysicalMaterial
          color="#86c7df"
          roughness={0.12}
          metalness={0.05}
          clearcoat={1}
        />
      </mesh>
    </group>
  );
}

function SoilSampleKit({
  position = [0.38, 0.02, 1.72],
  scale = 0.72,
}: {
  position?: Vec3;
  scale?: number;
}) {
  const samples = [
    { x: -0.25, color: "#6d4931" },
    { x: 0, color: "#9a6a45" },
    { x: 0.25, color: "#4f3b2d" },
  ] as const;

  return (
    <group name="SoilSampleKit" position={position} scale={scale}>
      <RoundedBox
        position={[0, 0.09, 0]}
        args={[0.86, 0.18, 0.42]}
        radius={0.045}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          color="#384047"
          roughness={0.5}
          metalness={0.48}
        />
      </RoundedBox>

      {samples.map((sample) => (
        <group key={sample.x} position={[sample.x, 0, 0]}>
          <mesh position={[0, 0.39, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.58, 20]} />
            <meshPhysicalMaterial
              color="#dfe8e9"
              transparent
              opacity={0.42}
              roughness={0.12}
              metalness={0.02}
              depthWrite={false}
            />
          </mesh>

          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.34, 18]} />
            <meshStandardMaterial
              color={sample.color}
              roughness={0.98}
            />
          </mesh>

          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.087, 0.087, 0.055, 20]} />
            <meshStandardMaterial
              color="#d71920"
              roughness={0.38}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SurveyEngineer({
  position = [0.42, 0.02, 0.66],
  rotationY = -0.32,
  scale = 0.82,
}: {
  position?: Vec3;
  rotationY?: number;
  scale?: number;
}) {
  const skin = "#b97855";
  const navy = "#273d52";
  const safetyYellow = "#f2a91f";

  return (
    <group
      name="SurveyEngineer"
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    >
      {/* Work boots */}
      <RoundedBox
        position={[-0.16, 0.09, 0.07]}
        args={[0.2, 0.14, 0.34]}
        radius={0.045}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color="#25282b" roughness={0.82} />
      </RoundedBox>
      <RoundedBox
        position={[0.16, 0.09, 0.07]}
        args={[0.2, 0.14, 0.34]}
        radius={0.045}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color="#25282b" roughness={0.82} />
      </RoundedBox>

      {/* Work trousers */}
      <RoundedBox
        position={[-0.15, 0.5, 0]}
        args={[0.2, 0.78, 0.23]}
        radius={0.06}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color={navy} roughness={0.72} />
      </RoundedBox>
      <RoundedBox
        position={[0.15, 0.5, 0]}
        args={[0.2, 0.78, 0.23]}
        radius={0.06}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color={navy} roughness={0.72} />
      </RoundedBox>

      {/* Shirt and safety vest */}
      <RoundedBox
        position={[0, 1.13, 0]}
        args={[0.64, 0.72, 0.32]}
        radius={0.1}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial color="#e8edf0" roughness={0.7} />
      </RoundedBox>

      <RoundedBox
        position={[0, 1.14, 0.17]}
        args={[0.6, 0.58, 0.035]}
        radius={0.035}
        smoothness={3}
      >
        <meshStandardMaterial
          color={safetyYellow}
          roughness={0.62}
        />
      </RoundedBox>

      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 1.18, 0.195]}>
          <boxGeometry args={[0.065, 0.5, 0.012]} />
          <meshStandardMaterial color="#f4f4ed" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.04, 0.2]}>
        <boxGeometry args={[0.52, 0.065, 0.012]} />
        <meshStandardMaterial color="#f4f4ed" roughness={0.5} />
      </mesh>

      {/* Arms holding the site-plan clipboard */}
      <SoftBeamBetween
        start={[-0.3, 1.36, 0.02]}
        end={[-0.4, 1.08, 0.28]}
        radius={0.085}
        color="#e8edf0"
      />
      <SoftBeamBetween
        start={[0.3, 1.36, 0.02]}
        end={[0.4, 1.08, 0.28]}
        radius={0.085}
        color="#e8edf0"
      />
      <mesh position={[-0.4, 1.06, 0.3]} castShadow>
        <sphereGeometry args={[0.095, 18, 18]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0.4, 1.06, 0.3]} castShadow>
        <sphereGeometry args={[0.095, 18, 18]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>

      {/* Clipboard with a simplified site plan */}
      <group position={[0, 1.2, 0.37]} rotation={[-0.12, 0, 0]}>
        <RoundedBox
          args={[0.72, 0.52, 0.055]}
          radius={0.035}
          smoothness={3}
          castShadow
        >
          <meshStandardMaterial color="#b51e24" roughness={0.52} />
        </RoundedBox>
        <mesh position={[0, 0, 0.034]}>
          <planeGeometry args={[0.64, 0.44]} />
          <meshStandardMaterial color="#f5f4ef" roughness={0.9} />
        </mesh>
        {[-0.13, 0, 0.13].map((y, index) => (
          <mesh
            key={y}
            position={[
              index === 1 ? 0.06 : -0.04,
              y,
              0.041,
            ]}
          >
            <boxGeometry
              args={[index === 1 ? 0.42 : 0.5, 0.018, 0.008]}
            />
            <meshBasicMaterial color="#52636f" />
          </mesh>
        ))}
        {[-0.2, 0, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.045]}>
            <circleGeometry args={[0.028, 16]} />
            <meshBasicMaterial color="#d71920" />
          </mesh>
        ))}
      </group>

      {/* Neck, head and protective helmet */}
      <mesh position={[0, 1.53, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.16, 18]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.76, 0.015]} castShadow>
        <sphereGeometry args={[0.23, 28, 22]} />
        <meshStandardMaterial color={skin} roughness={0.74} />
      </mesh>
      <mesh position={[-0.235, 1.76, 0.015]} castShadow>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.74} />
      </mesh>
      <mesh position={[0.235, 1.76, 0.015]} castShadow>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial color={skin} roughness={0.74} />
      </mesh>

      {[-0.075, 0.075].map((x) => (
        <mesh key={x} position={[x, 1.79, 0.222]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshBasicMaterial color="#17191b" />
        </mesh>
      ))}

      <mesh position={[0, 1.88, -0.035]} castShadow>
        <sphereGeometry
          args={[
            0.285,
            28,
            14,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          ]}
        />
        <meshStandardMaterial
          color={safetyYellow}
          roughness={0.38}
          metalness={0.04}
        />
      </mesh>
      <mesh position={[0, 1.875, 0.025]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.045, 28]} />
        <meshStandardMaterial
          color={safetyYellow}
          roughness={0.42}
          metalness={0.04}
        />
      </mesh>
      <RoundedBox
        position={[0, 1.875, 0.25]}
        args={[0.35, 0.035, 0.16]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial color={safetyYellow} roughness={0.42} />
      </RoundedBox>
    </group>
  );
}

function BoreholeRig() {
  return (
    <group name="CompactBoreholeRig" position={[-0.05, 0.02, -0.78]}>
      {/* Compact rotary-auger mast and base remain inside the median. */}
      <RoundedBox
        position={[0, 0.12, 0]}
        args={[0.82, 0.22, 0.72]}
        radius={0.055}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color="#3f474c" roughness={0.58} />
      </RoundedBox>

      <BeamBetween
        start={[-0.25, 0.18, 0.12]}
        end={[0, 2.15, -0.02]}
        radius={0.055}
        color="#dca829"
      />
      <BeamBetween
        start={[0.25, 0.18, 0.12]}
        end={[0, 2.15, -0.02]}
        radius={0.055}
        color="#dca829"
      />
      <BeamBetween
        start={[0, 2.15, -0.02]}
        end={[0, 0.2, -0.08]}
        radius={0.038}
        color="#6a7175"
      />

      <mesh position={[0, 0.28, -0.08]} castShadow>
        <cylinderGeometry args={[0.12, 0.08, 0.56, 18]} />
        <meshStandardMaterial
          color="#565f64"
          metalness={0.76}
          roughness={0.36}
        />
      </mesh>

      <mesh
        position={[0, 0.035, -0.08]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.15, 0.24, 28]} />
        <meshStandardMaterial color="#6e4b31" roughness={0.98} />
      </mesh>

      <RoundedBox
        position={[0.28, 0.68, 0.08]}
        args={[0.42, 0.48, 0.34]}
        radius={0.045}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial color="#d9a426" roughness={0.48} />
      </RoundedBox>
    </group>
  );
}

function WorkZoneSign() {
  const texture = useExactLabelTexture(
    "SITE SURVEY",
    "#f1b51d",
    "#171b1e",
  );

  return (
    <group position={[0, 0.02, 2.42]} scale={0.72}>
      <BeamBetween
        start={[-0.36, 0, 0]}
        end={[-0.24, 0.94, 0]}
        radius={0.035}
        color="#555d62"
      />
      <BeamBetween
        start={[0.36, 0, 0]}
        end={[0.24, 0.94, 0]}
        radius={0.035}
        color="#555d62"
      />
      <RoundedBox
        position={[0, 1.08, 0]}
        args={[1.22, 0.54, 0.07]}
        radius={0.035}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#f1b51d"}
          roughness={0.62}
        />
      </RoundedBox>
    </group>
  );
}

function MedianWorkBarriers() {
  const posts = useMemo(
    () =>
      [-2.3, -1.15, 0, 1.15, 2.3].flatMap((z) =>
        [-0.69, 0.69].map((x) => ({
          position: [x, 0.36, z] as Vec3,
          size: [0.055, 0.72, 0.055] as Vec3,
        })),
      ),
    [],
  );

  return (
    <group name="MedianOnlyWorkZone">
      <InstancedBoxes
        items={posts}
        material={getSteelMaterial("#656c70", 0.46)}
      />
      {[-0.69, 0.69].map((x) => (
        <group key={x}>
          <BoxMember
            position={[x, 0.25, 0]}
            size={[0.065, 0.11, 4.72]}
            color="#f0f0e8"
          />
          <BoxMember
            position={[x, 0.54, 0]}
            size={[0.065, 0.12, 4.72]}
            color="#c7262e"
          />
        </group>
      ))}
    </group>
  );
}

function SurveyScene() {
  return (
    <group name="SiteSurveyAndSoilAnalysis">
      <MedianWorkBarriers />
      <BoreholeRig />
      <SurveyTripod />
      <SoilSampleKit />
      <SurveyEngineer />
      <WorkZoneSign />
    </group>
  );
}

function FinalInspectionScene() {
  const certifiedTexture = useExactLabelTexture(
    "CERTIFIED",
    "#f4f2e9",
    "#23633d",
  );

  return (
    <group name="QualityCertification">
      {/* A real handover is communicated through alignment measurement,
          electrical testing and a signed checklist—not decorative cones. */}
      <SurveyTripod
        position={[-0.38, 0.02, 1.86]}
        rotationY={-0.08}
        scale={0.64}
      />
      <SurveyEngineer
        position={[0.43, 0.02, 1.02]}
        rotationY={-0.22}
        scale={0.72}
      />

      <group position={[-0.42, 0.02, -0.56]} rotation={[0, 0.08, 0]}>
        <RoundedBox
          position={[0, 0.52, 0]}
          args={[0.58, 0.92, 0.34]}
          radius={0.055}
          smoothness={3}
          castShadow
        >
          <meshStandardMaterial
            color="#565f64"
            metalness={0.5}
            roughness={0.44}
          />
        </RoundedBox>
        <RoundedBox
          position={[0, 0.55, 0.185]}
          args={[0.46, 0.68, 0.035]}
          radius={0.025}
          smoothness={3}
        >
          <meshStandardMaterial color="#20272c" roughness={0.52} />
        </RoundedBox>
        {[-0.14, 0, 0.14].map((y, index) => (
          <mesh key={y} position={[0, 0.55 + y, 0.208]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial
              color={index === 1 ? "#e7b22d" : "#39a05e"}
            />
          </mesh>
        ))}
      </group>

      <group position={[0.03, 0.02, 2.42]} rotation={[0, -0.05, 0]}>
        <BeamBetween
          start={[-0.38, 0, 0]}
          end={[-0.22, 1.42, 0]}
          radius={0.035}
          color="#6f767b"
        />
        <BeamBetween
          start={[0.38, 0, 0]}
          end={[0.22, 1.42, 0]}
          radius={0.035}
          color="#6f767b"
        />
        <RoundedBox
          position={[0, 1.62, 0]}
          args={[1.08, 0.72, 0.08]}
          radius={0.04}
          smoothness={3}
          castShadow
        >
          <meshStandardMaterial
            map={certifiedTexture ?? undefined}
            color={certifiedTexture ? "#ffffff" : "#f2f1ed"}
            roughness={0.7}
          />
        </RoundedBox>
      </group>
    </group>
  );
}

/* MASTER UNIPOLE PLACEMENT
   More-negative Z moves the complete UNIPOLE farther into the road.
   Smaller scale moves it visually farther away without changing proportions. */
const UNIPOLE_SCENE_POSITION: Vec3 = [0, -0.11, -3];
const UNIPOLE_SCENE_SCALE = 0.86;

function RealisticUnipoleModel({
  progressRef,
  reducedMotion,
  dayMode,
}: ModelProps) {
  const surveyRef = useRef<THREE.Group | null>(null);
  const blueprintRef = useRef<THREE.Group | null>(null);
  const foundationRef = useRef<THREE.Group | null>(null);
  const poleRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<THREE.Group | null>(null);
  const lightingRef = useRef<THREE.Group | null>(null);
  const panelRef = useRef<THREE.Group | null>(null);
  const inspectionRef = useRef<THREE.Group | null>(null);
  const boardLightRefs = useRef<Array<THREE.SpotLight | null>>([]);
  const currentProgress = useRef(0);

  /* Billboard floodlights + their aim targets, expressed in the same local
     space as the fixtures themselves (LightingRig) and the board
     (FrontDisplayPanel), so they inherit the model's transform and stay
     correctly aimed regardless of scale. */
  const boardLightRig = useMemo(
    () =>
      BOARD_LIGHT_SOURCE_X.map((x) => {
        const target = new THREE.Object3D();
        target.position.set(x * 0.82, 10.92, 0.34);

        return {
          position: [
            x,
            BOARD_LIGHT_GROUP_Y +
              BOARD_HALF_HEIGHT +
              0.74 +
              BOARD_LIGHT_RISE,
            0.74,
          ] as Vec3,
          target,
        };
      }),
    [],
  );

  useFrame((_, delta) => {
    currentProgress.current = reducedMotion
      ? progressRef.current
      : damp(
          currentProgress.current,
          progressRef.current,
          5.4,
          delta,
        );

    const progress = currentProgress.current;

    const survey = 1 - smoothStep(0.1, 0.22, progress);
    const blueprintIn = smoothStep(0.04, 0.14, progress);
    const blueprintOut = 1 - smoothStep(0.2, 0.34, progress);
    const blueprint = blueprintIn * blueprintOut;
    const foundation = smoothStep(0.18, 0.31, progress);
    const pole = smoothStep(0.31, 0.45, progress);
    const frame = smoothStep(0.44, 0.59, progress);
    const lighting = smoothStep(0.58, 0.73, progress);
    const panel = smoothStep(0.72, 0.88, progress);
    const inspection = smoothStep(0.88, 1, progress);

    /* Billboard floodlights stay at zero until Stage 6 (Electrical &
       Lighting) begins, then ramp in — reusing the same smoothed
       progress value as the fixtures themselves so light and geometry
       always agree. */
    const boardLightIntensity = dayMode
      ? 0
      : lighting *
        UNIPOLE_LIGHT_BASE_INTENSITY *
        UNIPOLE_NIGHT_LIGHT_RATIO;
    boardLightRefs.current.forEach((light) => {
      if (light) light.intensity = boardLightIntensity;
    });

    if (surveyRef.current) {
      surveyRef.current.visible = survey > 0.01;
      surveyRef.current.scale.setScalar(
        THREE.MathUtils.lerp(0.94, 1, survey),
      );
    }

    if (blueprintRef.current) {
      blueprintRef.current.visible = blueprint > 0.01;
      blueprintRef.current.scale.setScalar(
        THREE.MathUtils.lerp(0.9, 1, blueprintIn),
      );

      blueprintRef.current.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          object.material instanceof THREE.Material
        ) {
          object.material.transparent = true;
          object.material.opacity = blueprint * 0.58;
        }
      });
    }

    if (foundationRef.current) {
      foundationRef.current.visible = foundation > 0.01;
      foundationRef.current.position.y = THREE.MathUtils.lerp(
        -1.35,
        0,
        foundation,
      );
      foundationRef.current.scale.y = THREE.MathUtils.lerp(
        0.24,
        1,
        foundation,
      );
    }

    if (poleRef.current) {
      poleRef.current.visible = pole > 0.01;
      poleRef.current.scale.y = Math.max(0.001, pole);
      poleRef.current.rotation.z = THREE.MathUtils.lerp(
        -0.045,
        0,
        pole,
      );
    }

    /* Rear frame enters from behind the pole. */
    if (frameRef.current) {
      frameRef.current.visible = frame > 0.01;
      frameRef.current.position.z = THREE.MathUtils.lerp(
        -6.2,
        -0.18,
        frame,
      );
      frameRef.current.position.y = THREE.MathUtils.lerp(
        10.95,
        11.55,
        frame,
      );
      frameRef.current.rotation.x = THREE.MathUtils.lerp(
        -0.1,
        0,
        frame,
      );
      frameRef.current.scale.setScalar(
        THREE.MathUtils.lerp(0.88, 1, frame),
      );
    }

    if (lightingRef.current) {
      lightingRef.current.visible = lighting > 0.01;
      lightingRef.current.position.y = THREE.MathUtils.lerp(
        BOARD_LIGHT_GROUP_Y - 0.7,
        BOARD_LIGHT_GROUP_Y,
        lighting,
      );
      lightingRef.current.scale.setScalar(
        Math.max(0.001, lighting),
      );
    }

    /* Front board enters from the camera side and seats onto the rear frame. */
    if (panelRef.current) {
      panelRef.current.visible = panel > 0.01;
      panelRef.current.position.z = THREE.MathUtils.lerp(
        7.2,
        0.22,
        panel,
      );
      panelRef.current.position.y = THREE.MathUtils.lerp(
        11.78,
        11.55,
        panel,
      );
      panelRef.current.rotation.y = THREE.MathUtils.lerp(
        0.08,
        0,
        panel,
      );
      panelRef.current.scale.setScalar(
        THREE.MathUtils.lerp(0.96, 1, panel),
      );
    }

    if (inspectionRef.current) {
      inspectionRef.current.visible = inspection > 0.01;
      inspectionRef.current.scale.setScalar(
        Math.max(0.001, inspection),
      );
    }
  });

  return (
    <group
      scale={UNIPOLE_SCENE_SCALE}
      position={UNIPOLE_SCENE_POSITION}
      rotation={[0, 0, 0]}
    >
      <group ref={surveyRef}>
        <SurveyScene />
      </group>

      <group ref={blueprintRef} visible={false}>
        <mesh position={[0, 5.35, 0]}>
          <cylinderGeometry args={[0.48, 0.74, 9.6, 32]} />
          <meshBasicMaterial
            color="#ff3340"
            wireframe
            transparent
            opacity={0}
          />
        </mesh>

        <mesh position={[0, 11.55, -0.2]}>
          <boxGeometry args={[BOARD_WIDTH, BOARD_HEIGHT + 0.2, 0.5]} />
          <meshBasicMaterial
            color="#ff3340"
            wireframe
            transparent
            opacity={0}
          />
        </mesh>
      </group>

      <group name="Foundation" ref={foundationRef} visible={false}>
        <RoundedBox
          position={[0, 0.34, 0]}
          args={[2.05, 0.68, 2.35]}
          radius={0.08}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#8b8e91" roughness={0.9} />
        </RoundedBox>

        <group name="AnchorBolts">
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            return [
              Math.cos(angle) * 0.68,
              0.94,
              Math.sin(angle) * 0.68,
            ] as Vec3;
          }).map((position, index) => (
            <AnchorBolt key={index} position={position as Vec3} />
          ))}
        </group>
      </group>

      <group
        ref={poleRef}
        position={[0, 0.66, 0]}
        scale={[1, 0.001, 1]}
        visible={false}
      >
        <PoleAndBase />
      </group>

      <group
        name="RearFrame"
        ref={frameRef}
        position={[0, 11.55, -6.2]}
        visible={false}
      >
        <RearStructuralFrame />
        <group name="MaintenancePlatform">
          <MaintenanceDeck />
        </group>
      </group>

      <group
        name="LightArms"
        ref={lightingRef}
        position={[0, BOARD_LIGHT_GROUP_Y, -0.15]}
        scale={0.001}
        visible={false}
      >
        <LightingRig dayMode={dayMode} />
      </group>

      {!dayMode && boardLightRig.map((rig, index) => (
        <group key={index}>
          <primitive object={rig.target} />

          <spotLight
            ref={(light) => {
              boardLightRefs.current[index] = light;
              if (light) light.target = rig.target;
            }}
            position={rig.position}
            angle={0.42}
            penumbra={0.68}
            distance={10}
            decay={1.45}
            intensity={0}
            color="#ffe9c2"
            castShadow={index === 1}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0002}
          />
        </group>
      ))}

      <group
        name="SignageBoard"
        ref={panelRef}
        position={[0, 11.78, 7.2]}
        visible={false}
      >
        <FrontDisplayPanel dayMode={dayMode} />
      </group>

      <group ref={inspectionRef} visible={false}>
        <FinalInspectionScene />
      </group>
    </group>
  );
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const FOLIAGE_SHADES = [
  "#245f2c",
  "#2f7733",
  "#3d8b38",
  "#4d9c3d",
  "#65ad47",
] as const;

/* Smooth, reusable geometry gives the residential trees the rounded,
   sculpted look of a Maya/Blender render without loading an external model. */
const foliageGeometry = new THREE.SphereGeometry(1, 18, 12);
const foliageMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.78,
  metalness: 0.01,
});

const BRANCH_TAPER_RATIOS = [0.2, 0.35, 0.5, 0.7] as const;
const branchGeometries = BRANCH_TAPER_RATIOS.map(
  (ratio) => new THREE.CylinderGeometry(ratio, 1, 1, 14, 1),
);

const CANOPY_MASSES = [
  { position: [-0.93, 2.26, 0.02], scale: [0.72, 0.34, 0.58] },
  { position: [-0.58, 2.54, -0.2], scale: [0.8, 0.37, 0.62] },
  { position: [-0.16, 2.38, 0.3], scale: [0.86, 0.4, 0.66] },
  { position: [0.28, 2.5, -0.28], scale: [0.86, 0.39, 0.68] },
  { position: [0.72, 2.35, 0.18], scale: [0.8, 0.36, 0.62] },
  { position: [1.02, 2.18, -0.04], scale: [0.68, 0.32, 0.54] },
  { position: [-0.95, 2.63, 0.22], scale: [0.63, 0.31, 0.52] },
  { position: [-0.52, 2.82, 0.08], scale: [0.73, 0.34, 0.58] },
  { position: [-0.08, 2.98, -0.1], scale: [0.78, 0.36, 0.61] },
  { position: [0.4, 2.88, 0.13], scale: [0.75, 0.34, 0.58] },
  { position: [0.82, 2.68, -0.15], scale: [0.67, 0.31, 0.53] },
  { position: [-0.54, 2.2, 0.52], scale: [0.64, 0.3, 0.48] },
  { position: [0.08, 2.2, 0.53], scale: [0.73, 0.33, 0.54] },
  { position: [0.61, 2.17, 0.46], scale: [0.63, 0.29, 0.47] },
  { position: [-0.5, 2.62, 0.48], scale: [0.61, 0.29, 0.48] },
  { position: [0.28, 2.65, 0.49], scale: [0.65, 0.3, 0.5] },
] as const;

type TreeBranchInstance = {
  start: Vec3;
  end: Vec3;
  baseRadius: number;
  tipRadius: number;
  color: string;
};

const branchInstanceMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.86,
});

function getBranchGeometryIndex(branch: TreeBranchInstance) {
  const taperRatio = branch.tipRadius / branch.baseRadius;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  BRANCH_TAPER_RATIOS.forEach((ratio, index) => {
    const distance = Math.abs(ratio - taperRatio);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function BranchInstances({
  items,
  geometryIndex,
}: {
  items: TreeBranchInstance[];
  geometryIndex: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const axis = new THREE.Vector3(0, 1, 0);
    const startPoint = new THREE.Vector3();
    const endPoint = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const color = new THREE.Color();

    items.forEach((item, index) => {
      startPoint.set(...item.start);
      endPoint.set(...item.end);
      direction.copy(endPoint).sub(startPoint);

      helper.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
      helper.quaternion.setFromUnitVectors(
        axis,
        direction.clone().normalize(),
      );
      helper.scale.set(
        item.baseRadius,
        direction.length(),
        item.baseRadius,
      );
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);

      color.set(item.color);
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[
        branchGeometries[geometryIndex],
        branchInstanceMaterial,
        items.length,
      ]}
      castShadow
      receiveShadow
    />
  );
}

function TreeBranches({ items }: { items: TreeBranchInstance[] }) {
  const batches = useMemo(
    () =>
      BRANCH_TAPER_RATIOS.map((_, geometryIndex) =>
        items.filter(
          (branch) => getBranchGeometryIndex(branch) === geometryIndex,
        ),
      ),
    [items],
  );

  return (
    <>
      {batches.map((batch, geometryIndex) =>
        batch.length > 0 ? (
          <BranchInstances
            key={geometryIndex}
            items={batch}
            geometryIndex={geometryIndex}
          />
        ) : null,
      )}
    </>
  );
}

const TREE_BRANCHES: TreeBranchInstance[] = [
  ...([
    [-0.76, 0.02, 0.16],
    [0.72, 0.02, 0.2],
    [-0.34, 0.02, -0.62],
    [0.32, 0.02, -0.58],
    [0.08, 0.02, 0.72],
  ] as Vec3[]).map((end, index) => ({
    start: [0, 0.2, 0] as Vec3,
    end,
    baseRadius: 0.12,
    tipRadius: 0.025,
    color: index % 2 === 0 ? "#684027" : "#7d4c2c",
  })),
  {
    start: [0, 0.12, 0],
    end: [-0.08, 1.1, 0.03],
    baseRadius: 0.25,
    tipRadius: 0.18,
    color: "#74452a",
  },
  {
    start: [-0.08, 1.04, 0.03],
    end: [0.04, 1.82, -0.01],
    baseRadius: 0.19,
    tipRadius: 0.13,
    color: "#815033",
  },
  {
    start: [0.08, 0.2, 0.02],
    end: [0.2, 1.15, 0.08],
    baseRadius: 0.14,
    tipRadius: 0.095,
    color: "#5f3824",
  },
  ...([
    { start: [-0.04, 1.12, 0.02], end: [-0.66, 2.14, 0.08], base: 0.14, tip: 0.05 },
    { start: [-0.38, 1.68, 0.06], end: [-1.02, 2.38, 0.16], base: 0.075, tip: 0.03 },
    { start: [0.16, 1.2, 0.06], end: [0.72, 2.12, 0.02], base: 0.13, tip: 0.048 },
    { start: [0.48, 1.77, 0.04], end: [1.02, 2.36, -0.12], base: 0.07, tip: 0.026 },
    { start: [0.03, 1.76, 0], end: [-0.26, 2.56, -0.12], base: 0.115, tip: 0.038 },
    { start: [0.06, 1.76, 0], end: [0.38, 2.58, 0.11], base: 0.105, tip: 0.034 },
    { start: [-0.48, 1.85, 0.08], end: [-0.82, 2.17, 0.5], base: 0.055, tip: 0.022 },
    { start: [0.52, 1.92, 0.04], end: [0.8, 2.2, 0.48], base: 0.052, tip: 0.02 },
  ] as const).map((branch, index) => ({
    start: branch.start as Vec3,
    end: branch.end as Vec3,
    baseRadius: branch.base,
    tipRadius: branch.tip,
    color: index % 2 === 0 ? "#75462a" : "#865337",
  })),
];

type FoliageInstance = {
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
  materialIndex: number;
};

function FoliageInstances({ items }: { items: FoliageInstance[] }) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const color = new THREE.Color();

    items.forEach((item, index) => {
      helper.position.set(...item.position);
      helper.scale.set(...item.scale);
      helper.rotation.set(...item.rotation);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);

      color.set(FOLIAGE_SHADES[item.materialIndex]);
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[foliageGeometry, foliageMaterial, items.length]}
      castShadow
      receiveShadow
    />
  );
}

function Tree({ position, seed }: { position: Vec3; seed: number }) {
  const rand = (offset: number) => seededRandom(seed * 7.13 + offset);

  const trunkTilt = (rand(2) - 0.5) * 0.035;
  const trunkLean = (rand(3) - 0.5) * 0.035;
  const treeScale = 0.82 + rand(4) * 0.24;
  const treeRotation = rand(6) * Math.PI * 2;

  const clusters = useMemo(
    () => {
      const seeded = (offset: number) =>
        seededRandom(seed * 7.13 + offset);

      return CANOPY_MASSES.map((mass, index) => ({
        position: [
          mass.position[0] + (seeded(10 + index) - 0.5) * 0.13,
          mass.position[1] + (seeded(30 + index) - 0.5) * 0.12,
          mass.position[2] + (seeded(50 + index) - 0.5) * 0.12,
        ] as Vec3,
        scale: [
          mass.scale[0] * (0.9 + seeded(70 + index) * 0.18),
          mass.scale[1] * (0.9 + seeded(90 + index) * 0.18),
          mass.scale[2] * (0.9 + seeded(110 + index) * 0.18),
        ] as Vec3,
        rotation: [
          (seeded(130 + index) - 0.5) * 0.22,
          seeded(150 + index) * Math.PI,
          (seeded(170 + index) - 0.5) * 0.18,
        ] as Vec3,
        materialIndex: Math.floor(
          seeded(190 + index) * FOLIAGE_SHADES.length,
        ),
      }));
    },
    [seed],
  );

  const leaflets = useMemo(() => {
    const seeded = (offset: number) =>
      seededRandom(seed * 9.91 + offset);

    return Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      const radius = 0.92 + seeded(index + 4) * 0.2;

      return {
        position: [
          Math.cos(angle) * radius,
          2.46 + Math.sin(angle * 2) * 0.24 + seeded(index + 20) * 0.22,
          Math.sin(angle) * 0.35 + 0.28,
        ] as Vec3,
        scale: [
          0.22 + seeded(index + 40) * 0.08,
          0.075 + seeded(index + 60) * 0.035,
          0.13 + seeded(index + 80) * 0.05,
        ] as Vec3,
        rotation: [
          seeded(index + 100) * 0.35,
          -angle,
          (seeded(index + 120) - 0.5) * 0.7,
        ] as Vec3,
        materialIndex: 2 + (index % 3),
      };
    });
  }, [seed]);

  const foliage = useMemo(
    () => [...clusters, ...leaflets],
    [clusters, leaflets],
  );

  return (
    <group
      position={position}
      scale={treeScale}
      rotation={[trunkTilt, treeRotation, trunkLean]}
    >
      {/* Soft grass island and exposed roots ground the tree naturally. */}
      <mesh position={[0, 0.04, 0]} scale={[1.05, 0.14, 0.82]} receiveShadow>
        <sphereGeometry args={[1, 22, 12]} />
        <meshStandardMaterial color="#426f29" roughness={0.92} />
      </mesh>

      {/* Roots, trunk and branches retain their exact transforms but are
          consolidated into a few tapered-cylinder instance batches. */}
      <TreeBranches items={TREE_BRANCHES} />

      {/* All 28 rounded canopy pieces now render in a single instanced draw
          call per tree, including the small silhouette-breaking leaves. */}
      <FoliageInstances items={foliage} />
    </group>
  );
}

type ModernBuildingProps = {
  position: Vec3;
  rotationY: number;
  width: number;
  height: number;
  depth: number;
  wallColor: string;
  accentColor: string;
  glassColor: string;
  seed: number;
  style: "apartment" | "office" | "mixed";
  signLabel?: string;
};

const MODERN_BUILDING_LIT_GLASS_DAY_MATERIAL =
  new THREE.MeshStandardMaterial({
    color: "#6f8997",
    emissive: "#6f8997",
    emissiveIntensity: 0.04,
    roughness: 0.18,
    metalness: 0.22,
  });

const MODERN_BUILDING_LIT_GLASS_NIGHT_MATERIAL =
  new THREE.MeshStandardMaterial({
    color: "#ffd28a",
    emissive: "#bc711f",
    emissiveIntensity: 0.72,
    roughness: 0.2,
    metalness: 0.08,
  });

function useConcreteSurfaceTexture() {
  const [texture, setTexture] =
    useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#d7d7d3";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 1800; index += 1) {
      const x = Math.floor(seededRandom(index * 3.17) * canvas.width);
      const y = Math.floor(seededRandom(index * 7.31) * canvas.height);
      const tone = 188 + Math.floor(seededRandom(index * 11.27) * 48);
      const alpha = 0.05 + seededRandom(index * 17.83) * 0.11;
      context.fillStyle = `rgba(${tone}, ${tone}, ${tone}, ${alpha})`;
      context.fillRect(x, y, 1, 1);
    }

    context.strokeStyle = "rgba(105, 112, 114, 0.08)";
    context.lineWidth = 1;
    [24, 58, 82].forEach((y, index) => {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(96, y + (index % 2 === 0 ? 1 : -1));
      context.stroke();
    });

    const concreteTexture = new THREE.CanvasTexture(canvas);
    concreteTexture.colorSpace = THREE.SRGBColorSpace;
    concreteTexture.wrapS = THREE.RepeatWrapping;
    concreteTexture.wrapT = THREE.RepeatWrapping;
    concreteTexture.repeat.set(2.4, 4.8);
    concreteTexture.anisotropy = 2;
    setTexture(concreteTexture);

    return () => concreteTexture.dispose();
  }, []);

  return texture;
}

function BuildingSign({
  label,
  position,
  width,
  color,
}: {
  label: string;
  position: Vec3;
  width: number;
  color: string;
}) {
  const texture = useExactLabelTexture(label, color, "#f7f4ed");

  return (
    <mesh position={position}>
      <planeGeometry args={[width, 0.32]} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? "#ffffff" : color}
        emissive={color}
        emissiveIntensity={0.08}
        roughness={0.48}
      />
    </mesh>
  );
}

function ModernBuilding({
  position,
  rotationY,
  width,
  height,
  depth,
  wallColor,
  accentColor,
  glassColor,
  seed,
  style,
  signLabel,
  dayMode,
  concreteTexture,
}: ModernBuildingProps & {
  dayMode: boolean;
  concreteTexture: THREE.CanvasTexture | null;
}) {
  const frontZ = depth / 2 + 0.055;
  const floorCount = Math.max(4, Math.floor((height - 1.3) / 1.05));
  const bayCount = Math.max(2, Math.floor(width / 1.15));
  const floorGap = (height - 1.35) / floorCount;
  const windowWidth = Math.min(0.72, (width * 0.7) / bayCount);
  const windowHeight = Math.min(0.72, floorGap * 0.62);

  const facade = useMemo(() => {
    const frames: BoxInstance[] = [];
    const darkGlass: BoxInstance[] = [];
    const litGlass: BoxInstance[] = [];
    const mullions: BoxInstance[] = [];
    const windowSills: BoxInstance[] = [];
    const facadeBands: BoxInstance[] = [];
    const sunshades: BoxInstance[] = [];
    const balconySlabs: BoxInstance[] = [];
    const balconyRails: BoxInstance[] = [];
    const acUnits: BoxInstance[] = [];

    const addWindow = (
      windowPosition: Vec3,
      windowSize: Vec3,
      rotation: Vec3,
      lit: boolean,
    ) => {
      frames.push({
        position: windowPosition,
        size: [windowSize[0] + 0.12, windowSize[1] + 0.12, 0.075],
        rotation,
      });

      const glassPosition = [...windowPosition] as Vec3;
      if (rotation[1] === 0) glassPosition[2] += 0.07;
      else glassPosition[0] += Math.sign(windowPosition[0] || 1) * 0.07;

      (lit ? litGlass : darkGlass).push({
        position: glassPosition,
        size: windowSize,
        rotation,
      });

      const mullionPosition = [...glassPosition] as Vec3;
      if (rotation[1] === 0) mullionPosition[2] += 0.025;
      else {
        mullionPosition[0] += Math.sign(windowPosition[0] || 1) * 0.025;
      }

      mullions.push(
        {
          position: mullionPosition,
          size: [0.028, windowSize[1], 0.026],
          rotation,
        },
        {
          position: mullionPosition,
          size: [windowSize[0], 0.028, 0.026],
          rotation,
        },
      );

      const sillPosition = [...windowPosition] as Vec3;
      sillPosition[1] -= windowSize[1] / 2 + 0.055;
      if (rotation[1] === 0) {
        sillPosition[2] += 0.12;
        windowSills.push({
          position: sillPosition,
          size: [windowSize[0] + 0.16, 0.045, 0.16],
        });
      } else {
        sillPosition[0] += Math.sign(windowPosition[0] || 1) * 0.12;
        windowSills.push({
          position: sillPosition,
          size: [0.16, 0.045, windowSize[0] + 0.16],
        });
      }

      const shadePosition = [...windowPosition] as Vec3;
      shadePosition[1] += windowSize[1] / 2 + 0.1;
      if (rotation[1] === 0) {
        shadePosition[2] += 0.16;
        sunshades.push({
          position: shadePosition,
          size: [windowSize[0] + 0.18, 0.055, 0.28],
        });
      } else {
        shadePosition[0] += Math.sign(windowPosition[0] || 1) * 0.16;
        sunshades.push({
          position: shadePosition,
          size: [0.28, 0.055, windowSize[0] + 0.18],
        });
      }
    };

    for (let floor = 0; floor < floorCount; floor += 1) {
      const y = 1.42 + floorGap * (floor + 0.5);

      facadeBands.push({
        position: [0, y - floorGap * 0.49, frontZ + 0.075],
        size: [width * 0.92, 0.045, 0.13],
      });

      for (let bay = 0; bay < bayCount; bay += 1) {
        const x =
          bayCount === 1
            ? 0
            : -width * 0.34 + (bay / (bayCount - 1)) * width * 0.68;
        addWindow(
          [x, y, frontZ + 0.025],
          [windowWidth, windowHeight, 0.035],
          [0, 0, 0],
          seededRandom(seed * 43 + floor * 11 + bay) > 0.6,
        );
      }

      [-1, 1].forEach((side) => {
        [-depth * 0.2, depth * 0.2].forEach((z, sideIndex) => {
          addWindow(
            [side * (width / 2 + 0.025), y, z],
            [Math.min(0.56, depth * 0.22), windowHeight, 0.035],
            [0, Math.PI / 2, 0],
            seededRandom(
              seed * 61 + floor * 7 + sideIndex + (side > 0 ? 13 : 0),
            ) > 0.68,
          );
        });
      });

      if (
        style !== "office" &&
        floor > 0 &&
        floor % 2 === seed % 2
      ) {
        const balconyY = y - windowHeight * 0.58;
        balconySlabs.push({
          position: [width * 0.22, balconyY, frontZ + 0.34],
          size: [width * 0.46, 0.1, 0.72],
        });
        balconyRails.push(
          {
            position: [width * 0.22, balconyY + 0.42, frontZ + 0.67],
            size: [width * 0.46, 0.055, 0.045],
          },
          {
            position: [width * 0.01, balconyY + 0.23, frontZ + 0.67],
            size: [0.045, 0.45, 0.045],
          },
          {
            position: [width * 0.43, balconyY + 0.23, frontZ + 0.67],
            size: [0.045, 0.45, 0.045],
          },
        );
      }

      if (floor % 2 === 1) {
        acUnits.push({
          position: [-width * 0.43, y - 0.12, frontZ + 0.16],
          size: [0.38, 0.27, 0.18],
        });
      }
    }

    return {
      frames,
      darkGlass,
      litGlass,
      mullions,
      windowSills,
      facadeBands,
      sunshades,
      balconySlabs,
      balconyRails,
      acUnits,
    };
  }, [
    bayCount,
    depth,
    floorCount,
    floorGap,
    frontZ,
    height,
    seed,
    style,
    width,
    windowHeight,
    windowWidth,
  ]);

  const storeMullions = useMemo(
    () =>
      [-0.24, 0, 0.24].map((offset) => ({
        position: [offset * width, 0.69, frontZ + 0.145] as Vec3,
        size: [0.035, 0.88, 0.035] as Vec3,
      })),
    [frontZ, width],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Clean concrete main volume with subtle bevels and real depth. */}
      <RoundedBox
        position={[0, height / 2, 0]}
        args={[width, height, depth]}
        radius={0.07}
        smoothness={3}
        castShadow={position[2] > 6}
        receiveShadow
      >
        <meshStandardMaterial
          map={concreteTexture ?? undefined}
          color={wallColor}
          roughness={0.76}
          metalness={0.04}
        />
      </RoundedBox>

      {/* Dark stone plinth and vertical architectural fins. */}
      <RoundedBox
        position={[0, 0.18, 0]}
        args={[width + 0.12, 0.36, depth + 0.12]}
        radius={0.03}
        smoothness={3}
        receiveShadow
      >
        <meshStandardMaterial color="#343a3f" roughness={0.72} />
      </RoundedBox>

      <RoundedBox
        position={[-width * 0.39, height * 0.56, frontZ + 0.03]}
        args={[width * 0.16, height * 0.82, 0.12]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial color={accentColor} roughness={0.5} />
      </RoundedBox>

      {[-1, 1].map((side) => (
        <RoundedBox
          key={side}
          position={[
            side * (width / 2 - 0.035),
            height / 2,
            frontZ + 0.03,
          ]}
          args={[0.08, height - 0.18, 0.1]}
          radius={0.018}
          smoothness={2}
        >
          <meshStandardMaterial color="#d5d9da" roughness={0.58} />
        </RoundedBox>
      ))}

      <InstancedBoxes
        items={facade.frames}
        material={getStandardMaterial("#20272c", 0.46, 0.18)}
      />
      <InstancedBoxes
        items={facade.darkGlass}
        material={getStandardMaterial(glassColor, 0.14, 0.34)}
      />
      <InstancedBoxes
        items={facade.litGlass}
        material={
          dayMode
            ? MODERN_BUILDING_LIT_GLASS_DAY_MATERIAL
            : MODERN_BUILDING_LIT_GLASS_NIGHT_MATERIAL
        }
      />
      <InstancedBoxes
        items={facade.mullions}
        material={getStandardMaterial("#8c979d", 0.32, 0.7)}
      />
      <InstancedBoxes
        items={facade.windowSills}
        material={getStandardMaterial("#737d82", 0.58, 0.08)}
      />
      <InstancedBoxes
        items={facade.facadeBands}
        material={getStandardMaterial("#626b70", 0.66, 0.04)}
      />
      <InstancedBoxes
        items={facade.sunshades}
        material={getStandardMaterial("#949b9c", 0.68, 0.04)}
      />
      <InstancedBoxes
        items={facade.balconySlabs}
        material={getStandardMaterial("#858e92", 0.66, 0.05)}
      />
      <InstancedBoxes
        items={facade.balconyRails}
        material={getSteelMaterial("#727d83", 0.28)}
      />
      <InstancedBoxes
        items={facade.acUnits}
        material={getStandardMaterial("#bcc3c5", 0.54, 0.08)}
      />

      {[-1, 1].map((side) => (
        <BoxMember
          key={`drain-${side}`}
          position={[
            side * width * 0.46,
            height * 0.48,
            frontZ + 0.14,
          ]}
          size={[0.045, height * 0.9, 0.045]}
          color="#858e91"
        />
      ))}

      {/* Ground-floor glazing provides a finished contemporary street edge. */}
      <RoundedBox
        position={[0.08 * width, 0.68, frontZ + 0.06]}
        args={[width * 0.72, 1.04, 0.09]}
        radius={0.022}
        smoothness={3}
      >
        <meshStandardMaterial color="#1c2429" roughness={0.38} />
      </RoundedBox>
      <RoundedBox
        position={[0.08 * width, 0.68, frontZ + 0.125]}
        args={[width * 0.68, 0.9, 0.035]}
        radius={0.015}
        smoothness={3}
      >
        <meshStandardMaterial
          color="#526f7f"
          emissive="#624019"
          emissiveIntensity={
            dayMode ? 0.025 : style === "mixed" ? 0.32 : 0.16
          }
          roughness={0.18}
          metalness={0.3}
        />
      </RoundedBox>
      <InstancedBoxes
        items={storeMullions}
        material={getSteelMaterial("#929da3", 0.3)}
      />

      <RoundedBox
        position={[0.08 * width, 1.3, frontZ + 0.18]}
        args={[width * 0.76, 0.18, 0.48]}
        radius={0.025}
        smoothness={3}
      >
        <meshStandardMaterial color={accentColor} roughness={0.48} />
      </RoundedBox>

      {signLabel && (
        <BuildingSign
          label={signLabel}
          position={[0.08 * width, 1.31, frontZ + 0.425]}
          width={Math.min(width * 0.62, 2.7)}
          color={accentColor}
        />
      )}

      {/* Crisp flat roof, parapet and compact rooftop service room. */}
      <BoxMember
        position={[0, height + 0.14, 0]}
        size={[width + 0.16, 0.28, depth + 0.16]}
        color="#3d4448"
      />
      <RoundedBox
        position={[-width * 0.22, height + 0.55, -depth * 0.12]}
        args={[width * 0.34, 0.82, depth * 0.42]}
        radius={0.035}
        smoothness={3}
      >
        <meshStandardMaterial color="#69747a" roughness={0.65} />
      </RoundedBox>
      <mesh
        position={[width * 0.26, height + 0.58, -depth * 0.12]}
        castShadow={false}
      >
        <cylinderGeometry args={[0.34, 0.34, 0.82, 24]} />
        <meshStandardMaterial color="#2f3f49" roughness={0.46} />
      </mesh>
    </group>
  );
}

const DISTANT_BUILDING_LIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#858f93",
  roughness: 0.74,
  metalness: 0.03,
});

const DISTANT_BUILDING_WARM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#8f8175",
  roughness: 0.76,
  metalness: 0.02,
});

const DISTANT_BUILDING_ROOF_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#3a4247",
  roughness: 0.68,
  metalness: 0.12,
});

const DISTANT_WINDOW_DAY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#31566c",
  roughness: 0.2,
  metalness: 0.32,
});

const DISTANT_WINDOW_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#e7bd77",
  emissive: "#8d501a",
  emissiveIntensity: 0.82,
  roughness: 0.3,
  metalness: 0.08,
});

const DISTANT_WINDOW_DARK_NIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#1f3948",
  emissive: "#102430",
  emissiveIntensity: 0.08,
  roughness: 0.2,
  metalness: 0.34,
});

const DISTANT_FACADE_BAND_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#515a60",
  roughness: 0.7,
  metalness: 0.05,
});

const DISTANT_PODIUM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#30383d",
  roughness: 0.62,
  metalness: 0.12,
});

/* Extends the street walls to the vanishing point. All distant buildings,
   occupied/unoccupied windows and facade layers remain GPU-instanced. */
function DistantStreetBuildings({ dayMode }: { dayMode: boolean }) {
  const {
    lightBodies,
    warmBodies,
    roofs,
    darkWindows,
    litWindows,
    facadeBands,
    podiums,
  } = useMemo(() => {
    const lightBuildingItems: BoxInstance[] = [];
    const warmBuildingItems: BoxInstance[] = [];
    const roofItems: BoxInstance[] = [];
    const darkWindowItems: BoxInstance[] = [];
    const litWindowItems: BoxInstance[] = [];
    const facadeBandItems: BoxInstance[] = [];
    const podiumItems: BoxInstance[] = [];
    const zPositions = Array.from(
      { length: 20 },
      (_, index) => -4 - index * 5.8,
    );

    [-1, 1].forEach((side) => {
      zPositions.forEach((z, index) => {
        const variation = seededRandom(index * 37 + (side > 0 ? 113 : 29));
        const height = 6.6 + variation * 3.9;
        const buildingX = side * (8.82 + (index % 3) * 0.08);
        const body: BoxInstance = {
          position: [buildingX, height / 2 - 0.18, z],
          size: [3.2, height, 5.32],
        };

        ((index + (side > 0 ? 1 : 0)) % 2 === 0
          ? lightBuildingItems
          : warmBuildingItems
        ).push(body);

        podiumItems.push({
          position: [buildingX, 0.34, z],
          size: [3.28, 0.68, 5.38],
        });

        roofItems.push(
          {
            position: [buildingX, height - 0.07, z],
            size: [3.36, 0.2, 5.46],
          },
          {
            position: [
              buildingX + side * 0.42,
              height + 0.28,
              z - 0.45,
            ],
            size: [1.18, 0.52, 1.58],
          },
        );

        const facadeX = side * (Math.abs(buildingX) - 1.625);
        for (let y = 1.15; y < height - 0.68; y += 1.08) {
          facadeBandItems.push({
            position: [facadeX, y - 0.5, z],
            size: [0.07, 0.04, 5.02],
          });

          [-1.72, -0.58, 0.58, 1.72].forEach((zOffset) => {
            const windowItem: BoxInstance = {
              position: [facadeX, y, z + zOffset],
              size: [0.065, 0.48, 0.66],
            };
            const lit =
              seededRandom(index * 97 + y * 13 + zOffset + side * 19) >
              0.64;
            (lit ? litWindowItems : darkWindowItems).push(windowItem);
          });
        }
      });
    });

    return {
      lightBodies: lightBuildingItems,
      warmBodies: warmBuildingItems,
      roofs: roofItems,
      darkWindows: darkWindowItems,
      litWindows: litWindowItems,
      facadeBands: facadeBandItems,
      podiums: podiumItems,
    };
  }, []);

  return (
    <group name="DistantStreetBuildings">
      <InstancedBoxes
        items={lightBodies}
        material={DISTANT_BUILDING_LIGHT_MATERIAL}
        receiveShadow
      />
      <InstancedBoxes
        items={warmBodies}
        material={DISTANT_BUILDING_WARM_MATERIAL}
        receiveShadow
      />
      <InstancedBoxes items={roofs} material={DISTANT_BUILDING_ROOF_MATERIAL} />
      <InstancedBoxes
        items={podiums}
        material={DISTANT_PODIUM_MATERIAL}
      />
      <InstancedBoxes
        items={facadeBands}
        material={DISTANT_FACADE_BAND_MATERIAL}
      />
      <InstancedBoxes
        items={darkWindows}
        material={
          dayMode
            ? DISTANT_WINDOW_DAY_MATERIAL
            : DISTANT_WINDOW_DARK_NIGHT_MATERIAL
        }
      />
      <InstancedBoxes
        items={litWindows}
        material={
          dayMode
            ? DISTANT_WINDOW_DAY_MATERIAL
            : DISTANT_WINDOW_NIGHT_MATERIAL
        }
      />
    </group>
  );
}

const SKY_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const NIGHT_SKY_FRAGMENT_SHADER = `
  varying vec2 vUv;
  void main() {
    vec3 horizon = vec3(0.035, 0.085, 0.135);
    vec3 zenith = vec3(0.004, 0.012, 0.022);
    float gradient = smoothstep(0.12, 0.86, vUv.y);
    vec3 color = mix(horizon, zenith, gradient);
    float cloudA = sin(vUv.x * 25.0 + vUv.y * 7.0) * 0.5 + 0.5;
    float cloudB = sin(vUv.x * 47.0 - vUv.y * 13.0) * 0.5 + 0.5;
    float cloud = smoothstep(0.7, 1.25, cloudA + cloudB) * 0.022;
    gl_FragColor = vec4(color + cloud, 1.0);
  }
`;

const DAY_SKY_FRAGMENT_SHADER = `
  varying vec2 vUv;
  void main() {
    vec3 horizon = vec3(0.64, 0.82, 0.91);
    vec3 zenith = vec3(0.12, 0.48, 0.72);
    float gradient = smoothstep(0.08, 0.92, vUv.y);
    vec3 color = mix(horizon, zenith, gradient);

    float cloudA = sin(vUv.x * 27.0 + vUv.y * 8.0) * 0.5 + 0.5;
    float cloudB = sin(vUv.x * 51.0 - vUv.y * 15.0) * 0.5 + 0.5;
    float cloudC = sin(vUv.x * 83.0 + vUv.y * 21.0) * 0.5 + 0.5;
    float cloud = smoothstep(1.72, 2.22, cloudA + cloudB + cloudC);
    cloud *= smoothstep(0.1, 0.48, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
    color = mix(color, vec3(0.96, 0.98, 1.0), cloud * 0.58);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function AtmosphereBackdrop({ dayMode }: { dayMode: boolean }) {
  return (
    <mesh scale={180} frustumCulled={false}>
      <sphereGeometry args={[1, 24, 12]} />
      <shaderMaterial
        key={dayMode ? "day-sky" : "night-sky"}
        vertexShader={SKY_VERTEX_SHADER}
        fragmentShader={
          dayMode ? DAY_SKY_FRAGMENT_SHADER : NIGHT_SKY_FRAGMENT_SHADER
        }
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

const STREET_LIGHT_GLOW_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#f7f5e9",
  emissive: "#e9f0dc",
  emissiveIntensity: 4.5 * STREET_NIGHT_LIGHT_RATIO,
  roughness: 0.18,
  toneMapped: false,
});

const STREET_LIGHT_DAY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#e8e2d4",
  emissive: "#fff4d6",
  emissiveIntensity: 0.08,
  roughness: 0.28,
});

function StreetLighting({ dayMode }: { dayMode: boolean }) {
  const { bases, poles, arms, housings, lamps, halos, serviceDoors } = useMemo(() => {
    const baseItems: BoxInstance[] = [];
    const poleItems: BoxInstance[] = [];
    const armItems: BoxInstance[] = [];
    const housingItems: BoxInstance[] = [];
    const lampItems: BoxInstance[] = [];
    const haloItems: BoxInstance[] = [];
    const serviceDoorItems: BoxInstance[] = [];
    const zPositions = Array.from({ length: 18 }, (_, index) => 24 - index * 8);

    [-7.2, 7.2].forEach((x) => {
      const side = x < 0 ? -1 : 1;
      zPositions.forEach((z) => {
        baseItems.push({
          position: [x, -0.16, z],
          size: [0.28, 0.24, 0.28],
        });
        poleItems.push({
          position: [x, 2.02, z],
          size: [0.075, 4.48, 0.075],
        });
        armItems.push({
          position: [x - side * 0.34, 4.16, z],
          size: [0.065, 0.92, 0.065],
          rotation: [0, 0, side * 0.72],
        });
        housingItems.push({
          position: [x - side * 0.67, 4.51, z],
          size: [0.44, 0.13, 0.3],
        });
        lampItems.push({
          position: [x - side * 0.67, 4.44, z + 0.015],
          size: [0.34, 0.035, 0.22],
        });
        haloItems.push({
          position: [x - side * 0.67, 4.42, z + 0.075],
          size: [
            0.92 * STREET_NIGHT_LIGHT_RATIO,
            0.5 * STREET_NIGHT_LIGHT_RATIO,
            1,
          ],
        });
        serviceDoorItems.push({
          position: [x - side * 0.044, 0.48, z],
          size: [0.018, 0.38, 0.14],
        });
      });
    });

    return {
      bases: baseItems,
      poles: poleItems,
      arms: armItems,
      housings: housingItems,
      lamps: lampItems,
      halos: haloItems,
      serviceDoors: serviceDoorItems,
    };
  }, []);

  return (
    <group name="StreetLighting">
      <InstancedBoxes
        items={bases}
        material={getStandardMaterial("#777e82", 0.58, 0.42)}
        receiveShadow
      />
      <InstancedBoxes
        items={poles}
        material={getSteelMaterial("#596168", 0.42)}
      />
      <InstancedBoxes
        items={arms}
        material={getSteelMaterial("#626a70", 0.4)}
      />
      <InstancedBoxes
        items={housings}
        material={getStandardMaterial("#242a2e", 0.38, 0.46)}
      />
      <InstancedBoxes
        items={lamps}
        material={
          dayMode ? STREET_LIGHT_DAY_MATERIAL : STREET_LIGHT_GLOW_MATERIAL
        }
      />
      {!dayMode && (
        <InstancedGeometry
          items={halos}
          geometry={LIGHT_HALO_GEOMETRY}
          material={STREET_LIGHT_HALO_MATERIAL}
        />
      )}
      <InstancedBoxes
        items={serviceDoors}
        material={getStandardMaterial("#30373b", 0.5, 0.44)}
      />

      {!dayMode && [
        [-6.53, 4.34, 16],
        [6.53, 4.34, 16],
        [-6.53, 4.34, -8],
        [6.53, 4.34, -8],
        [-6.53, 4.34, -32],
        [6.53, 4.34, -32],
      ].map((position, index) => (
        <pointLight
          key={index}
          position={position as Vec3}
          intensity={
            STREET_LIGHT_BASE_INTENSITY * STREET_NIGHT_LIGHT_RATIO
          }
          distance={18}
          decay={2}
          color="#ffe8b8"
        />
      ))}
    </group>
  );
}

type ColoredPlantInstance = {
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
  color: string;
};

const MEDIAN_LEAF_GEOMETRY = new THREE.BufferGeometry();
MEDIAN_LEAF_GEOMETRY.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [
      0, 0, 0,
      -0.085, 0.1, 0.012,
      -0.055, 0.23, 0.02,
      0, 0.36, 0,
      0.055, 0.23, -0.02,
      0.085, 0.1, -0.012,
    ],
    3,
  ),
);
MEDIAN_LEAF_GEOMETRY.setIndex([
  0, 1, 2,
  0, 2, 3,
  0, 3, 4,
  0, 4, 5,
]);
MEDIAN_LEAF_GEOMETRY.computeVertexNormals();

const MEDIAN_FLOWER_GEOMETRY = new THREE.IcosahedronGeometry(1, 0);
const MEDIAN_STEM_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 6);
const SMALL_PLANT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.78,
  side: THREE.DoubleSide,
});
const MEDIAN_STEM_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#2f6b35",
  roughness: 0.82,
});

function ColoredPlantInstances({
  items,
  geometry,
  castShadow = false,
}: {
  items: ColoredPlantInstance[];
  geometry: THREE.BufferGeometry;
  castShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const helper = new THREE.Object3D();
    const color = new THREE.Color();

    items.forEach((item, index) => {
      helper.position.set(...item.position);
      helper.scale.set(...item.scale);
      helper.rotation.set(...item.rotation);
      helper.updateMatrix();
      mesh.setMatrixAt(index, helper.matrix);
      color.set(item.color);
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, SMALL_PLANT_MATERIAL, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

function MedianPlants() {
  const { stems, leaves, flowers } = useMemo(() => {
    const stemItems: BoxInstance[] = [];
    const leafItems: ColoredPlantInstance[] = [];
    const flowerItems: ColoredPlantInstance[] = [];
    const flowerColors = ["#c8244f", "#e6426e", "#ec7c95", "#bc386f"];

    Array.from({ length: 64 }, (_, index) => 20 - index * 1.52)
      .filter((z) => Math.abs(z + 3) > 2.8)
      .forEach((z, index) => {
        [-0.34, 0.34].forEach((x, sideIndex) => {
          const offset = seededRandom(index * 11 + sideIndex * 7);
          const plantZ = z + (offset - 0.5) * 0.34;
          const stemHeight = 0.27 + offset * 0.11;

          stemItems.push({
            position: [x, 0.01 + stemHeight / 2, plantZ],
            size: [0.018, stemHeight, 0.018],
          });

          Array.from({ length: 5 }, (_, leafIndex) => {
            const angle =
              (leafIndex / 5) * Math.PI * 2 + offset * Math.PI;
            const heightOffset = 0.025 + (leafIndex % 2) * 0.055;
            const leafScale = 0.72 + seededRandom(index * 31 + leafIndex) * 0.25;

            leafItems.push({
              position: [
                x + Math.cos(angle) * 0.035,
                heightOffset,
                plantZ + Math.sin(angle) * 0.035,
              ],
              scale: [leafScale, leafScale, leafScale],
              rotation: [
                Math.sin(angle) * 0.72,
                angle,
                -Math.cos(angle) * 0.72,
              ],
              color:
                (leafIndex + sideIndex) % 3 === 0
                  ? "#2f733a"
                  : (leafIndex + index) % 2 === 0
                    ? "#245f32"
                    : "#3b8142",
            });
          });

          if ((index + sideIndex) % 3 !== 1) {
            flowerItems.push({
              position: [
                x + (offset - 0.5) * 0.06,
                stemHeight + 0.03,
                plantZ,
              ],
              scale: [0.055, 0.042, 0.055],
              rotation: [offset, offset * Math.PI, 0],
              color: flowerColors[(index + sideIndex) % flowerColors.length],
            });
          }
        });
      });

    return { stems: stemItems, leaves: leafItems, flowers: flowerItems };
  }, []);

  return (
    <group name="NaturalMedianPlanting">
      <InstancedGeometry
        items={stems}
        geometry={MEDIAN_STEM_GEOMETRY}
        material={MEDIAN_STEM_MATERIAL}
      />
      <ColoredPlantInstances
        items={leaves}
        geometry={MEDIAN_LEAF_GEOMETRY}
      />
      <ColoredPlantInstances
        items={flowers}
        geometry={MEDIAN_FLOWER_GEOMETRY}
      />
    </group>
  );
}

type VehicleKind = "hatchback" | "sedan" | "suv" | "van";

type TrafficVehicle = {
  x: number;
  z: number;
  speed: number;
  direction: 1 | -1;
  scale: number;
  color: string;
  kind: VehicleKind;
};

/* Vehicles recycle only after leaving the complete visible road. The camera
   sits near z=30, so +38 is behind it; -126 is beyond the road and fog. */
const TRAFFIC_MIN_Z = -126;
const TRAFFIC_MAX_Z = 38;
const TRAFFIC_SPAN = TRAFFIC_MAX_Z - TRAFFIC_MIN_Z;

const TRAFFIC_VEHICLES: TrafficVehicle[] = [
  { x: -1.82, z: -116, speed: 5.6, direction: 1, scale: 0.82, color: "#384650", kind: "sedan" },
  { x: -3.72, z: -91, speed: 4.9, direction: 1, scale: 0.86, color: "#92989b", kind: "hatchback" },
  { x: -5.52, z: -68, speed: 4.4, direction: 1, scale: 0.92, color: "#27343d", kind: "suv" },
  { x: -1.82, z: -45, speed: 5.3, direction: 1, scale: 0.9, color: "#b4b5b3", kind: "hatchback" },
  { x: -3.72, z: -22, speed: 4.7, direction: 1, scale: 0.88, color: "#5e686e", kind: "sedan" },
  { x: -5.52, z: 2, speed: 4.25, direction: 1, scale: 0.94, color: "#293037", kind: "van" },
  { x: -3.72, z: 25, speed: 4.8, direction: 1, scale: 0.84, color: "#7a858a", kind: "hatchback" },
  { x: 1.82, z: 30, speed: 5.7, direction: -1, scale: 0.86, color: "#4d5961", kind: "sedan" },
  { x: 3.72, z: 10, speed: 4.9, direction: -1, scale: 0.9, color: "#1f2b35", kind: "suv" },
  { x: 5.52, z: -12, speed: 4.45, direction: -1, scale: 0.86, color: "#81898c", kind: "hatchback" },
  { x: 1.82, z: -36, speed: 5.45, direction: -1, scale: 0.92, color: "#a4a6a5", kind: "sedan" },
  { x: 3.72, z: -61, speed: 4.85, direction: -1, scale: 0.84, color: "#58656c", kind: "van" },
  { x: 5.52, z: -86, speed: 4.35, direction: -1, scale: 0.94, color: "#303a40", kind: "suv" },
  { x: 3.72, z: -111, speed: 4.7, direction: -1, scale: 0.8, color: "#747e82", kind: "hatchback" },
];

const VEHICLE_PROFILES: Record<
  VehicleKind,
  {
    width: number;
    bodyHeight: number;
    length: number;
    cabinWidth: number;
    cabinHeight: number;
    cabinLength: number;
    cabinOffset: number;
    wheelRadius: number;
  }
> = {
  hatchback: {
    width: 0.7,
    bodyHeight: 0.28,
    length: 1.28,
    cabinWidth: 0.56,
    cabinHeight: 0.3,
    cabinLength: 0.72,
    cabinOffset: -0.08,
    wheelRadius: 0.12,
  },
  sedan: {
    width: 0.72,
    bodyHeight: 0.27,
    length: 1.52,
    cabinWidth: 0.55,
    cabinHeight: 0.29,
    cabinLength: 0.72,
    cabinOffset: -0.02,
    wheelRadius: 0.12,
  },
  suv: {
    width: 0.78,
    bodyHeight: 0.34,
    length: 1.5,
    cabinWidth: 0.62,
    cabinHeight: 0.38,
    cabinLength: 0.84,
    cabinOffset: -0.04,
    wheelRadius: 0.135,
  },
  van: {
    width: 0.78,
    bodyHeight: 0.34,
    length: 1.7,
    cabinWidth: 0.64,
    cabinHeight: 0.46,
    cabinLength: 1.12,
    cabinOffset: -0.12,
    wheelRadius: 0.135,
  },
};

function createVehicleBodyGeometry() {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 2, 6);
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const longitudinal = Math.min(1, Math.abs(z) * 2);
    const taper = 1 - longitudinal * longitudinal * 0.09;
    const shoulder = y > 0.2 ? 0.95 : 1;
    positions.setXYZ(index, x * taper * shoulder, y, z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function createVehicleCabinGeometry() {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 2, 4);
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const height = THREE.MathUtils.clamp(y + 0.5, 0, 1);
    positions.setXYZ(
      index,
      x * (1 - height * 0.2),
      y,
      z * (1 - height * 0.15) - height * 0.035,
    );
  }

  geometry.computeVertexNormals();
  return geometry;
}

const TRAFFIC_BODY_GEOMETRY = createVehicleBodyGeometry();
const TRAFFIC_CABIN_GEOMETRY = createVehicleCabinGeometry();

const TRAFFIC_BODY_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.38,
  metalness: 0.5,
});
const TRAFFIC_GLASS_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#6e93a6",
  roughness: 0.18,
  metalness: 0.42,
});
const TRAFFIC_WHEEL_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#111416",
  roughness: 0.8,
});
const TRAFFIC_HEADLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#fff8db",
  emissive: "#ffe39a",
  emissiveIntensity: 4.8,
  toneMapped: false,
});
const TRAFFIC_TAILLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#ff3030",
  emissive: "#e8131b",
  emissiveIntensity: 4.5,
  toneMapped: false,
});
const TRAFFIC_WHEEL_GEOMETRY = new THREE.CylinderGeometry(1, 1, 1, 10);
const TRAFFIC_BUMPER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#2a3034",
  roughness: 0.52,
  metalness: 0.48,
});

function TrafficFlow({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh | null>(null);
  const cabinRef = useRef<THREE.InstancedMesh | null>(null);
  const bumperRef = useRef<THREE.InstancedMesh | null>(null);
  const wheelRef = useRef<THREE.InstancedMesh | null>(null);
  const headlightRef = useRef<THREE.InstancedMesh | null>(null);
  const taillightRef = useRef<THREE.InstancedMesh | null>(null);
  const elapsedRef = useRef(0);
  const helper = useMemo(() => new THREE.Object3D(), []);

  const updateInstances = useCallback(
    (elapsed: number) => {
      const body = bodyRef.current;
      const cabin = cabinRef.current;
      const bumpers = bumperRef.current;
      const wheels = wheelRef.current;
      const headlights = headlightRef.current;
      const taillights = taillightRef.current;
      if (!body || !cabin || !bumpers || !wheels || !headlights || !taillights) {
        return;
      }

      TRAFFIC_VEHICLES.forEach((vehicle, index) => {
        const rawZ = vehicle.z + vehicle.direction * elapsed * vehicle.speed;
        const z =
          TRAFFIC_MIN_Z +
          THREE.MathUtils.euclideanModulo(
            rawZ - TRAFFIC_MIN_Z,
            TRAFFIC_SPAN,
          );
        const yaw = vehicle.direction === 1 ? 0 : Math.PI;
        const scale = vehicle.scale;
        const profile = VEHICLE_PROFILES[vehicle.kind];
        const x = vehicle.x;

        helper.position.set(x, -0.055, z);
        helper.rotation.set(0, yaw, 0);
        helper.scale.set(
          profile.width * scale,
          profile.bodyHeight * scale,
          profile.length * scale,
        );
        helper.updateMatrix();
        body.setMatrixAt(index, helper.matrix);

        helper.position.set(
          x,
          -0.045 +
            (profile.bodyHeight + profile.cabinHeight) * scale * 0.45,
          z + vehicle.direction * profile.cabinOffset * scale,
        );
        helper.rotation.set(0, yaw, 0);
        helper.scale.set(
          profile.cabinWidth * scale,
          profile.cabinHeight * scale,
          profile.cabinLength * scale,
        );
        helper.updateMatrix();
        cabin.setMatrixAt(index, helper.matrix);

        [-1, 1].forEach((end, endIndex) => {
          const bumperIndex = index * 2 + endIndex;
          helper.position.set(
            x,
            -0.095,
            z + vehicle.direction * end * profile.length * scale * 0.51,
          );
          helper.rotation.set(0, yaw, 0);
          helper.scale.set(
            profile.width * scale * 0.92,
            0.075 * scale,
            0.055 * scale,
          );
          helper.updateMatrix();
          bumpers.setMatrixAt(bumperIndex, helper.matrix);
        });

        [-1, 1].forEach((side, sideIndex) => {
          const headIndex = index * 2 + sideIndex;
          helper.position.set(
            x + side * profile.width * scale * 0.3,
            -0.02,
            z + vehicle.direction * profile.length * scale * 0.515,
          );
          helper.rotation.set(0, yaw, 0);
          helper.scale.set(0.12 * scale, 0.065 * scale, 0.035 * scale);
          helper.updateMatrix();
          headlights.setMatrixAt(headIndex, helper.matrix);

          helper.position.set(
            x + side * profile.width * scale * 0.3,
            -0.02,
            z - vehicle.direction * profile.length * scale * 0.515,
          );
          helper.updateMatrix();
          taillights.setMatrixAt(headIndex, helper.matrix);
        });

        [-1, 1].forEach((side, sideIndex) => {
          [-0.31, 0.31].forEach((wheelOffset, wheelIndex) => {
            const wheelInstance = index * 4 + sideIndex * 2 + wheelIndex;
            helper.position.set(
              x + side * profile.width * scale * 0.49,
              -0.16,
              z +
                vehicle.direction *
                  wheelOffset *
                  profile.length *
                  scale,
            );
            helper.rotation.set(0, yaw, Math.PI / 2);
            helper.scale.set(
              profile.wheelRadius * scale,
              0.085 * scale,
              profile.wheelRadius * scale,
            );
            helper.updateMatrix();
            wheels.setMatrixAt(wheelInstance, helper.matrix);
          });
        });
      });

      [body, cabin, bumpers, wheels, headlights, taillights].forEach((mesh) => {
        mesh.instanceMatrix.needsUpdate = true;
      });
    },
    [helper],
  );

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const color = new THREE.Color();
    TRAFFIC_VEHICLES.forEach((vehicle, index) => {
      color.set(vehicle.color);
      body.setColorAt(index, color);
    });
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
    updateInstances(0);
  }, [updateInstances]);

  useFrame((_, delta) => {
    if (reducedMotion) {
      updateInstances(elapsedRef.current);
      return;
    }
    elapsedRef.current += Math.min(delta, 0.05);
    updateInstances(elapsedRef.current);
  });

  return (
    <group name="TrafficFlow">
      <instancedMesh
        ref={bodyRef}
        args={[TRAFFIC_BODY_GEOMETRY, TRAFFIC_BODY_MATERIAL, TRAFFIC_VEHICLES.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={cabinRef}
        args={[TRAFFIC_CABIN_GEOMETRY, TRAFFIC_GLASS_MATERIAL, TRAFFIC_VEHICLES.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={bumperRef}
        args={[
          UNIT_BOX_GEOMETRY,
          TRAFFIC_BUMPER_MATERIAL,
          TRAFFIC_VEHICLES.length * 2,
        ]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={wheelRef}
        args={[
          TRAFFIC_WHEEL_GEOMETRY,
          TRAFFIC_WHEEL_MATERIAL,
          TRAFFIC_VEHICLES.length * 4,
        ]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={headlightRef}
        args={[
          UNIT_BOX_GEOMETRY,
          TRAFFIC_HEADLIGHT_MATERIAL,
          TRAFFIC_VEHICLES.length * 2,
        ]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={taillightRef}
        args={[
          UNIT_BOX_GEOMETRY,
          TRAFFIC_TAILLIGHT_MATERIAL,
          TRAFFIC_VEHICLES.length * 2,
        ]}
        frustumCulled={false}
      />
    </group>
  );
}

type BikeVehicle = {
  x: number;
  z: number;
  speed: number;
  direction: 1 | -1;
  scale: number;
};

const BIKE_VEHICLES: BikeVehicle[] = [
  { x: -1.86, z: -102, speed: 6.1, direction: 1, scale: 0.92 },
  { x: -5.45, z: -33, speed: 5.45, direction: 1, scale: 0.88 },
  { x: 1.86, z: 22, speed: 6.25, direction: -1, scale: 0.94 },
  { x: 5.48, z: -58, speed: 5.35, direction: -1, scale: 0.84 },
];

const BIKE_FRAME_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#20262a",
  roughness: 0.42,
  metalness: 0.55,
});
const BIKE_RIDER_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#253a54",
  roughness: 0.68,
});
const BIKE_HELMET_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#15191c",
  roughness: 0.32,
  metalness: 0.42,
});
const BIKE_HEAD_GEOMETRY = new THREE.SphereGeometry(1, 12, 8);

function BikeTraffic({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const frameRef = useRef<THREE.InstancedMesh | null>(null);
  const riderRef = useRef<THREE.InstancedMesh | null>(null);
  const helmetRef = useRef<THREE.InstancedMesh | null>(null);
  const wheelRef = useRef<THREE.InstancedMesh | null>(null);
  const headlightRef = useRef<THREE.InstancedMesh | null>(null);
  const taillightRef = useRef<THREE.InstancedMesh | null>(null);
  const elapsedRef = useRef(0);
  const helper = useMemo(() => new THREE.Object3D(), []);

  const updateInstances = useCallback(
    (elapsed: number) => {
      const frames = frameRef.current;
      const riders = riderRef.current;
      const helmets = helmetRef.current;
      const wheels = wheelRef.current;
      const headlights = headlightRef.current;
      const taillights = taillightRef.current;
      if (!frames || !riders || !helmets || !wheels || !headlights || !taillights) {
        return;
      }

      BIKE_VEHICLES.forEach((bike, index) => {
        const rawZ = bike.z + bike.direction * elapsed * bike.speed;
        const z =
          TRAFFIC_MIN_Z +
          THREE.MathUtils.euclideanModulo(
            rawZ - TRAFFIC_MIN_Z,
            TRAFFIC_SPAN,
          );
        const yaw = bike.direction === 1 ? 0 : Math.PI;
        const scale = bike.scale;
        const x = bike.x;

        helper.position.set(x, -0.04, z);
        helper.rotation.set(0, yaw, 0);
        helper.scale.set(0.2 * scale, 0.18 * scale, 0.58 * scale);
        helper.updateMatrix();
        frames.setMatrixAt(index, helper.matrix);

        helper.position.set(x, 0.3, z - bike.direction * 0.06);
        helper.scale.set(0.23 * scale, 0.44 * scale, 0.18 * scale);
        helper.updateMatrix();
        riders.setMatrixAt(index, helper.matrix);

        helper.position.set(x, 0.62, z - bike.direction * 0.04);
        helper.scale.set(0.16 * scale, 0.14 * scale, 0.16 * scale);
        helper.updateMatrix();
        helmets.setMatrixAt(index, helper.matrix);

        [-0.33, 0.33].forEach((wheelZ, wheelIndex) => {
          const instance = index * 2 + wheelIndex;
          helper.position.set(
            x,
            -0.17,
            z + bike.direction * wheelZ * scale,
          );
          helper.rotation.set(0, yaw, Math.PI / 2);
          helper.scale.set(0.13 * scale, 0.055 * scale, 0.13 * scale);
          helper.updateMatrix();
          wheels.setMatrixAt(instance, helper.matrix);
        });

        helper.position.set(
          x,
          -0.01,
          z + bike.direction * 0.34 * scale,
        );
        helper.rotation.set(0, yaw, 0);
        helper.scale.set(0.095 * scale, 0.08 * scale, 0.035 * scale);
        helper.updateMatrix();
        headlights.setMatrixAt(index, helper.matrix);

        helper.position.set(
          x,
          -0.01,
          z - bike.direction * 0.34 * scale,
        );
        helper.updateMatrix();
        taillights.setMatrixAt(index, helper.matrix);
      });

      [frames, riders, helmets, wheels, headlights, taillights].forEach(
        (mesh) => {
          mesh.instanceMatrix.needsUpdate = true;
        },
      );
    },
    [helper],
  );

  useLayoutEffect(() => {
    updateInstances(0);
  }, [updateInstances]);

  useFrame((_, delta) => {
    if (reducedMotion) {
      updateInstances(elapsedRef.current);
      return;
    }
    elapsedRef.current += Math.min(delta, 0.05);
    updateInstances(elapsedRef.current);
  });

  return (
    <group name="BikeTraffic">
      <instancedMesh
        ref={frameRef}
        args={[UNIT_BOX_GEOMETRY, BIKE_FRAME_MATERIAL, BIKE_VEHICLES.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={riderRef}
        args={[UNIT_BOX_GEOMETRY, BIKE_RIDER_MATERIAL, BIKE_VEHICLES.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={helmetRef}
        args={[BIKE_HEAD_GEOMETRY, BIKE_HELMET_MATERIAL, BIKE_VEHICLES.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={wheelRef}
        args={[
          TRAFFIC_WHEEL_GEOMETRY,
          TRAFFIC_WHEEL_MATERIAL,
          BIKE_VEHICLES.length * 2,
        ]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={headlightRef}
        args={[
          UNIT_BOX_GEOMETRY,
          TRAFFIC_HEADLIGHT_MATERIAL,
          BIKE_VEHICLES.length,
        ]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={taillightRef}
        args={[
          UNIT_BOX_GEOMETRY,
          TRAFFIC_TAILLIGHT_MATERIAL,
          BIKE_VEHICLES.length,
        ]}
        frustumCulled={false}
      />
    </group>
  );
}

function RoadCurbs() {
  const { lightBlocks, darkBlocks } = useMemo(() => {
    const light: BoxInstance[] = [];
    const dark: BoxInstance[] = [];
    const zPositions = Array.from(
      { length: 96 },
      (_, index) => 32 - index * 1.65,
    );

    [-6.72, 6.72, -0.82, 0.82].forEach((x, edgeIndex) => {
      zPositions.forEach((z, index) => {
        const item: BoxInstance = {
          position: [x, -0.19, z],
          size: [Math.abs(x) < 1 ? 0.18 : 0.26, 0.18, 1.48],
        };
        ((index + edgeIndex) % 2 === 0 ? light : dark).push(item);
      });
    });

    return { lightBlocks: light, darkBlocks: dark };
  }, []);

  return (
    <group name="BlackWhiteCurbs">
      <InstancedBoxes
        items={lightBlocks}
        material={getStandardMaterial("#dddcd6", 0.72, 0.02)}
        receiveShadow
      />
      <InstancedBoxes
        items={darkBlocks}
        material={getStandardMaterial("#171b1e", 0.78, 0.02)}
        receiveShadow
      />
    </group>
  );
}

const ROAD_LANE_DAY_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#eee9dc",
  transparent: true,
  opacity: 0.74,
});

const ROAD_LANE_NIGHT_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#c5c4bd",
  transparent: true,
  opacity: 0.42,
});

const SIDEWALK_ITEMS: BoxInstance[] = [
  { position: [-7.82, -0.215, -48], size: [1.92, 0.12, 168] },
  { position: [7.82, -0.215, -48], size: [1.92, 0.12, 168] },
];

const SIDEWALK_JOINT_ITEMS: BoxInstance[] = Array.from(
  { length: 40 },
  (_, index) => 28 - index * 4,
).flatMap((z) => [
  { position: [-7.82, -0.148, z], size: [1.84, 0.012, 0.035] },
  { position: [7.82, -0.148, z], size: [1.84, 0.012, 0.035] },
]);

function RoadLaneMarkings({ dayMode }: { dayMode: boolean }) {
  const markings = useMemo(() => {
    const items: BoxInstance[] = [];
    [-4.65, -2.75, 2.75, 4.65].forEach((x) => {
      Array.from({ length: 31 }, (_, index) => 32 - index * 5.2).forEach(
        (z) => {
          items.push({
            position: [x, -0.245, z],
            size: [0.1, 0.018, 2.35],
          });
        },
      );
    });
    return items;
  }, []);

  return (
    <InstancedBoxes
      items={markings}
      material={dayMode ? ROAD_LANE_DAY_MATERIAL : ROAD_LANE_NIGHT_MATERIAL}
    />
  );
}

function RoadEnvironment({
  reducedMotion,
  dayMode,
}: {
  reducedMotion: boolean;
  dayMode: boolean;
}) {
  const concreteTexture = useConcreteSurfaceTexture();
  const buildings: ModernBuildingProps[] = [
    {
      position: [-9.25, -0.18, 20],
      rotationY: Math.PI / 2 - 0.035,
      width: 4.35,
      height: 7.8,
      depth: 3.35,
      wallColor: "#8f6f60",
      accentColor: "#b24b3c",
      glassColor: "#365f76",
      seed: 1,
      style: "mixed",
      signLabel: "PHARMACY",
    },
    {
      position: [-9.2, -0.18, 14],
      rotationY: Math.PI / 2 + 0.025,
      width: 4.1,
      height: 9.2,
      depth: 3.15,
      wallColor: "#a8a08f",
      accentColor: "#424c54",
      glassColor: "#557789",
      seed: 2,
      style: "apartment",
      signLabel: "RESIDENCES",
    },
    {
      position: [-9.35, -0.18, 8],
      rotationY: Math.PI / 2 - 0.02,
      width: 4.45,
      height: 7.4,
      depth: 3.4,
      wallColor: "#7f898f",
      accentColor: "#a7483f",
      glassColor: "#3f6071",
      seed: 3,
      style: "office",
      signLabel: "OFFICES",
    },
    {
      position: [-9.2, -0.18, 2],
      rotationY: Math.PI / 2 + 0.02,
      width: 4.05,
      height: 8.25,
      depth: 3,
      wallColor: "#a3aaad",
      accentColor: "#5a646a",
      glassColor: "#4f7284",
      seed: 4,
      style: "mixed",
      signLabel: "CAFE",
    },
    {
      position: [9.25, -0.18, 19.8],
      rotationY: -Math.PI / 2 + 0.035,
      width: 4.35,
      height: 8.1,
      depth: 3.35,
      wallColor: "#967765",
      accentColor: "#a43d36",
      glassColor: "#496b7d",
      seed: 5,
      style: "mixed",
      signLabel: "MEDICALS",
    },
    {
      position: [9.2, -0.18, 13.8],
      rotationY: -Math.PI / 2 - 0.025,
      width: 4.1,
      height: 9.5,
      depth: 3.2,
      wallColor: "#aaa18d",
      accentColor: "#454f56",
      glassColor: "#55788a",
      seed: 6,
      style: "apartment",
      signLabel: "APARTMENTS",
    },
    {
      position: [9.35, -0.18, 7.8],
      rotationY: -Math.PI / 2 + 0.02,
      width: 4.45,
      height: 7.4,
      depth: 3.45,
      wallColor: "#818b90",
      accentColor: "#a84a41",
      glassColor: "#426273",
      seed: 7,
      style: "office",
      signLabel: "BUSINESS CENTRE",
    },
    {
      position: [9.2, -0.18, 1.8],
      rotationY: -Math.PI / 2 - 0.02,
      width: 4.05,
      height: 8.2,
      depth: 3.05,
      wallColor: "#a5abad",
      accentColor: "#5d666b",
      glassColor: "#507385",
      seed: 8,
      style: "mixed",
      signLabel: "HOTEL",
    },
  ];

  /* Trees frame the urban street without hiding the modern facades. */
  const trees = [
    { position: [-7.62, -0.18, 14.2] as Vec3, seed: 1 },
    { position: [-7.68, -0.18, 5.2] as Vec3, seed: 3 },
    { position: [7.62, -0.18, 13.9] as Vec3, seed: 5 },
    { position: [7.68, -0.18, 4.9] as Vec3, seed: 7 },
  ];

  return (
    <group>
      <mesh
        position={[0, -0.3, -48]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[38, 168]} />
        <meshStandardMaterial
          color={dayMode ? "#788275" : "#15191c"}
          roughness={0.92}
          metalness={dayMode ? 0.01 : 0.06}
        />
      </mesh>

      <mesh
        position={[0, -0.275, -48]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[13.2, 168]} />
        <meshStandardMaterial
          color={dayMode ? "#3d4448" : "#1b2228"}
          roughness={dayMode ? 0.82 : 0.62}
          metalness={dayMode ? 0.03 : 0.12}
        />
      </mesh>

      <InstancedBoxes
        items={SIDEWALK_ITEMS}
        material={getStandardMaterial(
          dayMode ? "#a6aaa7" : "#4b5154",
          0.82,
          0.02,
        )}
        receiveShadow
      />
      <InstancedBoxes
        items={SIDEWALK_JOINT_ITEMS}
        material={getStandardMaterial(
          dayMode ? "#707573" : "#292f32",
          0.88,
          0.01,
        )}
      />

      {/* Raised central median keeps the UNIPOLE correctly centred. */}
      <RoundedBox
        position={[0, -0.2, -46]}
        args={[1.5, 0.16, 158]}
        radius={0.055}
        smoothness={3}
        receiveShadow
      >
        <meshStandardMaterial
          color={dayMode ? "#66715e" : "#30363a"}
          roughness={0.86}
        />
      </RoundedBox>

      <RoadCurbs />

      <MedianPlants />

      <RoadLaneMarkings dayMode={dayMode} />

      <DistantStreetBuildings dayMode={dayMode} />

      {buildings.map((building) => (
        <ModernBuilding
          key={`${building.position[0]}-${building.position[2]}`}
          {...building}
          dayMode={dayMode}
          concreteTexture={concreteTexture}
        />
      ))}

      {trees.map((tree) => (
        <Tree
          key={tree.seed}
          position={tree.position}
          seed={tree.seed}
        />
      ))}

      <StreetLighting dayMode={dayMode} />
      <TrafficFlow reducedMotion={reducedMotion} />
      <BikeTraffic reducedMotion={reducedMotion} />
    </group>
  );
}

type SceneProps = ModelProps & {
  cameraResetKey: number;
};

function InstallationCameraControls({
  resetKey,
}: {
  resetKey: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<{
    target: THREE.Vector3;
    update: () => void;
  } | null>(null);
  const correction = useMemo(() => new THREE.Vector3(), []);

  /* Reset restores the exact approved one-point starting view. Interaction
     remains available throughout every installation stage. */
  useEffect(() => {
    camera.position.set(...INITIAL_CAMERA_POSITION);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = INITIAL_CAMERA_FOV;
      camera.updateProjectionMatrix();
    }

    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...INITIAL_CAMERA_TARGET);
      controls.update();
    } else {
      camera.lookAt(new THREE.Vector3(...INITIAL_CAMERA_TARGET));
    }
  }, [camera, resetKey]);

  const constrainPan = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const target = controls.target;
    const clampedX = THREE.MathUtils.clamp(
      target.x,
      INITIAL_CAMERA_TARGET[0] - CAMERA_HORIZONTAL_PAN_LIMIT,
      INITIAL_CAMERA_TARGET[0] + CAMERA_HORIZONTAL_PAN_LIMIT,
    );
    const clampedY = THREE.MathUtils.clamp(
      target.y,
      INITIAL_CAMERA_TARGET[1] - CAMERA_VERTICAL_PAN_LIMIT,
      INITIAL_CAMERA_TARGET[1] + CAMERA_VERTICAL_PAN_LIMIT,
    );
    const clampedZ = THREE.MathUtils.clamp(
      target.z,
      INITIAL_CAMERA_TARGET[2] - CAMERA_DEPTH_PAN_LIMIT,
      INITIAL_CAMERA_TARGET[2] + CAMERA_DEPTH_PAN_LIMIT,
    );

    correction.set(
      clampedX - target.x,
      clampedY - target.y,
      clampedZ - target.z,
    );

    let corrected = false;
    if (correction.lengthSq() >= 0.000001) {
      target.add(correction);
      camera.position.add(correction);
      corrected = true;
    }

    /* Even after combining maximum downward pan and tilt, the camera may
       never cross the road plane. This prevents the upside-down view shown
       in the supplied screenshot without reducing the useful upward range. */
    const floorLift = Math.max(
      0,
      CAMERA_MIN_WORLD_HEIGHT - camera.position.y,
    );
    if (floorLift > 0.000001) {
      camera.position.y += floorLift;
      target.y += floorLift;
      corrected = true;
    }

    if (corrected) controls.update();
  }, [camera, correction]);

  return (
    <OrbitControls
      ref={(controls) => {
        controlsRef.current = controls;
      }}
      makeDefault
      target={INITIAL_CAMERA_TARGET}
      enablePan
      enableZoom={false}
      enableRotate
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={CAMERA_ROTATE_SPEED}
      panSpeed={CAMERA_PAN_SPEED}
      screenSpacePanning
      minPolarAngle={CAMERA_MIN_POLAR_ANGLE}
      maxPolarAngle={CAMERA_MAX_POLAR_ANGLE}
      minAzimuthAngle={CAMERA_MIN_AZIMUTH_ANGLE}
      maxAzimuthAngle={CAMERA_MAX_AZIMUTH_ANGLE}
      onChange={constrainPan}
    />
  );
}

function Scene({
  progressRef,
  reducedMotion,
  dayMode,
  cameraResetKey,
}: SceneProps) {
  return (
    <>
      <color
        attach="background"
        args={[dayMode ? "#79b8dc" : "#06101a"]}
      />
      <fog
        attach="fog"
        args={[
          dayMode ? "#b9d7e5" : "#07101a",
          dayMode ? 68 : 56,
          dayMode ? 158 : 138,
        ]}
      />

      <AtmosphereBackdrop dayMode={dayMode} />

      <ambientLight intensity={dayMode ? 1.28 : 0.46} />
      <hemisphereLight
        args={[
          dayMode ? "#e8f6ff" : "#eef5ff",
          dayMode ? "#806f55" : "#0b0e10",
          dayMode ? 2.15 : 0.72,
        ]}
      />

      <directionalLight
        position={dayMode ? [-10, 18, 12] : [8, 18, 12]}
        intensity={dayMode ? 4.7 : 1.35}
        color={dayMode ? "#fff1cf" : "#ffffff"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-radius={2}
        shadow-normalBias={0.025}
        shadow-camera-near={1}
        shadow-camera-far={42}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={20}
        shadow-camera-bottom={-6}
      />

      <directionalLight
        position={[-9, 12, 4]}
        intensity={dayMode ? 0.85 : 0.58}
        color={dayMode ? "#d8efff" : "#c5d5e8"}
      />

      <spotLight
        position={[0, 15, 9]}
        angle={0.42}
        penumbra={0.85}
        intensity={dayMode ? 1.1 : 0.62}
        color="#ffffff"
      />

      {!dayMode && <pointLight
        position={[-8, 5, 4]}
        intensity={0.32}
        color="#d71920"
      />}

      {/* Rim light: separates the structure's rear edges from the black
          background so the frame, brackets and pole details stay readable. */}
      <directionalLight
        position={[-3, 9, -14]}
        intensity={dayMode ? 0.7 : 1.12}
        color="#dce6f2"
      />

      <RoadEnvironment
        reducedMotion={reducedMotion}
        dayMode={dayMode}
      />

      <RealisticUnipoleModel
        progressRef={progressRef}
        reducedMotion={reducedMotion}
        dayMode={dayMode}
      />

      <ContactShadows
        position={[0, -0.27, 0]}
        opacity={dayMode ? 0.42 : 0.56}
        scale={19}
        blur={2.6}
        far={9}
        resolution={128}
        color="#000000"
      />

      <InstallationCameraControls resetKey={cameraResetKey} />
    </>
  );
}

export function GroundToSkySection() {
  const reducedMotion = Boolean(useReducedMotion());
  const sectionRef = useRef<HTMLElement | null>(null);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const titleRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const descriptionRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const numberRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const progressRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [sceneActive, setSceneActive] = useState(false);
  const [sceneMounted, setSceneMounted] = useState(false);
  const [dayMode, setDayMode] = useState(true);
  const [cameraResetKey, setCameraResetKey] = useState(0);

  const scrollToStep = useCallback(
    (index: number) => {
      const step = stepRefs.current[index];
      if (!step) return;

      step.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });
    },
    [reducedMotion],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSceneActive(entry.isIntersecting);
        if (entry.isIntersecting) setSceneMounted(true);
      },
      {
        rootMargin: "700px 0px 700px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const firstStep = stepRefs.current[0];
    const lastStep = stepRefs.current[INSTALLATION_STEPS.length - 1];

    if (!section || !firstStep || !lastStep) return;

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      /* One continuous progress source keeps the 3D build synchronized
         with the centre position of the first and final text stages. */
      ScrollTrigger.create({
        trigger: firstStep,
        endTrigger: lastStep,
        start: "center center",
        end: "center center",
        scrub: reducedMotion ? false : 0.45,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progressRef.current = self.progress;

          const nextIndex = Math.min(
            INSTALLATION_STEPS.length - 1,
            Math.max(
              0,
              Math.round(
                self.progress * (INSTALLATION_STEPS.length - 1),
              ),
            ),
          );

          setActiveIndex((current) =>
            current === nextIndex ? current : nextIndex,
          );
        },
      });

      const finalIndex = INSTALLATION_STEPS.length - 1;

      stepRefs.current.forEach((step, index) => {
        const title = titleRefs.current[index];
        const description = descriptionRefs.current[index];
        const number = numberRefs.current[index];

        if (!step || !title || !description || !number) return;

        const isFinalStage = index === finalIndex;

        /*
         * The final stage only grows in and then holds — GSAP scrub
         * timelines freeze at their last keyframe once scroll passes
         * `end`, so completing the timeline at "centre" and never adding
         * a shrink phase keeps Stage 8 centred for the whole trailing
         * hold area below it. Scrolling back up naturally re-enters the
         * [start, end] window and reverses the tween, releasing it.
         */
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: step,
            start: "top 86%",
            end: isFinalStage ? "center center" : "bottom 18%",
            scrub: reducedMotion ? false : 0.35,
            invalidateOnRefresh: true,
            onEnter: () => setActiveIndex(index),
            onEnterBack: () => setActiveIndex(index),
          },
        });

        if (isFinalStage) {
          /* Stage 8 is the handover destination. Keep its complete content
             permanently readable instead of hiding it behind another scrub. */
          timeline.set(title, {
            scale: 1,
            y: 0,
            opacity: 1,
            transformOrigin: "left center",
          });
          timeline.set(description, { y: 0, opacity: 0.92 }, 0);
          timeline.set(
            number,
            {
              scale: 1.2,
              opacity: 1,
              transformOrigin: "center center",
            },
            0,
          );
          timeline.to({}, { duration: 1 });
        } else {
          timeline
            .fromTo(
              title,
              {
                scale: 0.58,
                y: 72,
                opacity: 0.28,
                transformOrigin: "left center",
              },
              {
                scale: 1,
                y: 0,
                opacity: 1,
                duration: 0.5,
                ease: "none",
              },
            )
            .to(title, {
              scale: 0.58,
              y: -72,
              opacity: 0.24,
              duration: 0.5,
              ease: "none",
            });

          timeline
            .fromTo(
              description,
              { y: 30, opacity: 0 },
              {
                y: 0,
                opacity: 0.92,
                duration: 0.5,
                ease: "none",
              },
              0,
            )
            .to(
              description,
              {
                y: -26,
                opacity: 0,
                duration: 0.5,
                ease: "none",
              },
              0.5,
            );

          timeline
            .fromTo(
              number,
              {
                scale: 0.72,
                opacity: 0.58,
                transformOrigin: "center center",
              },
              {
                scale: 1.2,
                opacity: 1,
                duration: 0.5,
                ease: "none",
              },
              0,
            )
            .to(
              number,
              {
                scale: 0.72,
                opacity: 0.52,
                duration: 0.5,
                ease: "none",
              },
              0.5,
            );
        }
      });
    }, section);

    const refreshId = window.requestAnimationFrame(() => {
      progressRef.current = 0;
      setActiveIndex(0);
      ScrollTrigger.refresh();
    });

    return () => {
      window.cancelAnimationFrame(refreshId);
      context.revert();
    };
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="installation"
      className="relative overflow-clip bg-black py-20 text-white sm:py-24 lg:py-28"
      aria-labelledby="installation-title"
    >
      <div className="container-x">
        <header className="relative z-30 mx-auto max-w-4xl text-center">
          <p className="text-[clamp(1.25rem,1.8vw,1.8rem)] font-medium leading-tight tracking-[-0.025em] text-white/80">
            From Ground to Sky
          </p>

          <h2
            id="installation-title"
            className="mt-2 text-[clamp(2.35rem,3.8vw,3.75rem)] font-normal leading-[1] tracking-[-0.045em] text-white"
          >
            The installation journey.
          </h2>
        </header>

        <div className="mx-auto mt-20 grid max-w-[1520px] items-start gap-12 lg:relative lg:left-1/2 lg:mt-28 lg:w-[calc(100vw-2rem)] lg:max-w-[1780px] lg:-translate-x-1/2 lg:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.9fr)] lg:gap-10 xl:w-[calc(100vw-3rem)] xl:gap-14">
          <div className="lg:sticky lg:top-[6.5rem]">
            <div className="relative h-[460px] w-full overflow-hidden bg-[#07090a] sm:h-[600px] md:h-[680px] lg:h-[calc(100svh-7rem)] lg:min-h-[620px] lg:max-h-[880px]">
              {sceneMounted && (
                <Canvas
                  className="cursor-grab active:cursor-grabbing"
                  dpr={[1, 1.25]}
                  shadows
                  frameloop={sceneActive ? "always" : "never"}
                  camera={{
                    position: INITIAL_CAMERA_POSITION,
                    fov: INITIAL_CAMERA_FOV,
                    near: 0.1,
                    far: 210,
                  }}
                  gl={{
                    antialias: true,
                    alpha: false,
                    stencil: false,
                    powerPreference: "high-performance",
                  }}
                >
                  <Scene
                    progressRef={progressRef}
                    reducedMotion={reducedMotion}
                    dayMode={dayMode}
                    cameraResetKey={cameraResetKey}
                  />
                </Canvas>
              )}

              <button
                type="button"
                onClick={() => setDayMode((current) => !current)}
                aria-label={`Switch to ${dayMode ? "night" : "day"} view`}
                title={`Switch to ${dayMode ? "night" : "day"} view`}
                className={`absolute right-5 top-5 z-20 inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[9px] font-semibold uppercase tracking-[0.2em] backdrop-blur-md transition-colors sm:right-6 sm:top-6 ${
                  dayMode
                    ? "border-black/10 bg-white/85 text-[#17212a]"
                    : "border-white/15 bg-black/55 text-white/80"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    dayMode
                      ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.75)]"
                      : "bg-[#9db9d6] shadow-[0_0_8px_rgba(157,185,214,0.65)]"
                  }`}
                />
                {dayMode ? "Day" : "Night"}
              </button>

              <button
                type="button"
                onClick={() => setCameraResetKey((current) => current + 1)}
                aria-label="Reset 3D view"
                title="Reset 3D view"
                className="absolute right-5 top-16 z-20 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md transition-colors hover:bg-black/65 sm:right-6 sm:top-[4.5rem]"
              >
                Reset view
              </button>

              <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur-md sm:left-6 sm:top-6">
                Drag to rotate · right-drag to pan
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent px-5 pb-5 pt-24 sm:px-7 sm:pb-7">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">
                      Stage {String(activeIndex + 1).padStart(2, "0")}
                    </span>

                    <p className="mt-2 max-w-[460px] text-lg font-medium tracking-[-0.025em] text-white sm:text-xl">
                      {INSTALLATION_STEPS[activeIndex].title}
                    </p>
                  </div>

                  <span className="text-sm font-medium text-white/55">
                    {activeIndex + 1}/{INSTALLATION_STEPS.length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative min-w-0">
            {/* Covers the complete area between the fixed website header and
                this sticky label. Stage titles and descriptions now disappear
                behind solid black before reaching "installation stage", so
                no scrolling text can leak into the space above it. */}
            <div className="sticky top-[5.9rem] z-20 bg-black">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-full h-[calc(5.9rem+2px)] bg-black"
              />

              <div className="relative grid grid-cols-[64px_minmax(0,1fr)] items-center border-b border-white/10 bg-black py-5 sm:grid-cols-[80px_minmax(0,1fr)] lg:py-6">
                <div aria-hidden="true" />

                <p className="text-xl font-semibold lowercase tracking-[-0.03em] text-white sm:text-2xl">
                  installation stage
                </p>
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-full h-16 bg-gradient-to-b from-black via-black/95 to-transparent" />
            </div>

            <div className="relative pb-[24svh] pt-[12svh]">
              <div className="absolute bottom-0 left-8 top-0 w-px -translate-x-1/2 bg-white/[0.22] sm:left-10" />

              {INSTALLATION_STEPS.map((step, index) => (
                <article
                  key={step.title}
                  ref={(element) => {
                    stepRefs.current[index] = element;
                  }}
                  className={`relative grid grid-cols-[64px_minmax(0,1fr)] items-center py-10 sm:grid-cols-[80px_minmax(0,1fr)] ${
                    index === INSTALLATION_STEPS.length - 1
                      ? "min-h-[72svh] lg:min-h-[calc(100svh-9rem)]"
                      : "min-h-[62svh] first:min-h-[58svh] lg:min-h-[68svh]"
                  }`}
                >
                  <div className="relative flex h-full items-center justify-center">
                    <span
                      ref={(element) => {
                        numberRefs.current[index] = element;
                      }}
                      className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-black text-lg font-medium text-white shadow-[0_0_0_8px_rgba(255,255,255,0.025)] will-change-transform sm:h-14 sm:w-14 sm:text-xl"
                    >
                      {index + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollToStep(index)}
                    className="min-w-0 pr-2 text-left"
                    aria-current={activeIndex === index ? "step" : undefined}
                  >
                    <h3
                      ref={(element) => {
                        titleRefs.current[index] = element;
                      }}
                      className={`overflow-visible bg-gradient-to-r from-[#fd8d94] to-[#7a6ee6] bg-clip-text pb-[0.12em] font-medium leading-[1.08] tracking-[-0.06em] text-transparent will-change-transform ${
                        index === INSTALLATION_STEPS.length - 1
                          ? "max-w-[700px] text-[clamp(2.55rem,4.4vw,5.15rem)]"
                          : "max-w-[760px] text-[clamp(2.8rem,5vw,5.7rem)]"
                      }`}
                    >
                      {index === INSTALLATION_STEPS.length - 1 ? (
                        <>
                          Quality
                          <br />
                          Certification
                          <br />&amp; Handover
                        </>
                      ) : (
                        step.title
                      )}
                    </h3>

                    <p
                      ref={(element) => {
                        descriptionRefs.current[index] = element;
                      }}
                      className="mt-6 max-w-[660px] text-base leading-7 text-white/90 will-change-transform sm:text-lg"
                    >
                      {step.description}
                    </p>
                  </button>
                </article>
              ))}
            </div>

            {/* Holds Stage 8 centred (and the 3D model + sticky panels
                engaged) for a controlled distance before the section
                releases into normal scrolling. */}
            <div
              aria-hidden="true"
              className="h-[22svh] lg:h-[48svh]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default GroundToSkySection;