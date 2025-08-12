import * as THREE from 'three';
import { getCurrentZOffset } from './controls.js';

// Viridis colormap (256 values, from matplotlib)
const VIRIDIS = [[68, 1, 84],[68, 2, 86],[69, 4, 87],[69, 5, 89],[70, 7, 90],[70, 8, 92],[70, 10, 93],[70, 11, 94],[71, 13, 96],[71, 14, 97],[71, 16, 98],[71, 17, 99],[71, 19, 101],[72, 20, 102],[72, 22, 103],[72, 23, 104],[72, 24, 106],[72, 26, 107],[72, 27, 108],[72, 28, 109],[72, 30, 110],[72, 31, 111],[72, 33, 112],[72, 34, 113],[72, 35, 115],[72, 37, 116],[72, 38, 117],[72, 39, 118],[72, 41, 119],[71, 42, 120],[71, 44, 121],[71, 45, 122],[71, 46, 123],[71, 48, 124],[70, 49, 125],[70, 50, 126],[70, 52, 127],[69, 53, 128],[69, 54, 129],[69, 56, 130],[68, 57, 131],[68, 58, 132],[67, 60, 133],[67, 61, 134],[66, 62, 135],[66, 64, 135],[65, 65, 136],[65, 66, 137],[64, 68, 138],[64, 69, 139],[63, 70, 140],[62, 72, 140],[62, 73, 141],[61, 74, 142],[61, 76, 142],[60, 77, 143],[59, 78, 144],[59, 80, 144],[58, 81, 145],[57, 82, 146],[57, 84, 146],[56, 85, 147],[55, 86, 148],[55, 88, 148],[54, 89, 149],[53, 90, 149],[53, 92, 150],[52, 93, 151],[51, 94, 151],[51, 96, 152],[50, 97, 152],[49, 98, 153],[49, 100, 153],[48, 101, 154],[47, 102, 154],[47, 104, 155],[46, 105, 155],[45, 106, 156],[45, 108, 156],[44, 109, 157],[43, 110, 157],[43, 112, 158],[42, 113, 158],[41, 114, 158],[41, 116, 159],[40, 117, 159],[39, 118, 160],[39, 120, 160],[38, 121, 160],[37, 122, 161],[37, 124, 161],[36, 125, 161],[35, 126, 161],[35, 128, 162],[34, 129, 162],[33, 130, 162],[33, 132, 162],[32, 133, 163],[31, 134, 163],[31, 136, 163],[30, 137, 163],[29, 138, 163],[29, 140, 163],[28, 141, 163],[27, 142, 163],[27, 144, 163],[26, 145, 163],[25, 146, 163],[25, 148, 163],[24, 149, 163],[24, 150, 163],[23, 152, 163],[23, 153, 163],[22, 154, 163],[22, 156, 163],[21, 157, 163],[21, 158, 163],[20, 160, 163],[20, 161, 163],[19, 162, 163],[19, 164, 163],[18, 165, 163],[18, 166, 163],[17, 168, 163],[17, 169, 163],[16, 170, 163],[16, 172, 163],[15, 173, 163],[15, 174, 162],[15, 176, 162],[14, 177, 162],[14, 178, 162],[13, 180, 162],[13, 181, 161],[13, 182, 161],[13, 184, 161],[13, 185, 161],[13, 186, 160],[13, 188, 160],[13, 189, 160],[13, 190, 159],[13, 192, 159],[14, 193, 158],[14, 194, 158],[14, 196, 158],[15, 197, 157],[15, 198, 157],[16, 200, 156],[16, 201, 156],[17, 202, 155],[18, 204, 155],[18, 205, 154],[19, 206, 153],[20, 208, 153],[21, 209, 152],[22, 210, 151],[23, 211, 151],[24, 213, 150],[25, 214, 149],[26, 215, 149],[27, 217, 148],[28, 218, 147],[30, 219, 146],[31, 220, 146],[32, 222, 145],[34, 223, 144],[35, 224, 143],[37, 225, 142],[38, 226, 142],[40, 228, 141],[41, 229, 140],[43, 230, 139],[45, 231, 138],[46, 232, 137],[48, 233, 136],[50, 234, 135],[52, 235, 134],[54, 236, 133],[56, 237, 132],[58, 238, 131],[60, 239, 130],[62, 240, 129],[64, 241, 128],[66, 242, 127],[68, 243, 126],[70, 244, 125],[72, 245, 124],[74, 246, 123],[76, 247, 122],[78, 248, 121],[80, 249, 120],[82, 250, 119],[84, 251, 118],[86, 252, 117],[88, 253, 116],[90, 254, 115],[92, 255, 114]];
const JET = [[0, 0, 127], [0, 0, 131], [0, 0, 135], [0, 0, 139], [0, 0, 143], [0, 0, 147],[0, 0, 151], [0, 0, 155], [0, 0, 159], [0, 0, 163], [0, 0, 167], [0, 0, 171],[0, 0, 175], [0, 0, 179], [0, 0, 183], [0, 0, 187], [0, 0, 191], [0, 0, 195],[0, 0, 199], [0, 0, 203], [0, 0, 207], [0, 0, 211], [0, 0, 215], [0, 0, 219],[0, 0, 223], [0, 0, 227], [0, 0, 231], [0, 0, 235], [0, 0, 239], [0, 0, 243],[0, 0, 247], [0, 0, 251], [0, 0, 255], [0, 4, 255], [0, 8, 255], [0, 12, 255],[0, 16, 255], [0, 20, 255], [0, 24, 255], [0, 28, 255], [0, 32, 255], [0, 36, 255],[0, 40, 255], [0, 44, 255], [0, 48, 255], [0, 52, 255], [0, 56, 255], [0, 60, 255],[0, 64, 255], [0, 68, 255], [0, 72, 255], [0, 76, 255], [0, 80, 255], [0, 84, 255],[0, 88, 255], [0, 92, 255], [0, 96, 255], [0, 100, 255], [0, 104, 255], [0, 108, 255],[0, 112, 255], [0, 116, 255], [0, 120, 255], [0, 124, 255], [0, 128, 255], [0, 132, 255],[0, 136, 255], [0, 140, 255], [0, 144, 255], [0, 148, 255], [0, 152, 255], [0, 156, 255],[0, 160, 255], [0, 164, 255], [0, 168, 255], [0, 172, 255], [0, 176, 255], [0, 180, 255],[0, 184, 255], [0, 188, 255], [0, 192, 255], [0, 196, 255], [0, 200, 255], [0, 204, 255],[0, 208, 255], [0, 212, 255], [0, 216, 255], [0, 220, 255], [0, 224, 255], [0, 228, 255],[0, 232, 255], [0, 236, 255], [0, 240, 255], [0, 244, 255], [0, 248, 255], [0, 252, 255],[0, 255, 255], [0, 255, 251], [0, 255, 247], [0, 255, 243], [0, 255, 239], [0, 255, 235],[0, 255, 231], [0, 255, 227], [0, 255, 223], [0, 255, 219], [0, 255, 215], [0, 255, 211],[0, 255, 207], [0, 255, 203], [0, 255, 199], [0, 255, 195], [0, 255, 191], [0, 255, 187],[0, 255, 183], [0, 255, 179], [0, 255, 175], [0, 255, 171], [0, 255, 167], [0, 255, 163],[0, 255, 159], [0, 255, 155], [0, 255, 151], [0, 255, 147], [0, 255, 143], [0, 255, 139],[0, 255, 135], [0, 255, 131], [0, 255, 127], [0, 255, 123], [0, 255, 119], [0, 255, 115],[0, 255, 111], [0, 255, 107], [0, 255, 103], [0, 255, 99], [0, 255, 95], [0, 255, 91],[0, 255, 87], [0, 255, 83], [0, 255, 79], [0, 255, 75], [0, 255, 71], [0, 255, 67],[0, 255, 63], [0, 255, 59], [0, 255, 55], [0, 255, 51], [0, 255, 47], [0, 255, 43],[0, 255, 39], [0, 255, 35], [0, 255, 31], [0, 255, 27], [0, 255, 23], [0, 255, 19],[0, 255, 15], [0, 255, 11], [0, 255, 7], [0, 255, 3], [0, 255, 0], [4, 255, 0], [8, 255, 0], [12, 255, 0], [16, 255, 0], [20, 255, 0], [24, 255, 0], [28, 255, 0],[32, 255, 0], [36, 255, 0], [40, 255, 0], [44, 255, 0], [48, 255, 0], [52, 255, 0],[56, 255, 0], [60, 255, 0], [64, 255, 0], [68, 255, 0], [72, 255, 0], [76, 255, 0],[80, 255, 0], [84, 255, 0], [88, 255, 0], [92, 255, 0], [96, 255, 0], [100, 255, 0],[104, 255, 0], [108, 255, 0], [112, 255, 0], [116, 255, 0], [120, 255, 0], [124, 255, 0],[128, 255, 0], [132, 255, 0], [136, 255, 0], [140, 255, 0], [144, 255, 0], [148, 255, 0],[152, 255, 0], [156, 255, 0], [160, 255, 0], [164, 255, 0], [168, 255, 0], [172, 255, 0],[176, 255, 0], [180, 255, 0], [184, 255, 0], [188, 255, 0], [192, 255, 0], [196, 255, 0],[200, 255, 0], [204, 255, 0], [208, 255, 0], [212, 255, 0], [216, 255, 0], [220, 255, 0],[224, 255, 0], [228, 255, 0], [232, 255, 0], [236, 255, 0], [240, 255, 0], [244, 255, 0],[248, 255, 0], [252, 255, 0], [255, 251, 0], [255, 247, 0], [255, 243, 0], [255, 239, 0],[255, 235, 0], [255, 231, 0], [255, 227, 0], [255, 223, 0], [255, 219, 0], [255, 215, 0],[255, 211, 0], [255, 207, 0], [255, 203, 0], [255, 199, 0], [255, 195, 0], [255, 191, 0],[255, 187, 0], [255, 183, 0], [255, 179, 0], [255, 175, 0], [255, 171, 0], [255, 167, 0],[255, 163, 0], [255, 159, 0], [255, 155, 0], [255, 151, 0], [255, 147, 0], [255, 143, 0],[255, 139, 0], [255, 135, 0], [255, 131, 0], [255, 127, 0]];

