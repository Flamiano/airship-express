// app/(supplyChain)/lib/grabbablePhysics.ts
'use client';

export interface Point {
    x: number;
    y: number;
}

export interface CollisionResult {
    collided: boolean;
    robotPush: Point;
    offlinePush: Point;
    angle: number;
}

export interface DragConstraints {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/**
 * Calculates viewport boundary constraints relative to an anchored position
 * so the grabbable element cannot be dragged outside the visible screen.
 */
export function getViewportDragConstraints(
    elementWidth: number,
    elementHeight: number,
    defaultBottom: number,
    defaultRight = 24,
    padding = 16
): DragConstraints {
    if (typeof window === 'undefined') {
        return { top: -600, bottom: 60, left: -1000, right: 10 };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return {
        // Can drag upwards until reaching top padding
        top: -(vh - defaultBottom - elementHeight - padding),
        // Can drag downwards until reaching bottom padding
        bottom: defaultBottom - padding,
        // Can drag leftwards until reaching left padding
        left: -(vw - defaultRight - elementWidth - padding),
        // Can drag rightwards until reaching right padding
        right: defaultRight - padding,
    };
}

/**
 * Clamps coordinates to stay within the computed drag constraints.
 */
export function clampToConstraints(
    point: Point,
    constraints: DragConstraints
): Point {
    return {
        x: Math.min(Math.max(point.x, constraints.left), constraints.right),
        y: Math.min(Math.max(point.y, constraints.top), constraints.bottom),
    };
}

/**
 * Checks for collision between the Robot Head and the Offline Indicator
 * and computes the repulsive spring push vectors to bounce them apart.
 */
export function calculateGrabbableCollision(
    robotEl: HTMLElement | null,
    offlineEl: HTMLElement | null,
    minDistance = 72
): CollisionResult | null {
    if (!robotEl || !offlineEl) return null;

    const r1 = robotEl.getBoundingClientRect();
    const r2 = offlineEl.getBoundingClientRect();

    const c1: Point = {
        x: r1.left + r1.width / 2,
        y: r1.top + r1.height / 2,
    };

    const c2: Point = {
        x: r2.left + r2.width / 2,
        y: r2.top + r2.height / 2,
    };

    let dx = c1.x - c2.x;
    let dy = c1.y - c2.y;
    let dist = Math.hypot(dx, dy);

    // Collision threshold based on bounding box sizes
    const threshold = Math.max(minDistance, (r1.width + r2.width) / 2 + 16);

    if (dist >= threshold) {
        return {
            collided: false,
            robotPush: { x: 0, y: 0 },
            offlinePush: { x: 0, y: 0 },
            angle: 0,
        };
    }

    // If completely overlapping, pick an arbitrary separation angle
    if (dist === 0) {
        dx = 0;
        dy = -1;
        dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = threshold - dist;
    const pushMagnitude = overlap + 28;

    return {
        collided: true,
        robotPush: {
            x: nx * pushMagnitude * 0.65,
            y: ny * pushMagnitude * 0.65,
        },
        offlinePush: {
            x: -nx * pushMagnitude * 0.65,
            y: -ny * pushMagnitude * 0.65,
        },
        angle: Math.atan2(dy, dx) * (180 / Math.PI),
    };
}
