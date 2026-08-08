"use client";

import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { gsap } from "gsap";

type SocialItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type PositionSetter = (value: number) => void;

type BallPhysics = {
  element: HTMLAnchorElement;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  phase: number;
  frequency: number;
  dragging: boolean;
  hovering: boolean;
  moved: boolean;
  suppressClick: boolean;
  pointerId: number | null;
  startPointerX: number;
  startPointerY: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  lastPointerX: number;
  lastPointerY: number;
  lastPointerTime: number;
  setX: PositionSetter;
  setY: PositionSetter;
};

type SafePosition = {
  x: number;
  y: number;
};

const socialItems: SocialItem[] = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: Facebook,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/",
    icon: Linkedin,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: Instagram,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/",
    icon: Youtube,
  },
];

/*
 * SAFE MOVEMENT AREA
 *
 * The balls can move only in:
 * 1. Left margin
 * 2. Right margin
 * 3. Bottom 150px
 *
 * They cannot enter the centre content area.
 */
const BOTTOM_SAFE_ZONE_PX = 0;

const SIDE_SAFE_ZONE_DESKTOP_PX = 110;
const SIDE_SAFE_ZONE_MOBILE_PX = 78;

const TOP_CLEARANCE_PX = 88;
const EDGE_MARGIN_PX = 10;

/*
 * PHYSICS SETTINGS
 *
 * MAX_SPEED_PX controls movement after release.
 *
 * Increase = faster
 * Decrease = slower
 *
 * 5px  = slow
 * 10px = current
 * 15px = fast
 */
const MAX_SPEED_PX = 10;
const MIN_IDLE_SPEED_PX = 0.35;

const DRAG_THRESHOLD_PX = 5;
const COLLISION_GAP_PX = 4;

const WALL_BOUNCE = 0.72;
const BALL_BOUNCE = 0.82;

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
) => Math.min(Math.max(value, minimum), maximum);

const distanceSquared = (
  firstX: number,
  firstY: number,
  secondX: number,
  secondY: number,
) => {
  const differenceX = firstX - secondX;
  const differenceY = firstY - secondY;

  return (
    differenceX * differenceX +
    differenceY * differenceY
  );
};

