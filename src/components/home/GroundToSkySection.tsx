"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject } from "react";

import { Canvas, useFrame } from "@react-three/fiber";
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
      "Assessing access, visibility, ground condition and soil strength before structural work begins.",
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
      "Installing protected cabling, maintenance access and focused floodlights for reliable night visibility.",
  },
  {
    title: "Signage Installation",
    description:
      "Bringing the finished display panel from the front and seating it cleanly onto the completed rear frame.",
  },
  {
    title: "Final Safety Inspection",
    description:
      "Inspecting the foundation, fasteners, frame alignment, lighting and finishing before handover.",
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

type ModelProps = {
  progressRef: MutableRefObject<number>;
  reducedMotion: boolean;
};

function useAdinnBoardTexture() {
  const [texture, setTexture] =
    useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const createdTextures: THREE.CanvasTexture[] = [];

    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 768;

    const context = canvas.getContext("2d");
    if (!context) return;

    const render = (logo: HTMLImageElement | null) => {
      const background = context.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height,
      );
      background.addColorStop(0, "#f8f8f5");
      background.addColorStop(0.55, "#ffffff");
      background.addColorStop(1, "#ececea");

      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);

      /* Left accent bar */
      context.fillStyle = "#d71920";
      context.fillRect(0, 0, 22, canvas.height);

      /* Logo lockup, drawn from the real project asset when available */
      const logoWidth = 300;
      const logoHeight = logoWidth * (47 / 125);
      const logoX = 96;
      const logoY = 78;

      if (logo) {
        context.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      } else {
        context.fillStyle = "#111111";
        context.font = "800 60px Arial";
        context.textAlign = "left";
        context.fillText("ADINN", logoX, logoY + logoHeight * 0.72);
      }

      context.fillStyle = "#6a6a6a";
      context.font = "600 28px Arial";
      context.textAlign = "left";
      context.fillText(
        "UNIPOLE ADVERTISING",
        logoX,
        logoY + logoHeight + 44,
      );

      /* Main headline */
      context.fillStyle = "#171717";
      context.font = "800 92px Arial";
      context.fillText("STAND TALL.", 96, 400);
      context.fillText("STAY MEMORABLE.", 96, 496);

      context.strokeStyle = "#d71920";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(98, 534);
      context.lineTo(760, 534);
      context.stroke();

      /* Supporting tagline */
      context.fillStyle = "#3a3a3a";
      context.font = "600 40px Arial";
      context.fillText("Guiding Journeys.", 96, 602);
      context.fillText("Defining Destinations.", 96, 654);

      /* Right-side details block */
      const rightX = canvas.width - 96;
      context.textAlign = "right";

      context.fillStyle = "#d71920";
      context.font = "700 36px Arial";
      context.fillText("FROM GROUND TO SKY", rightX, 190);

      context.fillStyle = "#282828";
      context.font = "600 30px Arial";
      context.fillText("STANDARD UNIPOLE", rightX, 258);
      context.fillText("LED UNIPOLE", rightX, 306);
      context.fillText("SPECIAL SIGNAGE", rightX, 354);

      context.strokeStyle = "#d71920";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(canvas.width - 480, 396);
      context.lineTo(rightX, 396);
      context.stroke();

      context.fillStyle = "#6a6a6a";
      context.font = "600 24px Arial";
      context.fillText(
        "ENGINEERED • FABRICATED • INSTALLED",
        rightX,
        464,
      );

      context.fillStyle = "#171717";
      context.font = "700 22px Arial";
      context.fillText(
        "ADINN ADVERTISING SERVICES LTD.",
        rightX,
        canvas.height - 108,
      );

      context.textAlign = "left";

      const nextTexture = new THREE.CanvasTexture(canvas);
      nextTexture.colorSpace = THREE.SRGBColorSpace;
      nextTexture.anisotropy = 8;
      nextTexture.needsUpdate = true;

      createdTextures.push(nextTexture);

      if (!cancelled) setTexture(nextTexture);
    };

    /* Draw immediately so the board is never blank, then redraw once the
       real ADINN logo asset has loaded. */
    render(null);

    const logoImage = new window.Image();
    logoImage.onload = () => {
      if (!cancelled) render(logoImage);
    };
    logoImage.src = "/AdinnLogo.svg";

    return () => {
      cancelled = true;
      createdTextures.forEach((created) => created.dispose());
    };
  }, []);

  return texture;
}

