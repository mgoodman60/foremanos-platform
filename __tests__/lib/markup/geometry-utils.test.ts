import { describe, it, expect } from 'vitest';
import {
  pdfToKonva,
  konvaToPdf,
  pointInRect,
  pointInPolygon,
  distanceToLine,
  getBoundingBox,
  euclideanDistance,
  polygonArea,
  polygonPerimeter,
  simplifyPoints,
  getDashPattern,
} from '@/lib/markup/geometry-utils';
import type { MarkupGeometry, MarkupShapeType } from '@/lib/markup/markup-types';

describe('markup/geometry-utils', () => {
  describe('pdfToKonva', () => {
    it('should convert PDF coordinates to Konva coordinates (letter size)', () => {
      const pageHeight = 792; // Letter: 11" * 72dpi
      const scale = 1;

      // Bottom-left (0,0) in PDF → top-left (0,792) in Konva
      const result1 = pdfToKonva(0, 0, pageHeight, scale);
      expect(result1).toEqual({ x: 0, y: 792 });

      // Top-left (0,792) in PDF → top-left (0,0) in Konva
      const result2 = pdfToKonva(0, 792, pageHeight, scale);
      expect(result2).toEqual({ x: 0, y: 0 });

      // Center (306,396) in PDF → center (306,396) in Konva
      const result3 = pdfToKonva(306, 396, pageHeight, scale);
      expect(result3).toEqual({ x: 306, y: 396 });
    });

    it('should convert PDF coordinates to Konva coordinates (A1 size)', () => {
      const pageHeight = 2384; // A1: ~33.1" * 72dpi
      const scale = 1;

      const result1 = pdfToKonva(0, 0, pageHeight, scale);
      expect(result1).toEqual({ x: 0, y: 2384 });

      const result2 = pdfToKonva(100, 200, pageHeight, scale);
      expect(result2).toEqual({ x: 100, y: 2184 });
    });

    it('should convert PDF coordinates to Konva coordinates (tabloid size)', () => {
      const pageHeight = 1224; // Tabloid: 17" * 72dpi
      const scale = 1;

      const result = pdfToKonva(612, 612, pageHeight, scale);
      expect(result).toEqual({ x: 612, y: 612 });
    });

    it('should apply scale factor correctly', () => {
      const pageHeight = 792;

      // Scale 0.5
      const result1 = pdfToKonva(100, 100, pageHeight, 0.5);
      expect(result1).toEqual({ x: 50, y: 346 }); // y = (792 - 100) * 0.5

      // Scale 2
      const result2 = pdfToKonva(100, 100, pageHeight, 2);
      expect(result2).toEqual({ x: 200, y: 1384 }); // y = (792 - 100) * 2
    });

    it('should handle negative coordinates', () => {
      const pageHeight = 792;
      const scale = 1;

      const result = pdfToKonva(-50, -50, pageHeight, scale);
      expect(result).toEqual({ x: -50, y: 842 });
    });

    it('should handle zero scale gracefully', () => {
      const pageHeight = 792;
      const scale = 0;

      const result = pdfToKonva(100, 100, pageHeight, scale);
      expect(result).toEqual({ x: 0, y: 0 });
    });
  });

  describe('konvaToPdf', () => {
    it('should convert Konva coordinates to PDF coordinates (letter size)', () => {
      const pageHeight = 792;
      const scale = 1;

      // Top-left (0,0) in Konva → bottom-left (0,792) in PDF
      const result1 = konvaToPdf(0, 0, pageHeight, scale);
      expect(result1).toEqual({ x: 0, y: 792 });

      // Top-left (0,792) in Konva → bottom-left (0,0) in PDF
      const result2 = konvaToPdf(0, 792, pageHeight, scale);
      expect(result2).toEqual({ x: 0, y: 0 });

      // Center
      const result3 = konvaToPdf(306, 396, pageHeight, scale);
      expect(result3).toEqual({ x: 306, y: 396 });
    });

    it('should convert Konva coordinates to PDF coordinates (A1 size)', () => {
      const pageHeight = 2384;
      const scale = 1;

      const result = konvaToPdf(100, 200, pageHeight, scale);
      expect(result).toEqual({ x: 100, y: 2184 });
    });

    it('should convert Konva coordinates to PDF coordinates (tabloid size)', () => {
      const pageHeight = 1224;
      const scale = 1;

      const result = konvaToPdf(612, 612, pageHeight, scale);
      expect(result).toEqual({ x: 612, y: 612 });
    });

    it('should apply scale factor correctly', () => {
      const pageHeight = 792;

      // Scale 0.5
      const result1 = konvaToPdf(50, 346, pageHeight, 0.5);
      expect(result1).toEqual({ x: 100, y: 100 });

      // Scale 2
      const result2 = konvaToPdf(200, 1384, pageHeight, 2);
      expect(result2).toEqual({ x: 100, y: 100 });
    });

    it('should handle division by zero scale', () => {
      const pageHeight = 792;
      const scale = 0;

      const result = konvaToPdf(100, 100, pageHeight, scale);
      expect(result.x).toBe(Infinity);
      expect(result.y).toBe(-Infinity);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve coordinates through round-trip conversion', () => {
      const pageHeight = 792;
      const scale = 1;

      const pdfOriginal = { x: 150, y: 250 };
      const konva = pdfToKonva(pdfOriginal.x, pdfOriginal.y, pageHeight, scale);
      const pdfRoundtrip = konvaToPdf(konva.x, konva.y, pageHeight, scale);

      expect(pdfRoundtrip.x).toBeCloseTo(pdfOriginal.x, 10);
      expect(pdfRoundtrip.y).toBeCloseTo(pdfOriginal.y, 10);
    });

    it('should preserve coordinates with different scales', () => {
      const pageHeight = 2384;
      const scale = 1.5;

      const pdfOriginal = { x: 500, y: 1000 };
      const konva = pdfToKonva(pdfOriginal.x, pdfOriginal.y, pageHeight, scale);
      const pdfRoundtrip = konvaToPdf(konva.x, konva.y, pageHeight, scale);

      expect(pdfRoundtrip.x).toBeCloseTo(pdfOriginal.x, 10);
      expect(pdfRoundtrip.y).toBeCloseTo(pdfOriginal.y, 10);
    });
  });

  describe('pointInRect', () => {
    it('should return true for point inside rectangle', () => {
      const rect = { x: 10, y: 10, width: 100, height: 50 };

      expect(pointInRect(50, 30, rect)).toBe(true);
      expect(pointInRect(15, 15, rect)).toBe(true);
      expect(pointInRect(100, 50, rect)).toBe(true);
    });

    it('should return false for point outside rectangle', () => {
      const rect = { x: 10, y: 10, width: 100, height: 50 };

      expect(pointInRect(5, 30, rect)).toBe(false);
      expect(pointInRect(50, 5, rect)).toBe(false);
      expect(pointInRect(120, 30, rect)).toBe(false);
      expect(pointInRect(50, 70, rect)).toBe(false);
    });

    it('should return true for point on rectangle edge', () => {
      const rect = { x: 10, y: 10, width: 100, height: 50 };

      expect(pointInRect(10, 30, rect)).toBe(true); // Left edge
      expect(pointInRect(110, 30, rect)).toBe(true); // Right edge
      expect(pointInRect(50, 10, rect)).toBe(true); // Top edge
      expect(pointInRect(50, 60, rect)).toBe(true); // Bottom edge
    });

    it('should return true for point at rectangle corner', () => {
      const rect = { x: 10, y: 10, width: 100, height: 50 };

      expect(pointInRect(10, 10, rect)).toBe(true); // Top-left
      expect(pointInRect(110, 10, rect)).toBe(true); // Top-right
      expect(pointInRect(10, 60, rect)).toBe(true); // Bottom-left
      expect(pointInRect(110, 60, rect)).toBe(true); // Bottom-right
    });

    it('should handle zero-size rectangle', () => {
      const rect = { x: 50, y: 50, width: 0, height: 0 };

      expect(pointInRect(50, 50, rect)).toBe(true);
      expect(pointInRect(51, 50, rect)).toBe(false);
      expect(pointInRect(50, 51, rect)).toBe(false);
    });

    it('should handle negative coordinates', () => {
      const rect = { x: -50, y: -50, width: 100, height: 100 };

      expect(pointInRect(0, 0, rect)).toBe(true);
      expect(pointInRect(-25, -25, rect)).toBe(true);
      expect(pointInRect(-60, 0, rect)).toBe(false);
    });
  });

  describe('pointInPolygon', () => {
    it('should return true for point inside convex polygon (triangle)', () => {
      const triangle = [0, 0, 100, 0, 50, 100]; // Equilateral-ish triangle

      expect(pointInPolygon(50, 30, triangle)).toBe(true);
      expect(pointInPolygon(40, 50, triangle)).toBe(true);
    });

    it('should return false for point outside convex polygon (triangle)', () => {
      const triangle = [0, 0, 100, 0, 50, 100];

      expect(pointInPolygon(150, 50, triangle)).toBe(false);
      expect(pointInPolygon(50, 150, triangle)).toBe(false);
      expect(pointInPolygon(-50, 0, triangle)).toBe(false);
    });

    it('should return true for point inside concave polygon (L-shape)', () => {
      const lShape = [0, 0, 100, 0, 100, 50, 50, 50, 50, 100, 0, 100];

      expect(pointInPolygon(25, 25, lShape)).toBe(true);
      expect(pointInPolygon(75, 25, lShape)).toBe(true);
      expect(pointInPolygon(25, 75, lShape)).toBe(true);
    });

    it('should return false for point in concave polygon notch', () => {
      const lShape = [0, 0, 100, 0, 100, 50, 50, 50, 50, 100, 0, 100];

      expect(pointInPolygon(75, 75, lShape)).toBe(false); // In the notch
    });

    it('should handle point on polygon edge', () => {
      const square = [0, 0, 100, 0, 100, 100, 0, 100];

      // Ray-casting is ambiguous for edge points, implementation-dependent
      const result = pointInPolygon(50, 0, square);
      expect(typeof result).toBe('boolean');
    });

    it('should return false for degenerate polygon (< 3 points)', () => {
      expect(pointInPolygon(50, 50, [0, 0])).toBe(false); // 1 point
      expect(pointInPolygon(50, 50, [0, 0, 100, 100])).toBe(false); // 2 points
    });

    it('should handle empty points array', () => {
      expect(pointInPolygon(50, 50, [])).toBe(false);
    });

    it('should handle single-point polygon', () => {
      expect(pointInPolygon(0, 0, [0, 0])).toBe(false);
    });
  });

  describe('distanceToLine', () => {
    it('should calculate distance to horizontal line', () => {
      const result = distanceToLine(50, 100, 0, 50, 100, 50);
      expect(result).toBe(50); // Point 50 units above line
    });

    it('should calculate distance to vertical line', () => {
      const result = distanceToLine(100, 50, 50, 0, 50, 100);
      expect(result).toBe(50); // Point 50 units right of line
    });

    it('should calculate distance to diagonal line', () => {
      const result = distanceToLine(0, 0, 0, 100, 100, 0);
      expect(result).toBeCloseTo(70.71, 2); // ~50*sqrt(2) for 45° line
    });

    it('should return 0 for point on line', () => {
      const result = distanceToLine(50, 50, 0, 0, 100, 100);
      expect(result).toBeCloseTo(0, 10);
    });

    it('should calculate distance to segment end when point projects off-segment', () => {
      const result = distanceToLine(200, 50, 0, 50, 100, 50);
      expect(result).toBe(100); // Distance to (100, 50) endpoint
    });

    it('should handle zero-length line (point)', () => {
      const result = distanceToLine(100, 100, 50, 50, 50, 50);
      expect(result).toBeCloseTo(70.71, 2); // Distance to (50,50)
    });

    it('should handle negative coordinates', () => {
      const result = distanceToLine(0, 0, -100, -100, 100, 100);
      expect(result).toBeCloseTo(0, 10); // Point on diagonal line
    });

    it('should be commutative for line endpoints', () => {
      const result1 = distanceToLine(50, 100, 0, 0, 100, 0);
      const result2 = distanceToLine(50, 100, 100, 0, 0, 0);
      expect(result1).toBeCloseTo(result2, 10);
    });
  });

  describe('getBoundingBox', () => {
    it('should return bounding box from x/y/width/height geometry (rectangle)', () => {
      const geometry: MarkupGeometry = { x: 10, y: 20, width: 100, height: 50 };
      const result = getBoundingBox(geometry, 'rectangle');

      expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('should calculate bounding box from points (line)', () => {
      const geometry: MarkupGeometry = { points: [10, 20, 110, 70] };
      const result = getBoundingBox(geometry, 'line');

      expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('should calculate bounding box from points (polyline)', () => {
      const geometry: MarkupGeometry = { points: [0, 0, 100, 50, 50, 100] };
      const result = getBoundingBox(geometry, 'polyline');

      expect(result).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it('should calculate bounding box from points (polygon)', () => {
      const geometry: MarkupGeometry = { points: [0, 0, 100, 0, 100, 100, 0, 100] };
      const result = getBoundingBox(geometry, 'polygon');

      expect(result).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });

    it('should calculate bounding box from points (freehand)', () => {
      const geometry: MarkupGeometry = { points: [10, 10, 20, 30, 5, 25, 15, 40] };
      const result = getBoundingBox(geometry, 'freehand');

      expect(result).toEqual({ x: 5, y: 10, width: 15, height: 30 });
    });

    it('should handle single-point geometry', () => {
      const geometry: MarkupGeometry = { points: [50, 50] };
      const result = getBoundingBox(geometry, 'line');

      expect(result).toEqual({ x: 50, y: 50, width: 0, height: 0 });
    });

    it('should return zero box for empty points array', () => {
      const geometry: MarkupGeometry = { points: [] };
      const result = getBoundingBox(geometry, 'line');

      expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should return zero box for missing geometry', () => {
      const geometry: MarkupGeometry = {};
      const result = getBoundingBox(geometry, 'rectangle');

      expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should prefer x/y/width/height over points if both present', () => {
      const geometry: MarkupGeometry = {
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        points: [0, 0, 200, 200],
      };
      const result = getBoundingBox(geometry, 'rectangle');

      expect(result).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('should handle negative coordinates in points', () => {
      const geometry: MarkupGeometry = { points: [-50, -50, 50, 50] };
      const result = getBoundingBox(geometry, 'line');

      expect(result).toEqual({ x: -50, y: -50, width: 100, height: 100 });
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate distance for 3-4-5 triangle', () => {
      const result = euclideanDistance(0, 0, 3, 4);
      expect(result).toBe(5);
    });

    it('should calculate distance for same point', () => {
      const result = euclideanDistance(10, 20, 10, 20);
      expect(result).toBe(0);
    });

    it('should calculate distance for horizontal line', () => {
      const result = euclideanDistance(0, 10, 50, 10);
      expect(result).toBe(50);
    });

    it('should calculate distance for vertical line', () => {
      const result = euclideanDistance(10, 0, 10, 100);
      expect(result).toBe(100);
    });

    it('should calculate distance for diagonal line', () => {
      const result = euclideanDistance(0, 0, 100, 100);
      expect(result).toBeCloseTo(141.42, 2); // 100*sqrt(2)
    });

    it('should handle negative coordinates', () => {
      const result = euclideanDistance(-10, -10, 10, 10);
      expect(result).toBeCloseTo(28.28, 2); // 20*sqrt(2)
    });

    it('should be commutative', () => {
      const result1 = euclideanDistance(10, 20, 30, 40);
      const result2 = euclideanDistance(30, 40, 10, 20);
      expect(result1).toBe(result2);
    });

    it('should handle large coordinates', () => {
      const result = euclideanDistance(0, 0, 1000, 1000);
      expect(result).toBeCloseTo(1414.21, 2);
    });

    it('should handle fractional coordinates', () => {
      const result = euclideanDistance(0, 0, 1.5, 2);
      expect(result).toBe(2.5);
    });
  });

  describe('polygonArea', () => {
    it('should calculate area of triangle', () => {
      const triangle = [0, 0, 100, 0, 50, 100];
      const result = polygonArea(triangle);

      expect(result).toBe(5000); // base=100, height=100, area=0.5*100*100
    });

    it('should calculate area of unit square', () => {
      const square = [0, 0, 1, 0, 1, 1, 0, 1];
      const result = polygonArea(square);

      expect(result).toBe(1);
    });

    it('should calculate area of rectangle', () => {
      const rectangle = [0, 0, 100, 0, 100, 50, 0, 50];
      const result = polygonArea(rectangle);

      expect(result).toBe(5000);
    });

    it('should return positive area for CCW winding', () => {
      const square = [0, 0, 100, 0, 100, 100, 0, 100]; // CCW
      const result = polygonArea(square);

      expect(result).toBe(10000);
      expect(result).toBeGreaterThan(0);
    });

    it('should return positive area for CW winding', () => {
      const square = [0, 0, 0, 100, 100, 100, 100, 0]; // CW
      const result = polygonArea(square);

      expect(result).toBe(10000);
      expect(result).toBeGreaterThan(0);
    });

    it('should return 0 for degenerate polygon (< 3 points)', () => {
      expect(polygonArea([0, 0])).toBe(0);
      expect(polygonArea([0, 0, 100, 100])).toBe(0);
    });

    it('should return 0 for empty points', () => {
      expect(polygonArea([])).toBe(0);
    });

    it('should calculate area for concave polygon', () => {
      const lShape = [0, 0, 100, 0, 100, 50, 50, 50, 50, 100, 0, 100];
      const result = polygonArea(lShape);

      // L-shape: 100x50 + 50x50 = 5000 + 2500 = 7500
      expect(result).toBe(7500);
    });
  });

  describe('polygonPerimeter', () => {
    it('should calculate perimeter of equilateral triangle', () => {
      const side = 100;
      const height = side * Math.sqrt(3) / 2;
      const triangle = [0, 0, side, 0, side / 2, height];
      const result = polygonPerimeter(triangle);

      expect(result).toBeCloseTo(300, 1);
    });

    it('should calculate perimeter of square', () => {
      const square = [0, 0, 100, 0, 100, 100, 0, 100];
      const result = polygonPerimeter(square);

      expect(result).toBe(400);
    });

    it('should calculate perimeter of rectangle', () => {
      const rectangle = [0, 0, 100, 0, 100, 50, 0, 50];
      const result = polygonPerimeter(rectangle);

      expect(result).toBe(300); // 2*(100+50)
    });

    it('should return 0 for single point', () => {
      const result = polygonPerimeter([50, 50]);

      expect(result).toBe(0);
    });

    it('should return 0 for empty points', () => {
      const result = polygonPerimeter([]);

      expect(result).toBe(0);
    });

    it('should close the polygon (include last-to-first edge)', () => {
      const openSquare = [0, 0, 100, 0, 100, 100, 0, 100];
      const result = polygonPerimeter(openSquare);

      // Should include edge from (0,100) back to (0,0)
      expect(result).toBe(400);
    });
  });

  describe('simplifyPoints', () => {
    it('should preserve straight line (no reduction)', () => {
      const line = [0, 0, 50, 50, 100, 100];
      const result = simplifyPoints(line, 1);

      expect(result).toEqual([0, 0, 100, 100]);
    });

    it('should remove collinear points', () => {
      const line = [0, 0, 10, 10, 20, 20, 30, 30, 40, 40, 50, 50];
      const result = simplifyPoints(line, 1);

      expect(result).toEqual([0, 0, 50, 50]);
    });

    it('should preserve zigzag pattern with tolerance 0', () => {
      const zigzag = [0, 0, 10, 10, 20, 0, 30, 10, 40, 0];
      const result = simplifyPoints(zigzag, 0);

      // With tolerance 0, points beyond 0 distance from line are preserved
      // Since zigzag points deviate from straight line, they're kept
      expect(result.length).toBeGreaterThan(2);
      expect(result).toContain(0); // Contains start point
      expect(result).toContain(40); // Contains end point
    });

    it('should preserve significant points with low tolerance', () => {
      const zigzag = [0, 0, 10, 20, 20, 0, 30, 20, 40, 0];
      const result = simplifyPoints(zigzag, 5);

      // High points (20 units) exceed 5-unit tolerance
      expect(result.length).toBeGreaterThan(2);
    });

    it('should return original for 2 points or fewer', () => {
      expect(simplifyPoints([0, 0], 1)).toEqual([0, 0]);
      expect(simplifyPoints([0, 0, 100, 100], 1)).toEqual([0, 0, 100, 100]);
    });

    it('should handle empty points', () => {
      expect(simplifyPoints([], 1)).toEqual([]);
    });

    it('should preserve endpoints', () => {
      const points = [0, 0, 10, 1, 20, 2, 30, 3, 40, 4, 50, 5];
      const result = simplifyPoints(points, 10);

      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[result.length - 2]).toBe(50);
      expect(result[result.length - 1]).toBe(5);
    });

    it('should apply recursive simplification', () => {
      const complex = [0, 0, 10, 10, 20, 5, 30, 15, 40, 10, 50, 0];
      const result = simplifyPoints(complex, 5);

      // Should keep significant deviations, drop near-collinear
      expect(result.length).toBeLessThan(complex.length);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getDashPattern', () => {
    it('should return dashed pattern', () => {
      const result = getDashPattern('dashed', 2);
      expect(result).toEqual([10, 5]);
    });

    it('should return dotted pattern scaled by stroke width', () => {
      const result1 = getDashPattern('dotted', 2);
      expect(result1).toEqual([2, 4]); // [strokeWidth, strokeWidth*2]

      const result2 = getDashPattern('dotted', 5);
      expect(result2).toEqual([5, 10]);
    });

    it('should return dash-dot pattern', () => {
      const result = getDashPattern('dash_dot', 3);
      expect(result).toEqual([10, 5, 3, 5]); // [10, 5, strokeWidth, 5]
    });

    it('should return undefined for solid line', () => {
      const result = getDashPattern('solid', 2);
      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown line style', () => {
      const result = getDashPattern('unknown' as any, 2);
      expect(result).toBeUndefined();
    });

    it('should handle zero stroke width for dotted', () => {
      const result = getDashPattern('dotted', 0);
      expect(result).toEqual([0, 0]);
    });

    it('should handle large stroke width', () => {
      const result = getDashPattern('dotted', 20);
      expect(result).toEqual([20, 40]);
    });
  });
});
