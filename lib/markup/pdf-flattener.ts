import { PDFDocument, rgb, StandardFonts, PDFPage, pushGraphicsState, popGraphicsState, setDashPattern, moveTo, lineTo, closePath, stroke, fill } from 'pdf-lib';
import type { MarkupRecord } from './markup-types';
import { logger } from '@/lib/logger';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

function applyDashPattern(page: PDFPage, lineStyle: string, strokeWidth: number) {
  switch (lineStyle) {
    case 'dashed':
      page.pushOperators(setDashPattern([10, 5], 0));
      break;
    case 'dotted':
      page.pushOperators(setDashPattern([strokeWidth, strokeWidth * 2], 0));
      break;
    case 'dash_dot':
      page.pushOperators(setDashPattern([10, 5, strokeWidth, 5], 0));
      break;
    default:
      page.pushOperators(setDashPattern([], 0));
      break;
  }
}

function drawArrowhead(page: PDFPage, x: number, y: number, angle: number, size: number, color: { r: number; g: number; b: number }) {
  const a1 = angle + Math.PI * 0.85;
  const a2 = angle - Math.PI * 0.85;
  const x1 = x + size * Math.cos(a1);
  const y1 = y + size * Math.sin(a1);
  const x2 = x + size * Math.cos(a2);
  const y2 = y + size * Math.sin(a2);

  page.pushOperators(
    pushGraphicsState(),
    moveTo(x, y),
    lineTo(x1, y1),
    lineTo(x2, y2),
    closePath(),
    fill(),
    popGraphicsState()
  );
}

function drawRectangle(page: PDFPage, markup: MarkupRecord) {
  const { geometry, style } = markup;
  if (geometry.x == null || geometry.y == null || geometry.width == null || geometry.height == null) return;

  const c = hexToRgb(style.color);

  page.pushOperators(pushGraphicsState());
  applyDashPattern(page, style.lineStyle, style.strokeWidth);

  if (style.fillColor && style.fillOpacity && style.fillOpacity > 0) {
    const fc = hexToRgb(style.fillColor);
    page.drawRectangle({
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      color: rgb(fc.r, fc.g, fc.b),
      opacity: style.fillOpacity,
      borderColor: rgb(c.r, c.g, c.b),
      borderWidth: style.strokeWidth,
      borderOpacity: style.opacity,
    });
  } else {
    page.drawRectangle({
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
      borderColor: rgb(c.r, c.g, c.b),
      borderWidth: style.strokeWidth,
      borderOpacity: style.opacity,
    });
  }

  page.pushOperators(popGraphicsState());
}

function drawEllipse(page: PDFPage, markup: MarkupRecord) {
  const { geometry, style } = markup;
  if (geometry.x == null || geometry.y == null || geometry.width == null || geometry.height == null) return;

  const c = hexToRgb(style.color);
  const cx = geometry.x + geometry.width / 2;
  const cy = geometry.y + geometry.height / 2;

  page.drawEllipse({
    x: cx,
    y: cy,
    xScale: geometry.width / 2,
    yScale: geometry.height / 2,
    borderColor: rgb(c.r, c.g, c.b),
    borderWidth: style.strokeWidth,
    borderOpacity: style.opacity,
    color: style.fillColor ? rgb(...Object.values(hexToRgb(style.fillColor)) as [number, number, number]) : undefined,
    opacity: style.fillOpacity ?? 0,
  });
}

function drawLine(page: PDFPage, markup: MarkupRecord) {
  const { geometry, style } = markup;
  if (!geometry.points || geometry.points.length < 4) return;

  const c = hexToRgb(style.color);
  const pts = geometry.points;

  page.pushOperators(pushGraphicsState());
  applyDashPattern(page, style.lineStyle, style.strokeWidth);

  page.drawLine({
    start: { x: pts[0], y: pts[1] },
    end: { x: pts[pts.length - 2], y: pts[pts.length - 1] },
    color: rgb(c.r, c.g, c.b),
    thickness: style.strokeWidth,
    opacity: style.opacity,
  });

  // Draw arrowheads
  if (markup.shapeType === 'arrow' || geometry.arrowEnd === 'closed') {
    const dx = pts[pts.length - 2] - pts[pts.length - 4];
    const dy = pts[pts.length - 1] - pts[pts.length - 3];
    const angle = Math.atan2(dy, dx);
    drawArrowhead(page, pts[pts.length - 2], pts[pts.length - 1], angle, style.strokeWidth * 4, c);
  }

  page.pushOperators(popGraphicsState());
}

function drawPolyline(page: PDFPage, markup: MarkupRecord, closed: boolean) {
  const { geometry, style } = markup;
  if (!geometry.points || geometry.points.length < 4) return;

  const c = hexToRgb(style.color);
  const pts = geometry.points;

  page.pushOperators(pushGraphicsState());
  applyDashPattern(page, style.lineStyle, style.strokeWidth);

  // Build SVG path
  let path = `M ${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length; i += 2) {
    path += ` L ${pts[i]} ${pts[i + 1]}`;
  }
  if (closed) path += ' Z';

  if (style.fillColor && closed && style.fillOpacity && style.fillOpacity > 0) {
    const fc = hexToRgb(style.fillColor);
    page.drawSvgPath(path, {
      x: 0,
      y: 0,
      color: rgb(fc.r, fc.g, fc.b),
      opacity: style.fillOpacity,
      borderColor: rgb(c.r, c.g, c.b),
      borderWidth: style.strokeWidth,
      borderOpacity: style.opacity,
    });
  } else {
    page.drawSvgPath(path, {
      x: 0,
      y: 0,
      borderColor: rgb(c.r, c.g, c.b),
      borderWidth: style.strokeWidth,
      borderOpacity: style.opacity,
    });
  }

  page.pushOperators(popGraphicsState());
}

function drawFreehand(page: PDFPage, markup: MarkupRecord) {
  const { geometry, style } = markup;
  if (!geometry.points || geometry.points.length < 4) return;

  const c = hexToRgb(style.color);
  const pts = geometry.points;

  let path = `M ${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length; i += 2) {
    path += ` L ${pts[i]} ${pts[i + 1]}`;
  }

  page.pushOperators(pushGraphicsState());
  page.drawSvgPath(path, {
    x: 0,
    y: 0,
    borderColor: rgb(c.r, c.g, c.b),
    borderWidth: markup.shapeType === 'highlighter' ? style.strokeWidth * 5 : style.strokeWidth,
    borderOpacity: markup.shapeType === 'highlighter' ? 0.3 : style.opacity,
  });
  page.pushOperators(popGraphicsState());
}