function SteelMaterial({
  color = "#878d92",
  roughness = 0.36,
}: {
  color?: string;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={0.9}
      roughness={roughness}
      envMapIntensity={0.9}
    />
  );
}

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
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
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
      castShadow
    >
      <cylinderGeometry
        args={[radius, radius, transform.length, 18]}
      />
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

function LadderSafetyHoop({ y }: { y: number }) {
  const segments = 5;
  const radius = 0.34;

  const points = useMemo<Vec3[]>(
    () =>
      Array.from({ length: segments + 1 }, (_, index) => {
        const angle = (Math.PI * index) / segments;
        return [
          Math.sin(angle) * radius,
          y,
          -Math.cos(angle) * radius - 0.1,
        ] as Vec3;
      }),
    [y],
  );

  return (
    <>
      {points.slice(0, -1).map((point, index) => (
        <BeamBetween
          key={index}
          start={point}
          end={points[index + 1]}
          radius={0.022}
          color="#3a3f43"
        />
      ))}
    </>
  );
}

function Ladder() {
  /* Trimmed to end just below the rear mounting head instead of
     extending past the (now shorter) pole top. */
  const rungs = Array.from({ length: 18 }, (_, index) => index);
  const hoopHeights = [-3.4, -1.8, -0.2, 1.4];

  return (
    <group name="Ladder" position={[0, 5.15, -0.64]}>
      <BoxMember
        position={[-0.23, -0.6, 0]}
        size={[0.055, 7.0, 0.055]}
        color="#42474b"
      />
      <BoxMember
        position={[0.23, -0.6, 0]}
        size={[0.055, 7.0, 0.055]}
        color="#42474b"
      />

      {rungs.map((index) => (
        <BoxMember
          key={index}
          position={[0, -4.0 + index * 0.4, 0]}
          size={[0.5, 0.045, 0.055]}
          color="#3a3f43"
        />
      ))}

      {/* Safety cage hoops */}
      {hoopHeights.map((y) => (
        <LadderSafetyHoop key={y} y={y} />
      ))}
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

function RearMountingHead() {
  return (
    <group name="RearMount">
      {/* Cap plate at the pole top */}
      <mesh position={[0, POLE_TOP_Y + 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.46, 0.16, 28]} />
        <SteelMaterial color="#5a6165" roughness={0.4} />
      </mesh>

      {/* T-shaped crossbar */}
      <BoxMember
        position={[0, POLE_TOP_Y + 0.32, 0]}
        size={[1.55, 0.18, 0.34]}
        color="#565d61"
      />

      {/* Main support beam rising from the mounting head to the rear frame */}
      <BeamBetween
        start={[0, POLE_TOP_Y + 0.24, 0.02]}
        end={[0, FRAME_CONNECT_Y, FRAME_CONNECT_Z]}
        radius={0.17}
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
        <cylinderGeometry args={[0.44, 0.72, POLE_HEIGHT, 56]} />
        <meshStandardMaterial
          color="#c5c9cc"
          metalness={0.9}
          roughness={0.38}
          envMapIntensity={1.05}
        />
      </mesh>

      <mesh name="BasePlate" position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[1.02, 1.02, 0.22, 44]} />
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
                Math.sin(rotation) * 0.68,
                0.76,
                Math.cos(rotation) * 0.68,
              ]}
              rotation={[0, rotation, 0]}
              castShadow
            >
              <boxGeometry args={[0.12, 0.72, 0.68]} />
              <SteelMaterial color="#747a7e" />
            </mesh>
          ),
        )}
      </group>

      <RearMountingHead />
      <Ladder />
      <ElectricalDetails />
    </group>
  );
}