// const detector_colors = {};


function getViridisColor(norm) {
  // Clamp norm to [0, 1]
  norm = Math.max(0, Math.min(1, norm));
  const idx = Math.floor(norm * (JET.length - 1));
  const [r, g, b] = JET[idx];
  return [r / 255, g / 255, b / 255];
}

// Cache z-offset to avoid frequent function calls
let cachedZOffset = 0;
let zOffsetCacheTime = 0;

export function createPointCloud(initialPoints, options = {}) 
{
  const {
    pointType = 'foreground', // 'foreground' or 'background'
    size = null,              // Custom point size
    opacity = null,           // Custom opacity
    colorMap = 'jet'          // Color map selection
  } = options;

  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(flattenPoints(initialPoints));
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  // Compute colors by height
  const colorsArray = getColorsByHeight(initialPoints, colorMap);
  const colors = new Float32Array(colorsArray);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Differentiate material properties based on point type
  const materialConfig = getMaterialConfig(pointType, size, opacity);
  const material = new THREE.PointsMaterial(materialConfig);

  const pointCloud = new THREE.Points(geometry, material);
  
  // Store metadata for efficient updates
  pointCloud.userData = {
    lastUpdateTime: Date.now(),
    pointCount: initialPoints.length,
    heightRange: getHeightRange(initialPoints),
    lastDataHash: hashPointCloudData(initialPoints),
    pointType: pointType,
    colorMap: colorMap
  };

  return pointCloud;
}

