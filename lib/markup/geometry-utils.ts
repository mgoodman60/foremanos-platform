import type { MarkupGeometry } from './markup-types';

/**
 * Convert PDF user space coordinates (bottom-left origin, 72 units/inch)
 * to Konva/screen coordinates (top-left origin, screen pixels).
 */
export function pdfToKonva(
  pdfX: number,
  pdfY: number,
  pageHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: pdfX * scale,
    y: (pageHeight - pdfY) * scale,
  };
}

/**
 * Convert Konva/screen coordinates (top-left origin)
 * to PDF user space coordinates (bottom-left origin).
 */
export function konvaToPdf(
  konvaX: number,
  konvaY: number,
  pageHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: konvaX / scale,
    y: pageHeight - konvaY / scale,
  };
}

/**
 * Hit test: is point (px, py) inside an axis-aligned rectangle?
 */
export function pointInRect(
  px: number,
  py: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * Hit test: is point (px, py) inside a polygon defined by a flat points array?
 * Uses the ray-casting algorithm.
 */
export function pointInPolygon(
  px: number,
  py: number,
  points: number[]
): boolean {
  const n = points.length / 2;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2];
    const yi = points[i * 2 + 1];
    const xj = points[j * 2];
    const yj = points[j * 2 + 1];

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Shortest distance from a point (px, py) to a line segment (x1,y1)-(x2,y2).
 */
export function distanceToLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return euclideanDistance(px, py, x1, y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return euclideanDistance(px, py, projX, projY);
}

/**
 * Compute the bounding box for a markup geometry.
 */
export function getBoundingBox(
  geometry: MarkupGeometry,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _shapeType: unknown
): { x: number; y: number; width: number; height: number } {
  if (
    geometry.x != null &&
    geometry.y != null &&
    geometry.width != null &&
    geometry.height != null
  ) {
    return {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
    };
  }

  if (geometry.points && geometry.points.length >= 2) {
    return pointsBoundingBox(geometry.points);
  }

  return { x: 0, y: 0, width: 0, height: 0 };
}

function pointsBoundingBox(points: number[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Euclidean distance between two points.
 */
export function euclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the area of a polygon using the Shoelace formula.
 */
export function polygonArea(points: number[]): number {
  const n = points.length / 2;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}

/**
 * Compute the perimeter of a polygon (closed).
 */
export function polygonPerimeter(points: number[]): number {
  const n = points.length / 2;
  if (n < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += euclideanDistance(
      points[i * 2],
      points[i * 2 + 1],
      points[j * 2],
      points[j * 2 + 1]
    );
  }
  return perimeter;
}

/**
 * Simplify a polyline/freehand path using Ramer-Douglas-Peucker.
 */
export function simplifyPoints(points: number[], tolerance: number): number[] {
  const n = points.length / 2;
  if (n <= 2) return [...points];

  let maxDist = 0;
  let maxIndex = 0;

  const startX = points[0];
  const startY = points[1];
  const endX = points[(n - 1) * 2];
  const endY = points[(n - 1) * 2 + 1];

  for (let i = 1; i < n - 1; i++) {
    const d = distanceToLine(points[i * 2], points[i * 2 + 1], startX, startY, endX, endY);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, (maxIndex + 1) * 2), tolerance);
    const right = simplifyPoints(points.slice(maxIndex * 2), tolerance);
    return [...left.slice(0, left.length - 2), ...right];
  }

  return [startX, startY, endX, endY];
}

/**
 * Get dash pattern array for a line style.
 */
export function getDashPattern(lineStyle: string, strokeWidth: number): number[] | undefined {
  switch (lineStyle) {
    case 'dashed':
      return [10, 5];
    case 'dotted':
      return [strokeWidth, strokeWidth * 2];
    case 'dash_dot':
      return [10, 5, strokeWidth, 5];
    default:
      return undefined;
  }
}