function RearStructuralFrame() {
  const verticalPosts = [-4.35, -2.9, -1.45, 0, 1.45, 2.9, 4.35];

  return (
    <group>
      <BoxMember
        position={[0, 1.82, -0.52]}
        size={[9.5, 0.18, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[0, -1.82, -0.52]}
        size={[9.5, 0.18, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[-4.66, 0, -0.52]}
        size={[0.18, 3.82, 0.24]}
        color="#6b7074"
      />
      <BoxMember
        position={[4.66, 0, -0.52]}
        size={[0.18, 3.82, 0.24]}
        color="#6b7074"
      />

      {verticalPosts.map((x) => (
        <BoxMember
          key={x}
          position={[x, 0, -0.95]}
          size={[0.08, 3.45, 0.08]}
          color="#656b6f"
        />
      ))}

      <group name="CrossBracing">
        {verticalPosts.map((x, index) => (
          <BeamBetween
            key={x}
            start={[x - 0.52, -1.55, -0.92]}
            end={[x + 0.52, 1.55, -0.92]}
            radius={0.045}
            color={index % 2 === 0 ? "#5e6468" : "#70767a"}
          />
        ))}

        <BeamBetween
          start={[-2.6, -2.2, -0.7]}
          end={[-0.9, -3.75, -0.15]}
          radius={0.1}
        />
        <BeamBetween
          start={[2.6, -2.2, -0.7]}
          end={[0.9, -3.75, -0.15]}
          radius={0.1}
        />
        <BeamBetween
          start={[-2.2, -1.8, -0.6]}
          end={[-0.7, -0.25, -0.15]}
          radius={0.075}
        />
        <BeamBetween
          start={[2.2, -1.8, -0.6]}
          end={[0.7, -0.25, -0.15]}
          radius={0.075}
        />
      </group>

      <BoxMember
        position={[0, -2.22, -0.7]}
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
  const deckSections = [-3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75];

  return (
    <group position={[0, -2.24, 0.72]}>
      <BoxMember
        position={[0, 0, 0]}
        size={[9.15, 0.15, 1.6]}
        color="#7f8589"
      />

      {deckSections.map((x) => (
        <group key={x} position={[x, 0.11, 0]}>
          <BoxMember
            position={[0, 0, 0]}
            size={[1.02, 0.07, 1.34]}
            color="#93989c"
          />

          {[-0.44, -0.22, 0, 0.22, 0.44].map((z) => (
            <BoxMember
              key={z}
              position={[0, 0.05, z]}
              size={[0.9, 0.025, 0.03]}
              color="#63686c"
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function FloodLight({
  position,
  rotation = [0, 0, 0],
}: {
  position: Vec3;
  rotation?: Vec3;
}) {
  const coolingFins = [-0.15, -0.075, 0, 0.075, 0.15];

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

      {/* Visible edge highlight around the lens opening, so the fixture
          reads clearly against the black background */}
      <mesh position={[0, 0, 0.205]}>
        <ringGeometry args={[0.185, 0.208, 24]} />
        <meshStandardMaterial
          color="#6b7278"
          metalness={0.7}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rear heat-sink fins */}
      {coolingFins.map((x) => (
        <mesh key={x} position={[x, 0, -0.235]} castShadow>
          <boxGeometry args={[0.025, 0.23, 0.09]} />
          <meshStandardMaterial
            color="#12171a"
            metalness={0.82}
            roughness={0.32}
          />
        </mesh>
      ))}

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
          emissiveIntensity={4.6}
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
          opacity={0.8}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* Fixture x-positions across the top rail. All billboard illumination now
   lives up here, structurally attached to the frame — no ground-level or
   base-mounted fixtures remain. */
const BOARD_LIGHT_X = [-3.75, -1.88, 0, 1.88, 3.75] as const;

function LightingRig() {
  return (
    <group>
      <group name="LightArms">
        {BOARD_LIGHT_X.map((x) => (
          <group key={x}>
            {/* Mounting bracket plate where the arm meets the top rail */}
            <BoxMember
              position={[x, 1.82, -0.14]}
              size={[0.16, 0.16, 0.22]}
              color="#4b5157"
            />
            <BeamBetween
              start={[x, 1.86, -0.06]}
              end={[x, 2.86, 1.22]}
              radius={0.05}
              color="#454a4e"
            />
          </group>
        ))}
      </group>

      <group name="FloodLights">
        {BOARD_LIGHT_X.map((x) => (
          <FloodLight
            key={x}
            position={[x, 2.9, 1.28]}
            rotation={[-0.5, 0, 0]}
          />
        ))}
      </group>
    </group>
  );
}

function FrontDisplayPanel() {
  const texture = useAdinnBoardTexture();

  return (
    <group>
      <RoundedBox
        args={[9.14, 3.52, 0.16]}
        radius={0.035}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#f4f4f1"}
          roughness={0.46}
          metalness={0.02}
        />
      </RoundedBox>

      <mesh position={[0, 0, -0.13]} castShadow>
        <boxGeometry args={[9.3, 3.68, 0.11]} />
        <meshStandardMaterial
          color="#c2c6c8"
          metalness={0.56}
          roughness={0.42}
        />
      </mesh>

      <BoxMember
        position={[0, 1.85, -0.02]}
        size={[9.38, 0.12, 0.23]}
        color="#7a8084"
      />
      <BoxMember
        position={[0, -1.85, -0.02]}
        size={[9.38, 0.12, 0.23]}
        color="#7a8084"
      />
      <BoxMember
        position={[-4.7, 0, -0.02]}
        size={[0.12, 3.8, 0.23]}
        color="#7a8084"
      />
      <BoxMember
        position={[4.7, 0, -0.02]}
        size={[0.12, 3.8, 0.23]}
        color="#7a8084"
      />
    </group>
  );
}

function SurveyScene() {
  return (
    <group>
      <gridHelper
        args={[13, 13, "#5d6267", "#2e3338"]}
        position={[0, 0.02, 0]}
      />

      {[
        [-4.8, 0.48, -3.8],
        [4.8, 0.48, -3.8],
        [-4.8, 0.48, 3.8],
        [4.8, 0.48, 3.8],
      ].map((position, index) => (
        <group key={index} position={position as Vec3}>
          <mesh castShadow>
            <cylinderGeometry args={[0.055, 0.055, 0.95, 12]} />
            <meshStandardMaterial color="#d71920" />
          </mesh>
          <mesh position={[0, 0.44, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}

      <mesh
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2.2, 2.25, 96]} />
        <meshBasicMaterial
          color="#d71920"
          transparent
          opacity={0.74}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function InspectionMarkers() {
  return (
    <group>
      {[
        [0, 0.82, 0, 1.15],
        [0, 5.35, 0, 0.92],
        [0, 11.55, 0.4, 1.52],
      ].map(([x, y, z, radius], index) => (
        <mesh
          key={index}
          position={[x, y, z]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[radius, 0.035, 12, 72]} />
          <meshBasicMaterial
            color="#d71920"
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

function RealisticUnipoleModel({
  progressRef,
  reducedMotion,
}: ModelProps) {
  const surveyRef = useRef<THREE.Group | null>(null);
  const blueprintRef = useRef<THREE.Group | null>(null);
  const foundationRef = useRef<THREE.Group | null>(null);
  const poleRef = useRef<THREE.Group | null>(null);
  const frameRef = useRef<THREE.Group | null>(null);
  const lightingRef = useRef<THREE.Group | null>(null);
  const panelRef = useRef<THREE.Group | null>(null);
  const inspectionRef = useRef<THREE.Group | null>(null);
  const ghostRef = useRef<THREE.Group | null>(null);
  const boardLightRefs = useRef<Array<THREE.SpotLight | null>>([]);
  const currentProgress = useRef(0);

  /* Billboard floodlights + their aim targets, expressed in the same local
     space as the fixtures themselves (LightingRig) and the board
     (FrontDisplayPanel), so they inherit the model's transform and stay
     correctly aimed regardless of scale. */
  const boardLightRig = useMemo(
    () =>
      BOARD_LIGHT_X.map((x) => {
        const target = new THREE.Object3D();
        target.position.set(x * 1.12, 11.55, 0.32);

        return {
          position: [x, 14.45, 1.13] as Vec3,
          target,
        };
      }),
    [],
  );

  const ghostSteelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b8c0c5",
        metalness: 0.86,
        roughness: 0.27,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      }),
    [],
  );

  const ghostPanelMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f3f4f2",
        metalness: 0.02,
        roughness: 0.7,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      ghostSteelMaterial.dispose();
      ghostPanelMaterial.dispose();
    },
    [ghostPanelMaterial, ghostSteelMaterial],
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
    const ghost = 1 - smoothStep(0.08, 0.2, progress);

    /* Billboard floodlights stay at zero until Stage 6 (Electrical &
       Lighting) begins, then ramp in — reusing the same smoothed
       progress value as the fixtures themselves so light and geometry
       always agree. */
    const boardLightIntensity = lighting * 6.2;
    boardLightRefs.current.forEach((light) => {
      if (light) light.intensity = boardLightIntensity;
    });

    if (ghostRef.current) {
      ghostRef.current.visible = ghost > 0.01;
      ghostRef.current.scale.setScalar(
        THREE.MathUtils.lerp(0.97, 1, ghost),
      );
      ghostSteelMaterial.opacity = ghost * 0.52;
      ghostPanelMaterial.opacity = ghost * 0.9;
    }

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
        -0.7,
        0,
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
      inspectionRef.current.rotation.y += delta * 0.24;
    }
  });

  return (
    <group scale={0.94} position={[0, -0.46, 0]}>
      <group ref={ghostRef}>
        <mesh
          position={[0, 4.86, 0]}
          castShadow
          material={ghostSteelMaterial}
        >
          <cylinderGeometry args={[0.43, 0.7, 7.5, 48]} />
        </mesh>

        {/* Ghost mounting-head connector, matching the real assembly */}
        <mesh
          position={[0, 9.15, -0.32]}
          material={ghostSteelMaterial}
        >
          <boxGeometry args={[0.5, 1.4, 0.34]} />
        </mesh>

        <mesh
          position={[0, 11.55, -0.32]}
          castShadow
          material={ghostSteelMaterial}
        >
          <boxGeometry args={[9.55, 3.9, 0.26]} />
        </mesh>

        <mesh
          position={[0, 11.55, 0.06]}
          castShadow
          material={ghostPanelMaterial}
        >
          <boxGeometry args={[9.12, 3.5, 0.14]} />
        </mesh>

        <mesh
          position={[0, 0.32, 0]}
          receiveShadow
          material={ghostSteelMaterial}
        >
          <boxGeometry args={[3.1, 0.65, 3.1]} />
        </mesh>
      </group>

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
          <boxGeometry args={[9.5, 3.85, 0.5]} />
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
          args={[3.15, 0.68, 3.15]}
          radius={0.08}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#8b8e91" roughness={0.9} />
        </RoundedBox>

        <group name="AnchorBolts">
          {[
            [-0.96, 0.94, -0.96],
            [0.96, 0.94, -0.96],
            [-0.96, 0.94, 0.96],
            [0.96, 0.94, 0.96],
            [-0.96, 0.94, 0],
            [0.96, 0.94, 0],
          ].map((position, index) => (
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
        position={[0, 11.55, -0.15]}
        scale={0.001}
        visible={false}
      >
        <LightingRig />
      </group>

      {boardLightRig.map((rig, index) => (
        <group key={index}>
          <primitive object={rig.target} />

          <spotLight
            ref={(light) => {
              boardLightRefs.current[index] = light;
              if (light) light.target = rig.target;
            }}
            position={rig.position}
            angle={0.26}
            penumbra={0.68}
            distance={9}
            decay={1.8}
            intensity={0}
            color="#ffe9c2"
            castShadow={index === 2}
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
        <FrontDisplayPanel />
      </group>

      <group ref={inspectionRef} visible={false}>
        <InspectionMarkers />
      </group>
    </group>
  );
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const FOLIAGE_SHADES = [
  "#1f4634",
  "#254f3a",
  "#1a3b2c",
  "#2c5942",
] as const;

const FOLIAGE_RADII = [0.3, 0.38, 0.46, 0.54] as const;

/* Shared across every tree instance so foliage clusters reuse the same
   geometry/material objects instead of allocating one per mesh. */
const foliageGeometries = FOLIAGE_RADII.map(
  (radius) => new THREE.IcosahedronGeometry(radius, 0),
);

const foliageMaterials = FOLIAGE_SHADES.map(
  (color) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      flatShading: true,
    }),
);

function Tree({ position, seed }: { position: Vec3; seed: number }) {
  const rand = (offset: number) => seededRandom(seed * 7.13 + offset);

  const trunkHeight = 1.4 + rand(1) * 0.55;
  const trunkTilt = (rand(2) - 0.5) * 0.09;
  const trunkLean = (rand(3) - 0.5) * 0.07;
  const treeScale = 0.82 + rand(4) * 0.42;
  const treeRotation = rand(6) * Math.PI * 2;

  const clusters = useMemo(
    () =>
      Array.from(
        { length: 4 + Math.floor(rand(5) * 2) },
        (_, index) => {
          const angle = rand(10 + index) * Math.PI * 2;
          const radius = 0.15 + rand(20 + index) * 0.26;

          return {
            position: [
              Math.cos(angle) * radius,
              trunkHeight * 0.76 + rand(30 + index) * 0.58,
              Math.sin(angle) * radius,
            ] as Vec3,
            geometryIndex: Math.floor(
              rand(40 + index) * FOLIAGE_RADII.length,
            ),
            materialIndex: Math.floor(
              rand(50 + index) * FOLIAGE_SHADES.length,
            ),
          };
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, trunkHeight],
  );

  return (
    <group
      position={position}
      scale={treeScale}
      rotation={[trunkTilt, treeRotation, trunkLean]}
    >
      <mesh position={[0, trunkHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.15, trunkHeight, 8]} />
        <meshStandardMaterial color="#3a3028" roughness={0.92} />
      </mesh>

      {/* Secondary branch stub for a less perfectly uniform silhouette */}
      <mesh
        position={[0.05, trunkHeight * 0.72, 0.03]}
        rotation={[0, 0, 0.55]}
        castShadow
      >
        <cylinderGeometry
          args={[0.025, 0.055, trunkHeight * 0.32, 6]}
        />
        <meshStandardMaterial color="#3a3028" roughness={0.92} />
      </mesh>

      {clusters.map((cluster, index) => (
        <mesh
          key={index}
          position={cluster.position}
          geometry={foliageGeometries[cluster.geometryIndex]}
          material={foliageMaterials[cluster.materialIndex]}
          castShadow
        />
      ))}
    </group>
  );
}

function RoadEnvironment() {
  const buildings = [
    { x: -8.4, z: -8.8, w: 2.2, h: 5.8, d: 2.1 },
    { x: -5.7, z: -10.2, w: 1.8, h: 4.2, d: 1.8 },
    { x: -3.1, z: -9.4, w: 2.6, h: 7.1, d: 2.2 },
    { x: 3.6, z: -10.3, w: 2.4, h: 6.6, d: 2.4 },
    { x: 6.5, z: -9.2, w: 2.1, h: 4.8, d: 2.0 },
    { x: 9.0, z: -10.6, w: 2.7, h: 7.5, d: 2.6 },
  ];

  const trees = [-7.4, -5.5, -3.8, 4.5, 6.2, 8.0];

  return (
    <group>
      <mesh
        position={[0, -0.29, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial
          color="#15191c"
          roughness={0.92}
          metalness={0.06}
        />
      </mesh>

      <mesh
        position={[0, -0.275, -1.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[10.5, 28]} />
        <meshStandardMaterial
          color="#20252a"
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>

      {/* Subtle road-edge curbs */}
      {[-5.4, 5.4].map((x) => (
        <mesh
          key={x}
          position={[x, -0.262, -1.2]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.32, 26]} />
          <meshStandardMaterial color="#2c3136" roughness={0.85} />
        </mesh>
      ))}

      {[-2.3, 2.3].map((x) => (
        <group key={x}>
          {[-10, -5, 0, 5, 10].map((z) => (
            <mesh
              key={z}
              position={[x, -0.245, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.1, 2.2]} />
              <meshBasicMaterial
                color="#d7d6cf"
                transparent
                opacity={0.42}
              />
            </mesh>
          ))}
        </group>
      ))}

      {buildings.map((building, index) => (
        <group
          key={`${building.x}-${building.z}`}
          position={[building.x, building.h / 2 - 0.18, building.z]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry
              args={[building.w, building.h, building.d]}
            />
            <meshStandardMaterial
              color={index % 2 === 0 ? "#26313a" : "#1f2930"}
              roughness={0.78}
              metalness={0.14}
            />
          </mesh>

          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 2 }, (_, column) => {
              const lit =
                seededRandom(index * 13 + row * 4 + column + 1) >
                0.4;

              return (
                <mesh
                  key={`${row}-${column}`}
                  position={[
                    (column - 0.5) * (building.w * 0.38),
                    building.h * 0.27 - row * (building.h * 0.17),
                    building.d / 2 + 0.012,
                  ]}
                >
                  <planeGeometry args={[0.24, 0.16]} />
                  <meshBasicMaterial
                    color={lit ? "#e9c98a" : "#89b9c9"}
                    transparent
                    opacity={lit ? 0.5 : 0.18}
                  />
                </mesh>
              );
            }),
          )}
        </group>
      ))}

      {trees.map((x, index) => (
        <Tree
          key={x}
          position={[x, -0.18, -5.7 - (index % 2) * 1.2]}
          seed={index + 1}
        />
      ))}
    </group>
  );
}

function Scene({ progressRef, reducedMotion }: ModelProps) {
  return (
    <>
      <color attach="background" args={["#07090a"]} />
      <fog attach="fog" args={["#07090a", 24, 43]} />

      <ambientLight intensity={1.05} />
      <hemisphereLight args={["#eef5ff", "#101214", 1.75]} />

      <directionalLight
        position={[8, 18, 12]}
        intensity={4.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={42}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={20}
        shadow-camera-bottom={-6}
      />

      <directionalLight
        position={[-9, 12, 4]}
        intensity={1.7}
        color="#c5d5e8"
      />

      <spotLight
        position={[0, 15, 9]}
        angle={0.42}
        penumbra={0.85}
        intensity={3.2}
        color="#ffffff"
        castShadow
      />

      <pointLight
        position={[-8, 5, 4]}
        intensity={0.9}
        color="#d71920"
      />

      {/* Rim light: separates the structure's rear edges from the black
          background so the frame, brackets and pole details stay readable. */}
      <directionalLight
        position={[-3, 9, -14]}
        intensity={2.2}
        color="#dce6f2"
      />

      <RoadEnvironment />

      <RealisticUnipoleModel
        progressRef={progressRef}
        reducedMotion={reducedMotion}
      />

      <ContactShadows
        position={[0, -0.27, 0]}
        opacity={0.56}
        scale={19}
        blur={2.6}
        far={9}
        color="#000000"
      />

      <OrbitControls
        makeDefault
        target={[0, 5.8, 0]}
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.4}
        minPolarAngle={1.1}
        maxPolarAngle={1.65}
        minAzimuthAngle={-0.8}
        maxAzimuthAngle={0.8}
      />
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
      ([entry]) => setSceneActive(entry.isIntersecting),
      {
        rootMargin: "320px 0px 320px 0px",
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
          timeline.fromTo(
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
              duration: 1,
              ease: "none",
            },
          );

          timeline.fromTo(
            description,
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 0.92,
              duration: 1,
              ease: "none",
            },
            0,
          );

          timeline.fromTo(
            number,
            {
              scale: 0.72,
              opacity: 0.58,
              transformOrigin: "center center",
            },
            {
              scale: 1.2,
              opacity: 1,
              duration: 1,
              ease: "none",
            },
            0,
          );
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
        <header className="mx-auto max-w-4xl text-center">
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

        <div className="mx-auto mt-20 grid max-w-[1520px] items-start gap-12 lg:mt-28 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)] lg:gap-14 xl:gap-20">
          <div className="lg:sticky lg:top-[6.5rem]">
            <div className="relative h-[460px] w-full overflow-hidden bg-[#07090a] sm:h-[600px] md:h-[680px] lg:h-[calc(100svh-7rem)] lg:min-h-[620px] lg:max-h-[880px]">
              <Canvas
                dpr={[1, 1.5]}
                shadows
                frameloop={sceneActive ? "always" : "never"}
                camera={{
                  position: [13.2, 8.6, 25.6],
                  fov: 34,
                  near: 0.1,
                  far: 110,
                }}
                gl={{
                  antialias: true,
                  alpha: false,
                  powerPreference: "high-performance",
                }}
              >
                <Scene
                  progressRef={progressRef}
                  reducedMotion={reducedMotion}
                />
              </Canvas>

              <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur-md sm:left-6 sm:top-6">
                Drag to rotate
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
            {/* Small mask blends the previous stage's number circle as it
                scrolls under the sticky label. It intentionally stops well
                short of the main "installation journey." heading above —
                the mt-20/lg:mt-28 gap on the grid already keeps that heading
                clear of the sticky layout, so this mask must never grow
                tall enough to reach back up into it. */}
            <div className="sticky top-[5.9rem] z-20 bg-black">
              <div className="pointer-events-none absolute inset-x-0 bottom-full h-8 bg-black" />

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
                  className="relative grid min-h-[62svh] grid-cols-[64px_minmax(0,1fr)] items-center py-10 first:min-h-[58svh] last:min-h-[58svh] sm:grid-cols-[80px_minmax(0,1fr)] lg:min-h-[68svh]"
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
                      className="max-w-[760px] bg-gradient-to-r from-[#fd8d94] to-[#7a6ee6] bg-clip-text text-[clamp(2.8rem,5vw,5.7rem)] font-medium leading-[0.98] tracking-[-0.06em] text-transparent will-change-transform"
                    >
                      {step.title}
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