export function updatePointCloud(pointCloud, newPoints) 
{
  if (!newPoints || newPoints.length === 0) return;
  
  const now = Date.now();
  const timeSinceUpdate = now - (pointCloud.userData?.lastUpdateTime || 0);
  const pointType = pointCloud.userData?.pointType || 'foreground';
  
  // Different throttling for background vs foreground
  const updateThreshold = getUpdateThreshold(pointType);
  if (timeSinceUpdate < updateThreshold) return;
  
  // Check if data actually changed using a simple hash
  const dataHash = hashPointCloudData(newPoints);
  if (pointCloud.userData.lastDataHash === dataHash) {
    pointCloud.userData.lastUpdateTime = now; // Update timestamp to prevent spam
    return; // No actual change in data
  }
  
  // For background: additional check for significant changes only
  if (pointType === 'background' && !hasSignificantChange(pointCloud, newPoints, dataHash)) {
    pointCloud.userData.lastUpdateTime = now;
    return;
  }
  
  const flat = flattenPoints(newPoints);
  const newArray = new Float32Array(flat);
  const needsResize = newArray.length !== pointCloud.geometry.attributes.position.array.length;

    if (needsResize) {
    // Size changed - recreate buffers
    pointCloud.geometry.setAttribute('position', new THREE.BufferAttribute(newArray, 3));
    const colorsArray = getColorsByHeightOptimized(newPoints, null, pointCloud.userData.colorMap);
    const colors = new Float32Array(colorsArray);
    pointCloud.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pointCloud.geometry.computeBoundingSphere();
    
    // Update metadata
    pointCloud.userData.pointCount = newPoints.length;
    pointCloud.userData.heightRange = getHeightRange(newPoints);
  } 
  else {
    // Same size - check if position data actually changed
    const oldArray = pointCloud.geometry.attributes.position.array;
    let positionsChanged = false;
    
    // Quick check: compare a few sample points for significant changes
    const samplePoints = Math.min(10, newPoints.length);
    for (let i = 0; i < samplePoints; i++) {
      const idx = Math.floor(i * newPoints.length / samplePoints) * 3;
      if (Math.abs(oldArray[idx] - newArray[idx]) > 0.001 ||
          Math.abs(oldArray[idx + 1] - newArray[idx + 1]) > 0.001 ||
          Math.abs(oldArray[idx + 2] - newArray[idx + 2]) > 0.001) {
        positionsChanged = true;
        break;
      }
    }
    
    if (positionsChanged) {
      pointCloud.geometry.attributes.position.array.set(newArray);
      pointCloud.geometry.attributes.position.needsUpdate = true;
    }
    
    // Color update logic varies by point type
    const newHeightRange = getHeightRange(newPoints);
    const shouldUpdateColors = shouldUpdatePointCloudColors(pointCloud, newPoints, newHeightRange);
    if (shouldUpdateColors) {
      const colorsArray = getColorsByHeightOptimized(newPoints, newHeightRange, pointCloud.userData.colorMap);
      const colors = new Float32Array(colorsArray);
      pointCloud.geometry.attributes.color.array.set(colors);
      pointCloud.geometry.attributes.color.needsUpdate = true;
      pointCloud.userData.heightRange = newHeightRange;
    }
  }
  
  // Update metadata
  pointCloud.userData.lastUpdateTime = now;
  pointCloud.userData.lastDataHash = dataHash;
}