export default function FloatingSocialBubble() {
  const elementRefs = useRef<
    Array<HTMLAnchorElement | null>
  >([]);

  const physicsRef = useRef<BallPhysics[]>([]);

  const reducedMotionRef = useRef(false);

  const getSideSafeZoneWidth = () =>
    window.innerWidth < 640
      ? SIDE_SAFE_ZONE_MOBILE_PX
      : SIDE_SAFE_ZONE_DESKTOP_PX;

  /*
   * Converts any requested position into the nearest
   * valid position inside the U-shaped safe area.
   */
  const getSafePosition = (
    requestedX: number,
    requestedY: number,
    diameter: number,
  ): SafePosition => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const sideZoneWidth =
      getSideSafeZoneWidth();

    const maximumX = Math.max(
      EDGE_MARGIN_PX,
      viewportWidth -
        diameter -
        EDGE_MARGIN_PX,
    );

    const maximumY = Math.max(
      TOP_CLEARANCE_PX,
      viewportHeight -
        diameter -
        EDGE_MARGIN_PX,
    );

    const bottomZoneStartY = Math.max(
      TOP_CLEARANCE_PX,
      viewportHeight -
        BOTTOM_SAFE_ZONE_PX,
    );

    const leftZoneMaximumX = Math.max(
      EDGE_MARGIN_PX,
      sideZoneWidth - diameter,
    );

    const rightZoneMinimumX = Math.min(
      maximumX,
      viewportWidth - sideZoneWidth,
    );

    /*
     * Candidate 1: left margin.
     */
    const leftPosition = {
      x: clamp(
        requestedX,
        EDGE_MARGIN_PX,
        leftZoneMaximumX,
      ),
      y: clamp(
        requestedY,
        TOP_CLEARANCE_PX,
        maximumY,
      ),
    };

    /*
     * Candidate 2: right margin.
     */
    const rightPosition = {
      x: clamp(
        requestedX,
        rightZoneMinimumX,
        maximumX,
      ),
      y: clamp(
        requestedY,
        TOP_CLEARANCE_PX,
        maximumY,
      ),
    };

    /*
     * Candidate 3: bottom 150px.
     */
    const bottomPosition = {
      x: clamp(
        requestedX,
        EDGE_MARGIN_PX,
        maximumX,
      ),
      y: clamp(
        requestedY,
        bottomZoneStartY,
        maximumY,
      ),
    };

    const leftDistance = distanceSquared(
      requestedX,
      requestedY,
      leftPosition.x,
      leftPosition.y,
    );

    const rightDistance = distanceSquared(
      requestedX,
      requestedY,
      rightPosition.x,
      rightPosition.y,
    );

    const bottomDistance = distanceSquared(
      requestedX,
      requestedY,
      bottomPosition.x,
      bottomPosition.y,
    );

    if (
      leftDistance <= rightDistance &&
      leftDistance <= bottomDistance
    ) {
      return leftPosition;
    }

    if (rightDistance <= bottomDistance) {
      return rightPosition;
    }

    return bottomPosition;
  };

  const applySafePosition = (
    ball: BallPhysics,
    requestedX: number,
    requestedY: number,
    bounce = false,
  ) => {
    const diameter = ball.radius * 2;

    const safePosition = getSafePosition(
      requestedX,
      requestedY,
      diameter,
    );

    if (bounce) {
      const blockedHorizontally =
        Math.abs(
          safePosition.x - requestedX,
        ) > 0.5;

      const blockedVertically =
        Math.abs(
          safePosition.y - requestedY,
        ) > 0.5;

      if (blockedHorizontally) {
        ball.velocityX =
          -ball.velocityX *
          WALL_BOUNCE;
      }

      if (blockedVertically) {
        ball.velocityY =
          -ball.velocityY *
          WALL_BOUNCE;
      }
    }

    ball.x = safePosition.x;
    ball.y = safePosition.y;
  };

  const resolveBallCollisions = () => {
    const balls = physicsRef.current;

    for (
      let firstIndex = 0;
      firstIndex < balls.length;
      firstIndex += 1
    ) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < balls.length;
        secondIndex += 1
      ) {
        const first = balls[firstIndex];
        const second = balls[secondIndex];

        const firstCenterX =
          first.x + first.radius;

        const firstCenterY =
          first.y + first.radius;

        const secondCenterX =
          second.x + second.radius;

        const secondCenterY =
          second.y + second.radius;

        const differenceX =
          secondCenterX - firstCenterX;

        const differenceY =
          secondCenterY - firstCenterY;

        const currentDistanceSquared =
          differenceX * differenceX +
          differenceY * differenceY;

        const minimumDistance =
          first.radius +
          second.radius +
          COLLISION_GAP_PX;

        if (
          currentDistanceSquared >=
          minimumDistance * minimumDistance
        ) {
          continue;
        }

        const currentDistance =
          Math.sqrt(
            currentDistanceSquared,
          ) || 0.001;

        const normalX =
          differenceX / currentDistance;

        const normalY =
          differenceY / currentDistance;

        const overlap =
          minimumDistance -
          currentDistance;

        const firstFixed =
          first.dragging ||
          first.hovering;

        const secondFixed =
          second.dragging ||
          second.hovering;

        if (!firstFixed && !secondFixed) {
          first.x -=
            normalX * overlap * 0.5;

          first.y -=
            normalY * overlap * 0.5;

          second.x +=
            normalX * overlap * 0.5;

          second.y +=
            normalY * overlap * 0.5;
        } else if (
          firstFixed &&
          !secondFixed
        ) {
          second.x += normalX * overlap;
          second.y += normalY * overlap;
        } else if (
          !firstFixed &&
          secondFixed
        ) {
          first.x -= normalX * overlap;
          first.y -= normalY * overlap;
        }

        const relativeVelocityX =
          second.velocityX -
          first.velocityX;

        const relativeVelocityY =
          second.velocityY -
          first.velocityY;

        const velocityAlongNormal =
          relativeVelocityX * normalX +
          relativeVelocityY * normalY;

        if (velocityAlongNormal <= 0) {
          const impulse =
            (-(1 + BALL_BOUNCE) *
              velocityAlongNormal) /
            2;

          if (!firstFixed) {
            first.velocityX -=
              impulse * normalX;

            first.velocityY -=
              impulse * normalY;
          }

          if (!secondFixed) {
            second.velocityX +=
              impulse * normalX;

            second.velocityY +=
              impulse * normalY;
          }
        }

        const firstSafePosition =
          getSafePosition(
            first.x,
            first.y,
            first.radius * 2,
          );

        first.x = firstSafePosition.x;
        first.y = firstSafePosition.y;

        const secondSafePosition =
          getSafePosition(
            second.x,
            second.y,
            second.radius * 2,
          );

        second.x = secondSafePosition.x;
        second.y = secondSafePosition.y;
      }
    }
  };

  useEffect(() => {
    reducedMotionRef.current =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    const initialiseBalls = () => {
      const elements =
        elementRefs.current.filter(
          (
            element,
          ): element is HTMLAnchorElement =>
            element !== null,
        );

      const viewportHeight =
        window.innerHeight;

      physicsRef.current = elements.map(
        (element, index) => {
          const diameter =
            element.offsetWidth || 70;

          const radius = diameter / 2;

          const sideZoneWidth =
            getSideSafeZoneWidth();

          const initialX =
            window.innerWidth -
            sideZoneWidth +
            Math.max(
              0,
              (sideZoneWidth -
                diameter) /
                2,
            );

          const sideAreaEnd =
            viewportHeight -
            BOTTOM_SAFE_ZONE_PX -
            diameter;

          const usableSideHeight =
            Math.max(
              100,
              sideAreaEnd -
                TOP_CLEARANCE_PX,
            );

          const initialY =
            TOP_CLEARANCE_PX +
            usableSideHeight *
              ((index + 1) /
                (elements.length + 1));

          const setX = gsap.quickSetter(
            element,
            "x",
            "px",
          ) as PositionSetter;

          const setY = gsap.quickSetter(
            element,
            "y",
            "px",
          ) as PositionSetter;

          const safeInitialPosition =
            getSafePosition(
              initialX,
              initialY,
              diameter,
            );

          const ball: BallPhysics = {
            element,
            x: safeInitialPosition.x,
            y: safeInitialPosition.y,
            velocityX:
              index % 2 === 0
                ? -0.38 -
                  index * 0.04
                : 0.34 +
                  index * 0.04,
            velocityY:
              index % 2 === 0
                ? 0.26 +
                  index * 0.03
                : -0.3 -
                  index * 0.03,
            radius,
            phase: index * 1.7,
            frequency:
              0.7 + index * 0.09,
            dragging: false,
            hovering: false,
            moved: false,
            suppressClick: false,
            pointerId: null,
            startPointerX: 0,
            startPointerY: 0,
            pointerOffsetX: 0,
            pointerOffsetY: 0,
            lastPointerX: 0,
            lastPointerY: 0,
            lastPointerTime: 0,
            setX,
            setY,
          };

          setX(ball.x);
          setY(ball.y);

          return ball;
        },
      );

      gsap.fromTo(
        elements,
        {
          autoAlpha: 0,
          scale: 0.35,
        },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.7,
          stagger: 0.09,
          ease: "back.out(1.6)",
          overwrite: true,
        },
      );
    };

    const initialiseFrame =
      window.requestAnimationFrame(
        initialiseBalls,
      );

    const updatePhysics = (
      time: number,
      deltaTime: number,
    ) => {
      const delta = clamp(
        deltaTime / 16.6667,
        0.5,
        2,
      );

      const balls = physicsRef.current;

      balls.forEach((ball, index) => {
        if (ball.dragging) {
          return;
        }

        if (
          reducedMotionRef.current ||
          ball.hovering
        ) {
          ball.velocityX *= 0.7;
          ball.velocityY *= 0.7;

          if (
            Math.abs(ball.velocityX) <
            0.01
          ) {
            ball.velocityX = 0;
          }

          if (
            Math.abs(ball.velocityY) <
            0.01
          ) {
            ball.velocityY = 0;
          }

          return;
        }

        const idleForceX =
          Math.sin(
            time * ball.frequency +
              ball.phase,
          ) * 0.002;

        const idleForceY =
          Math.cos(
            time *
              (ball.frequency + 0.13) +
              ball.phase,
          ) * 0.002;

        ball.velocityX +=
          idleForceX * delta;

        ball.velocityY +=
          idleForceY * delta;

        const currentSpeed = Math.hypot(
          ball.velocityX,
          ball.velocityY,
        );

        if (
          currentSpeed <
          MIN_IDLE_SPEED_PX
        ) {
          ball.velocityX +=
            Math.cos(
              ball.phase + index,
            ) * 0.008;

          ball.velocityY +=
            Math.sin(
              ball.phase + index,
            ) * 0.008;
        }

        ball.velocityX = clamp(
          ball.velocityX,
          -MAX_SPEED_PX,
          MAX_SPEED_PX,
        );

        ball.velocityY = clamp(
          ball.velocityY,
          -MAX_SPEED_PX,
          MAX_SPEED_PX,
        );

        ball.velocityX *= Math.pow(
          0.996,
          delta,
        );

        ball.velocityY *= Math.pow(
          0.996,
          delta,
        );

        const requestedX =
          ball.x +
          ball.velocityX * delta;

        const requestedY =
          ball.y +
          ball.velocityY * delta;

        applySafePosition(
          ball,
          requestedX,
          requestedY,
          true,
        );
      });

      resolveBallCollisions();

      balls.forEach((ball) => {
        ball.setX(ball.x);
        ball.setY(ball.y);
      });
    };

    gsap.ticker.add(updatePhysics);

    const handleResize = () => {
      physicsRef.current.forEach(
        (ball) => {
          applySafePosition(
            ball,
            ball.x,
            ball.y,
          );

          ball.setX(ball.x);
          ball.setY(ball.y);
        },
      );
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      window.cancelAnimationFrame(
        initialiseFrame,
      );

      window.removeEventListener(
        "resize",
        handleResize,
      );

      gsap.ticker.remove(updatePhysics);

      elementRefs.current.forEach(
        (element) => {
          if (element) {
            gsap.killTweensOf(element);
          }
        },
      );

      physicsRef.current = [];
    };
  }, []);

  const handlePointerDown = (
    index: number,
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    const ball = physicsRef.current[index];

    if (!ball) {
      return;
    }

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    ball.dragging = true;
    ball.hovering = true;
    ball.moved = false;
    ball.suppressClick = false;
    ball.pointerId = event.pointerId;

    ball.startPointerX = event.clientX;
    ball.startPointerY = event.clientY;

    ball.pointerOffsetX =
      event.clientX - ball.x;

    ball.pointerOffsetY =
      event.clientY - ball.y;

    ball.lastPointerX = event.clientX;
    ball.lastPointerY = event.clientY;

    ball.lastPointerTime =
      performance.now();

    ball.velocityX = 0;
    ball.velocityY = 0;

    gsap.to(ball.element, {
      scale: 1.1,
      duration: 0.16,
      ease: "power2.out",
      overwrite: true,
    });
  };

  const handlePointerMove = (
    index: number,
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    const ball = physicsRef.current[index];

    if (
      !ball ||
      !ball.dragging ||
      ball.pointerId !== event.pointerId
    ) {
      return;
    }

    const totalMovement = Math.hypot(
      event.clientX -
        ball.startPointerX,
      event.clientY -
        ball.startPointerY,
    );

    if (
      totalMovement >
      DRAG_THRESHOLD_PX
    ) {
      ball.moved = true;
    }

    if (!ball.moved) {
      return;
    }

    event.preventDefault();

    const currentTime = performance.now();

    const elapsed = Math.max(
      8,
      currentTime -
        ball.lastPointerTime,
    );

    const movementX =
      event.clientX -
      ball.lastPointerX;

    const movementY =
      event.clientY -
      ball.lastPointerY;

    const requestedX =
      event.clientX -
      ball.pointerOffsetX;

    const requestedY =
      event.clientY -
      ball.pointerOffsetY;

    /*
     * The dragged ball is automatically kept inside
     * the left, right and bottom safe zones.
     */
    applySafePosition(
      ball,
      requestedX,
      requestedY,
    );

    ball.velocityX = clamp(
      (movementX / elapsed) *
        16.6667,
      -MAX_SPEED_PX,
      MAX_SPEED_PX,
    );

    ball.velocityY = clamp(
      (movementY / elapsed) *
        16.6667,
      -MAX_SPEED_PX,
      MAX_SPEED_PX,
    );

    ball.lastPointerX =
      event.clientX;

    ball.lastPointerY =
      event.clientY;

    ball.lastPointerTime =
      currentTime;

    ball.setX(ball.x);
    ball.setY(ball.y);
  };

  const finishPointerInteraction = (
    index: number,
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    const ball = physicsRef.current[index];

    if (
      !ball ||
      ball.pointerId !== event.pointerId
    ) {
      return;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    ball.dragging = false;
    ball.pointerId = null;
    ball.suppressClick = ball.moved;

    ball.hovering =
      event.pointerType === "mouse" &&
      event.currentTarget.matches(
        ":hover",
      );

    if (reducedMotionRef.current) {
      ball.velocityX = 0;
      ball.velocityY = 0;
    }

    gsap.to(ball.element, {
      scale: ball.hovering ? 1.05 : 1,
      duration: 0.25,
      ease: "back.out(1.6)",
      overwrite: true,
    });

    window.setTimeout(() => {
      ball.moved = false;
    }, 100);
  };

  const handleClick = (
    index: number,
    event: ReactMouseEvent<HTMLAnchorElement>,
  ) => {
    const ball = physicsRef.current[index];

    if (ball?.suppressClick) {
      event.preventDefault();
      event.stopPropagation();

      ball.suppressClick = false;
    }
  };

  const handlePointerEnter = (
    index: number,
  ) => {
    const ball = physicsRef.current[index];

    if (!ball) {
      return;
    }

    ball.hovering = true;
    ball.velocityX = 0;
    ball.velocityY = 0;

    if (!ball.dragging) {
      gsap.to(ball.element, {
        scale: 1.06,
        duration: 0.2,
        ease: "power2.out",
        overwrite: true,
      });
    }
  };

  const handlePointerLeave = (
    index: number,
  ) => {
    const ball = physicsRef.current[index];

    if (!ball || ball.dragging) {
      return;
    }

    ball.hovering = false;

    if (
      Math.hypot(
        ball.velocityX,
        ball.velocityY,
      ) < 0.05
    ) {
      ball.velocityX =
        Math.cos(ball.phase) *
        MIN_IDLE_SPEED_PX;

      ball.velocityY =
        Math.sin(ball.phase) *
        MIN_IDLE_SPEED_PX;
    }

    gsap.to(ball.element, {
      scale: 1,
      duration: 0.22,
      ease: "power2.out",
      overwrite: true,
    });
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[300]"
      aria-label="Interactive social-media links"
    >
      {socialItems.map(
        (
          {
            label,
            href,
            icon: Icon,
          },
          index,
        ) => (
          <a
            key={label}
            ref={(element) => {
              elementRefs.current[index] =
                element;
            }}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            aria-label={`Open ${label}`}
            title={`${label} — click to open or drag to play`}
            onDragStart={(event) =>
              event.preventDefault()
            }
            onPointerDown={(event) =>
              handlePointerDown(
                index,
                event,
              )
            }
            onPointerMove={(event) =>
              handlePointerMove(
                index,
                event,
              )
            }
            onPointerUp={(event) =>
              finishPointerInteraction(
                index,
                event,
              )
            }
            onPointerCancel={(event) =>
              finishPointerInteraction(
                index,
                event,
              )
            }
            onPointerEnter={() =>
              handlePointerEnter(index)
            }
            onPointerLeave={() =>
              handlePointerLeave(index)
            }
            onFocus={() =>
              handlePointerEnter(index)
            }
            onBlur={() =>
              handlePointerLeave(index)
            }
            onClick={(event) =>
              handleClick(index, event)
            }
            className={[
              "pointer-events-auto absolute left-0 top-0",
              "grid size-[58px] cursor-grab touch-none select-none place-items-center",
              "overflow-hidden rounded-full",
              "border border-white/55",
              "opacity-0 outline-none",
              "backdrop-blur-xl backdrop-saturate-150",
              "active:cursor-grabbing",
              "focus-visible:ring-2 focus-visible:ring-violet-300",
              "sm:size-[70px]",
              "will-change-transform",
            ].join(" ")}
            style={{
              background: [
                "radial-gradient(circle at 29% 17%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.48) 7%, transparent 18%)",
                "radial-gradient(circle at 27% 27%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 24%, transparent 42%)",
                "radial-gradient(circle at 74% 78%, rgba(98,63,220,0.46) 0%, transparent 52%)",
                "radial-gradient(circle at 54% 48%, rgba(199,188,255,0.48) 0%, rgba(157,128,244,0.34) 46%, rgba(105,68,213,0.5) 100%)",
                "linear-gradient(145deg, rgba(225,218,255,0.78), rgba(164,137,247,0.66) 48%, rgba(103,67,210,0.78) 100%)",
              ].join(", "),
              boxShadow: [
                "0 17px 34px rgba(82,57,158,0.23)",
                "0 5px 13px rgba(56,39,112,0.16)",
                "0 0 18px rgba(164,132,247,0.2)",
                "inset 10px 12px 19px rgba(255,255,255,0.42)",
                "inset -13px -16px 23px rgba(74,38,168,0.27)",
                "inset 0 0 0 1px rgba(255,255,255,0.32)",
              ].join(", "),
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[4px] rounded-full border border-white/30 shadow-[inset_4px_5px_12px_rgba(255,255,255,0.18),inset_-5px_-7px_13px_rgba(78,41,176,0.17)]"
            />

            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[15%] top-[8%] h-[34%] w-[58%] -rotate-[18deg] rounded-[50%] bg-gradient-to-br from-white/80 via-white/28 to-transparent blur-[1px]"
            />

            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-[18%] top-[17%] size-[8%] rounded-full bg-white/90 shadow-[0_0_7px_rgba(255,255,255,0.9)]"
            />

            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[-10%] right-[-8%] size-[72%] rounded-full bg-violet-700/25 blur-xl"
            />

            <Icon
              aria-hidden="true"
              size={25}
              strokeWidth={2.4}
              className="relative z-10 text-white drop-shadow-[0_2px_2px_rgba(72,38,151,0.45)] sm:size-[30px]"
            />

            <span className="sr-only">
              {label}
            </span>
          </a>
        ),
      )}
    </div>
  );
}