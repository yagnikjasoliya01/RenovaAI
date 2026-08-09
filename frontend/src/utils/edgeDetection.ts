/**
 * Edge Detection for Smart Snap
 * Detects edges in the image using a simplified Sobel operator
 */

export interface EdgeMap {
  width: number
  height: number
  data: Uint8Array // Edge strength at each pixel (0-255)
}

/**
 * Detect edges in an image using Sobel operator
 * Returns edge strength map for fast lookup
 */
export function detectEdges(
  imageData: ImageData,
  threshold: number = 30
): EdgeMap {
  const { width, height, data } = imageData
  const edges = new Uint8Array(width * height)

  // Convert to grayscale and apply Sobel operator
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sobel kernels for gradient calculation
      const gx =
        -1 * getGray(data, x - 1, y - 1, width) +
        1 * getGray(data, x + 1, y - 1, width) +
        -2 * getGray(data, x - 1, y, width) +
        2 * getGray(data, x + 1, y, width) +
        -1 * getGray(data, x - 1, y + 1, width) +
        1 * getGray(data, x + 1, y + 1, width)

      const gy =
        -1 * getGray(data, x - 1, y - 1, width) +
        -2 * getGray(data, x, y - 1, width) +
        -1 * getGray(data, x + 1, y - 1, width) +
        1 * getGray(data, x - 1, y + 1, width) +
        2 * getGray(data, x, y + 1, width) +
        1 * getGray(data, x + 1, y + 1, width)

      // Edge magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy)

      // Store edge strength (threshold to reduce noise)
      const idx = y * width + x
      edges[idx] = magnitude > threshold ? Math.min(255, magnitude) : 0
    }
  }

  return { width, height, data: edges }
}

/**
 * Get grayscale value at pixel position
 */
function getGray(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number
): number {
  const idx = (y * width + x) * 4
  // Grayscale: average RGB (ignore alpha)
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
}

/**
 * Find the nearest edge point within a search radius
 * Returns snapped point or original if no edge found
 * 
 * Less aggressive snapping - only snaps to strong, nearby edges
 * so users can still click where they want if not directly on an edge
 */
export function snapToEdge(
  point: [number, number],
  edgeMap: EdgeMap,
  searchRadius: number = 10 // Reduced from 15 to 10 pixels
): [number, number] {
  const [px, py] = point
  const { width, height, data } = edgeMap

  // Bounds check
  if (px < 0 || py < 0 || px >= width || py >= height) {
    return point
  }

  let maxStrength = 0
  let bestPoint: [number, number] = point

  // Search in a square around the point
  const minX = Math.max(0, Math.floor(px - searchRadius))
  const maxX = Math.min(width - 1, Math.ceil(px + searchRadius))
  const minY = Math.max(0, Math.floor(py - searchRadius))
  const maxY = Math.min(height - 1, Math.ceil(py + searchRadius))

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
      if (dist > searchRadius) continue

      const strength = data[y * width + x]

      // Weight by both edge strength and proximity
      // Heavily favor closer edges to avoid aggressive snapping
      const proximityWeight = 1 - (dist / searchRadius) ** 2 // Squared for more emphasis on proximity
      const score = strength * proximityWeight

      if (score > maxStrength) {
        maxStrength = score
        bestPoint = [x, y]
      }
    }
  }

  // Higher threshold - only snap to strong edges that are close
  // This prevents unwanted snapping to weak or distant edges
  if (maxStrength > 50) { // Increased from 30 to 50
    return bestPoint
  }

  return point
}