function flattenPoints(points) {
  // Cache z-offset for 100ms to avoid excessive function calls
  const now = Date.now();
  if (now - zOffsetCacheTime > 100) {
    cachedZOffset = getCurrentZOffset();
    zOffsetCacheTime = now;
  }
  
  // Single loop optimization instead of map + flat
  const result = new Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const baseIdx = i * 3;
    result[baseIdx] = pt[0];
    result[baseIdx + 1] = pt[1];
    result[baseIdx + 2] = pt[2] + cachedZOffset;
  }
  return result;
}

// Get height range for dynamic color scaling
function getHeightRange(points) {
  if (!points || points.length === 0) return { min: 0, max: 10 };
  
  let min = points[0][2];
  let max = points[0][2];
  
  for (let i = 1; i < points.length; i++) {
    const height = points[i][2];
    if (height < min) min = height;
    if (height > max) max = height;
  }
  
  return { min, max };
}

// Fast hash function to detect data changes
function hashPointCloudData(points) {
  if (!points || points.length === 0) return 0;
  
  let hash = 0;
  // Sample a subset of points for hashing to balance performance vs accuracy
  const sampleSize = Math.min(50, points.length);
  const step = Math.floor(points.length / sampleSize) || 1;
  
  for (let i = 0; i < points.length; i += step) {
    const pt = points[i];
    // Simple hash combining x, y, z coordinates
    hash = ((hash << 5) - hash + (pt[0] * 1000 | 0)) | 0;
    hash = ((hash << 5) - hash + (pt[1] * 1000 | 0)) | 0;
    hash = ((hash << 5) - hash + (pt[2] * 1000 | 0)) | 0;
  }
  
  return hash;
}

// Get material configuration based on point type
function getMaterialConfig(pointType, customSize = null, customOpacity = null) {
  const baseConfig = {
    vertexColors: true,
    sizeAttenuation: false,
  };

  switch (pointType) {
    case 'foreground':
      return {
        ...baseConfig,
        size: customSize || 0.12,        // Slightly larger for foreground
        opacity: customOpacity || 1.0,   // Fully opaque
        transparent: false
      };
    
    case 'background':
      return {
        ...baseConfig,
        size: customSize || 0.08,        // Smaller for background
        opacity: customOpacity || 0.6,   // More transparent
        transparent: true,
        depthWrite: false                // Don't write to depth buffer to avoid z-fighting
      };
    
    default:
      return {
        ...baseConfig,
        size: customSize || 0.1,
        opacity: customOpacity || 1.0,
        transparent: customOpacity !== null && customOpacity < 1.0
      };
  }
}