async function drawText(page: PDFPage, markup: MarkupRecord, font: ReturnType<Awaited<ReturnType<typeof PDFDocument.load>>['embedFont']> extends Promise<infer T> ? T : never) {
  const { geometry, style, content } = markup;
  if (!content || geometry.x == null || geometry.y == null) return;

  const c = hexToRgb(style.color);
  const fontSize = style.fontSize ?? 14;

  page.drawText(content, {
    x: geometry.x,
    y: geometry.y,
    size: fontSize,
    font,
    color: rgb(c.r, c.g, c.b),
    opacity: style.opacity,
  });
}

function drawCloud(page: PDFPage, markup: MarkupRecord) {
  const { geometry, style } = markup;
  if (geometry.x == null || geometry.y == null || geometry.width == null || geometry.height == null) return;

  const c = hexToRgb(style.color);
  const { x, y, width, height } = geometry;
  const arcSize = 20;

  page.pushOperators(pushGraphicsState());

  // Build scalloped path along rectangle edges
  let path = '';
  const edges = [
    { sx: x, sy: y, ex: x + width, ey: y },
    { sx: x + width, sy: y, ex: x + width, ey: y + height },
    { sx: x + width, sy: y + height, ex: x, ey: y + height },
    { sx: x, sy: y + height, ex: x, ey: y },
  ];

  for (const edge of edges) {
    const dx = edge.ex - edge.sx;
    const dy = edge.ey - edge.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const numArcs = Math.max(1, Math.ceil(len / arcSize));
    const stepX = dx / numArcs;
    const stepY = dy / numArcs;

    for (let i = 0; i < numArcs; i++) {
      const px = edge.sx + stepX * i;
      const py = edge.sy + stepY * i;
      const nx = px + stepX;
      const ny = py + stepY;
      const mx = (px + nx) / 2 - stepY * 0.3;
      const my = (py + ny) / 2 + stepX * 0.3;

      if (i === 0 && path === '') {
        path += `M ${px} ${py}`;
      }
      path += ` Q ${mx} ${my} ${nx} ${ny}`;
    }
  }
  path += ' Z';

  page.drawSvgPath(path, {
    x: 0,
    y: 0,
    borderColor: rgb(c.r, c.g, c.b),
    borderWidth: style.strokeWidth,
    borderOpacity: style.opacity,
    color: style.fillColor ? rgb(...Object.values(hexToRgb(style.fillColor)) as [number, number, number]) : undefined,
    opacity: style.fillOpacity ?? 0,
  });

  page.pushOperators(popGraphicsState());
}

/**
 * Flatten markup annotations into a PDF document.
 * Returns the modified PDF as a Buffer.
 */
export async function flattenMarkupsIntoPdf(
  pdfBuffer: Buffer,
  markups: MarkupRecord[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // Group markups by page
  const byPage = new Map<number, MarkupRecord[]>();
  for (const m of markups) {
    const list = byPage.get(m.pageNumber) ?? [];
    list.push(m);
    byPage.set(m.pageNumber, list);
  }

  for (const [pageNum, pageMarkups] of byPage) {
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    for (const markup of pageMarkups) {
      try {
        switch (markup.shapeType) {
          case 'rectangle':
            drawRectangle(page, markup);
            break;
          case 'ellipse':
            drawEllipse(page, markup);
            break;
          case 'line':
          case 'arrow':
            drawLine(page, markup);
            break;
          case 'polyline':
            drawPolyline(page, markup, false);
            break;
          case 'polygon':
          case 'area_measurement':
          case 'perimeter_measurement':
            drawPolyline(page, markup, true);
            break;
          case 'freehand':
          case 'highlighter':
            drawFreehand(page, markup);
            break;
          case 'text_box':
          case 'callout':
          case 'typewriter':
            await drawText(page, markup, font);
            break;
          case 'cloud':
            drawCloud(page, markup);
            break;
          case 'distance_measurement':
            drawLine(page, markup);
            if (markup.content) {
              const pts = markup.geometry.points;
              if (pts && pts.length >= 4) {
                const midX = (pts[0] + pts[pts.length - 2]) / 2;
                const midY = (pts[1] + pts[pts.length - 1]) / 2;
                page.drawRectangle({
                  x: midX - 5,
                  y: midY - 3,
                  width: markup.content.length * 6 + 10,
                  height: 14,
                  color: rgb(1, 1, 1),
                  opacity: 0.8,
                });
                page.drawText(markup.content, {
                  x: midX,
                  y: midY,
                  size: 10,
                  font,
                  color: rgb(0, 0, 0),
                });
              }
            }
            break;
          default:
            logger.warn('PDF_FLATTENER', `Unsupported shape type: ${markup.shapeType}`);
        }
      } catch (err) {
        logger.error('PDF_FLATTENER', `Error drawing ${markup.shapeType}`, err as Error, { markupId: markup.id });
      }
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
