import { MathUtils, Vector3 } from "three";

/**
 * World scale: the Earth is a sphere of radius 10 units centred on the origin.
 * The globe never rotates — only the camera moves — so every lat/lon below is
 * a fixed world-space anchor.
 */
export const EARTH_RADIUS = 10;

/** Unipoles are drawn at a stylised (exaggerated) scale so they read on a planet. */
export const UNIPOLE_SCALE = 0.062;

export type HeroLocation = {
  name: string;
  lat: number;
  lon: number;
  color: string;
  /** Creative headline painted onto the board. */
  tagline: string;
  /**
   * Completed projects in this city, shown on the label as "N projects
   * completed". Leave undefined until a confirmed figure exists — the label
   * then shows the city name only.
   */
  projects?: string;
  /**
   * Optional real campaign artwork (e.g. "/images/creatives/chennai.jpg").
   * When omitted a generated placeholder creative is used.
   */
  artwork?: string;
};

export const OVERVIEW = {
  name: "Overview",
  color: "#ffffff",
} as const;

export const CITIES: readonly HeroLocation[] = [
  { name: "Chennai", lat: 13.0827, lon: 80.2707, color: "#e5b76b", tagline: "Own the Marina skyline", projects: "18" },
  { name: "Coimbatore", lat: 11.0168, lon: 76.9558, color: "#70c7ed", tagline: "Lead the Kovai corridor", projects: "15" },
  { name: "Madurai", lat: 9.9252, lon: 78.1198, color: "#ef896d", tagline: "Seen by the temple city", projects: "10+" },
  { name: "Trichy", lat: 10.7905, lon: 78.7047, color: "#b6a8f5", tagline: "Rise above the Rockfort", projects: "12" },
  { name: "Salem", lat: 11.6643, lon: 78.146, color: "#e9bc6b", tagline: "Steel city. Strong brands.", projects: "10" },
  { name: "Tirunelveli", lat: 8.7139, lon: 77.7567, color: "#8bdfbd", tagline: "The south, spotlit", projects: "10" },
];

/** Stage list used by the UI: index 0 is the overview, 1..n are the cities. */
export const STAGES = [OVERVIEW, ...CITIES] as const;

export function surfaceUp(lat: number, lon: number, target = new Vector3()) {
  const la = MathUtils.degToRad(lat);
  const lo = MathUtils.degToRad(lon);
  return target.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

export function latLonToVector(lat: number, lon: number, radius = EARTH_RADIUS, target = new Vector3()) {
  return surfaceUp(lat, lon, target).multiplyScalar(radius);
}

/** Local tangent frame at a surface point: up (normal), east and north. */
export function surfaceFrame(lat: number, lon: number) {
  const up = surfaceUp(lat, lon);
  const lo = MathUtils.degToRad(lon);
  const east = new Vector3(Math.cos(lo), 0, -Math.sin(lo)).normalize();
  const north = new Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}

function headingVector(frame: ReturnType<typeof surfaceFrame>, headingDeg: number) {
  const h = MathUtils.degToRad(headingDeg);
  return frame.north.clone().multiplyScalar(Math.cos(h)).addScaledVector(frame.east, Math.sin(h));
}

export type CameraPose = { position: Vector3; target: Vector3 };

export const CITY_VIEW = { elevation: 15, distance: 0.36, targetHeight: 0.026 };

/** Orbit-style pose: camera looks at a city from a heading/elevation/distance. */
function poseAtCity(city: HeroLocation, headingDeg: number): CameraPose {
  const { elevation: elevationDeg, distance, targetHeight } = CITY_VIEW;
  const frame = surfaceFrame(city.lat, city.lon);
  const look = headingVector(frame, headingDeg);
  const el = MathUtils.degToRad(elevationDeg);
  const target = frame.up.clone().multiplyScalar(EARTH_RADIUS + targetHeight);
  const position = target
    .clone()
    .addScaledVector(look, -Math.cos(el) * distance)
    .addScaledVector(frame.up, Math.sin(el) * distance);
  return { position, target };
}

/**
 * Overview: camera high over the Indian Ocean looking east-north-east across
 * South India towards the sunrise, so the Earth becomes a vast curved horizon
 * across the lower part of the frame.
 */
const OVERVIEW_VIEW = { lat: -2, lon: 57, altitude: 3.4, heading: 60, horizonOffsetDeg: 6 };

function overviewPose(): CameraPose {
  const { lat, lon, altitude, heading, horizonOffsetDeg } = OVERVIEW_VIEW;
  const frame = surfaceFrame(lat, lon);
  const flat = headingVector(frame, heading);
  const dip = Math.acos(EARTH_RADIUS / (EARTH_RADIUS + altitude));
  const pitch = -(dip - MathUtils.degToRad(horizonOffsetDeg));
  const look = flat.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(frame.up, Math.sin(pitch));
  const position = frame.up.clone().multiplyScalar(EARTH_RADIUS + altitude);
  return { position, target: position.clone().addScaledVector(look, 10) };
}

/**
 * The sun sits just above the overview horizon (dawn over the Bay of Bengal).
 * South India is therefore on the night side with its city lights glowing,
 * while a golden terminator band and blue rim wrap the far limb.
 */
function sunDirection() {
  const { lat, lon, altitude, heading } = OVERVIEW_VIEW;
  const frame = surfaceFrame(lat, lon);
  const flat = headingVector(frame, heading);
  const dip = Math.acos(EARTH_RADIUS / (EARTH_RADIUS + altitude));
  const depression = dip - MathUtils.degToRad(2.5);
  return flat.multiplyScalar(Math.cos(depression)).addScaledVector(frame.up, -Math.sin(depression)).normalize();
}

export const SUN_DIRECTION = sunDirection();

/** Initial great-circle bearing from point A to point B, degrees from north. */
function bearing(latA: number, lonA: number, latB: number, lonB: number) {
  const p1 = MathUtils.degToRad(latA);
  const p2 = MathUtils.degToRad(latB);
  const dl = MathUtils.degToRad(lonB - lonA);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (MathUtils.radToDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Each city is viewed along the direction of arrival from the previous stop
 * (bearing from this city back to the previous one, reversed). The camera then
 * always flies forward along the route — never to the far side of the next
 * city and back — and each board faces the approaching camera.
 */
function arrivalHeading(index: number) {
  const city = CITIES[index];
  const from = index === 0 ? OVERVIEW_VIEW : CITIES[index - 1];
  return (bearing(city.lat, city.lon, from.lat, from.lon) + 180) % 360;
}

export const CITY_HEADINGS = CITIES.map((_, index) => arrivalHeading(index));

export const STAGE_POSES: CameraPose[] = [
  overviewPose(),
  ...CITIES.map((city, index) => poseAtCity(city, CITY_HEADINGS[index])),
];

/** Board yaw (around local up) so each board faces its city's camera approach. */
export function boardYaw(index: number) {
  return -MathUtils.degToRad(CITY_HEADINGS[index]) + 0.32;
}