// Optimized color calculation with optional pre-computed range and color map
function getColorsByHeightOptimized(points, heightRange = null, colorMap = 'jet') {
  if (!points || points.length === 0) return [];
  
  const range = heightRange || getHeightRange(points);
  const rangeSize = range.max - range.min || 1;
  
  // Select color palette
  const palette = getColorPalette(colorMap);
  
  // Pre-allocate result array
  const result = new Array(points.length * 3);
  
  for (let i = 0; i < points.length; i++) {
    const norm = Math.max(0, Math.min(1, (points[i][2] - range.min) / rangeSize));
    const colorIdx = Math.floor(norm * (palette.length - 1));
    const [r, g, b] = palette[colorIdx];
    
    const baseIdx = i * 3;
    result[baseIdx] = r / 255;
    result[baseIdx + 1] = g / 255;
    result[baseIdx + 2] = b / 255;
  }
  
  return result;
}

// Get color palette based on selection
function getColorPalette(colorMap) {
  switch (colorMap) {
    case 'viridis':
      return VIRIDIS;
    case 'jet':
    default:
      return JET;
  }
}

// Get appropriate update threshold based on point type
function getUpdateThreshold(pointType) {
  switch (pointType) {
    case 'foreground':
      return 16;        // 60 FPS for dynamic objects
    case 'background':
      return 500;       // 2 FPS for static environment (much less frequent)
    default:
      return 33;        // 30 FPS default
  }
}

// Check if background point cloud has significant changes worth updating
function hasSignificantChange(pointCloud, newPoints, newDataHash) {
  const userData = pointCloud.userData;
  const pointType = userData.pointType;
  
  // Always allow foreground updates
  if (pointType !== 'background') return true;
  
  // For background, check multiple criteria for significance
  const timeSinceLastUpdate = Date.now() - userData.lastUpdateTime;
  const forceUpdateInterval = 10000; // Force update every 10 seconds max
  
  // Force update if too much time has passed
  if (timeSinceLastUpdate > forceUpdateInterval) return true;
  
  // Check if point count changed significantly (>5%)
  const pointCountChange = Math.abs(newPoints.length - userData.pointCount) / userData.pointCount;
  if (pointCountChange > 0.05) return true;
  
  // Check if height range changed significantly (background environments don't change height much)
  const newHeightRange = getHeightRange(newPoints);
  const oldRange = userData.heightRange || { min: 0, max: 10 };
  const heightRangeChange = Math.abs(newHeightRange.max - newHeightRange.min) - Math.abs(oldRange.max - oldRange.min);
  if (Math.abs(heightRangeChange) > 2.0) return true; // Larger threshold for background
  
  // Check hash difference strength (simple collision detection)
  const hashDifference = Math.abs(newDataHash - userData.lastDataHash);
  if (hashDifference < 1000) return false; // Very similar data, skip update
  
  return false; // Default: skip background update
}

// Determine if colors should be updated based on point type and changes
function shouldUpdatePointCloudColors(pointCloud, newPoints, newHeightRange) {
  const userData = pointCloud.userData;
  const pointType = userData.pointType;
  const oldRange = userData.heightRange || { min: 0, max: 10 };
  
  if (pointType === 'foreground') {
    // Foreground: update colors if height range changed moderately
    return (Math.abs(newHeightRange.min - oldRange.min) > 0.5 || 
            Math.abs(newHeightRange.max - oldRange.max) > 0.5);
  } else if (pointType === 'background') {
    // Background: only update colors if height range changed significantly
    return (Math.abs(newHeightRange.min - oldRange.min) > 2.0 || 
            Math.abs(newHeightRange.max - oldRange.max) > 2.0);
  }
  
  // Default behavior
  return (Math.abs(newHeightRange.min - oldRange.min) > 0.5 || 
          Math.abs(newHeightRange.max - oldRange.max) > 0.5);
}



// Legacy function kept for compatibility - now uses optimized version
function getColorsByHeight(points, colorMap = 'jet') {
  return getColorsByHeightOptimized(points, null, colorMap);
}
