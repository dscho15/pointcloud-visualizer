import * as THREE from 'three';
import { getCurrentZOffset } from './controls.js';

// Viridis colormap (256 values, from matplotlib)
const VIRIDIS = [[68, 1, 84],[68, 2, 86],[69, 4, 87],[69, 5, 89],[70, 7, 90],[70, 8, 92],[70, 10, 93],[70, 11, 94],[71, 13, 96],[71, 14, 97],[71, 16, 98],[71, 17, 99],[71, 19, 101],[72, 20, 102],[72, 22, 103],[72, 23, 104],[72, 24, 106],[72, 26, 107],[72, 27, 108],[72, 28, 109],[72, 30, 110],[72, 31, 111],[72, 33, 112],[72, 34, 113],[72, 35, 115],[72, 37, 116],[72, 38, 117],[72, 39, 118],[72, 41, 119],[71, 42, 120],[71, 44, 121],[71, 45, 122],[71, 46, 123],[71, 48, 124],[70, 49, 125],[70, 50, 126],[70, 52, 127],[69, 53, 128],[69, 54, 129],[69, 56, 130],[68, 57, 131],[68, 58, 132],[67, 60, 133],[67, 61, 134],[66, 62, 135],[66, 64, 135],[65, 65, 136],[65, 66, 137],[64, 68, 138],[64, 69, 139],[63, 70, 140],[62, 72, 140],[62, 73, 141],[61, 74, 142],[61, 76, 142],[60, 77, 143],[59, 78, 144],[59, 80, 144],[58, 81, 145],[57, 82, 146],[57, 84, 146],[56, 85, 147],[55, 86, 148],[55, 88, 148],[54, 89, 149],[53, 90, 149],[53, 92, 150],[52, 93, 151],[51, 94, 151],[51, 96, 152],[50, 97, 152],[49, 98, 153],[49, 100, 153],[48, 101, 154],[47, 102, 154],[47, 104, 155],[46, 105, 155],[45, 106, 156],[45, 108, 156],[44, 109, 157],[43, 110, 157],[43, 112, 158],[42, 113, 158],[41, 114, 158],[41, 116, 159],[40, 117, 159],[39, 118, 160],[39, 120, 160],[38, 121, 160],[37, 122, 161],[37, 124, 161],[36, 125, 161],[35, 126, 161],[35, 128, 162],[34, 129, 162],[33, 130, 162],[33, 132, 162],[32, 133, 163],[31, 134, 163],[31, 136, 163],[30, 137, 163],[29, 138, 163],[29, 140, 163],[28, 141, 163],[27, 142, 163],[27, 144, 163],[26, 145, 163],[25, 146, 163],[25, 148, 163],[24, 149, 163],[24, 150, 163],[23, 152, 163],[23, 153, 163],[22, 154, 163],[22, 156, 163],[21, 157, 163],[21, 158, 163],[20, 160, 163],[20, 161, 163],[19, 162, 163],[19, 164, 163],[18, 165, 163],[18, 166, 163],[17, 168, 163],[17, 169, 163],[16, 170, 163],[16, 172, 163],[15, 173, 163],[15, 174, 162],[15, 176, 162],[14, 177, 162],[14, 178, 162],[13, 180, 162],[13, 181, 161],[13, 182, 161],[13, 184, 161],[13, 185, 161],[13, 186, 160],[13, 188, 160],[13, 189, 160],[13, 190, 159],[13, 192, 159],[14, 193, 158],[14, 194, 158],[14, 196, 158],[15, 197, 157],[15, 198, 157],[16, 200, 156],[16, 201, 156],[17, 202, 155],[18, 204, 155],[18, 205, 154],[19, 206, 153],[20, 208, 153],[21, 209, 152],[22, 210, 151],[23, 211, 151],[24, 213, 150],[25, 214, 149],[26, 215, 149],[27, 217, 148],[28, 218, 147],[30, 219, 146],[31, 220, 146],[32, 222, 145],[34, 223, 144],[35, 224, 143],[37, 225, 142],[38, 226, 142],[40, 228, 141],[41, 229, 140],[43, 230, 139],[45, 231, 138],[46, 232, 137],[48, 233, 136],[50, 234, 135],[52, 235, 134],[54, 236, 133],[56, 237, 132],[58, 238, 131],[60, 239, 130],[62, 240, 129],[64, 241, 128],[66, 242, 127],[68, 243, 126],[70, 244, 125],[72, 245, 124],[74, 246, 123],[76, 247, 122],[78, 248, 121],[80, 249, 120],[82, 250, 119],[84, 251, 118],[86, 252, 117],[88, 253, 116],[90, 254, 115],[92, 255, 114]];
const detector_colors = {};


function getViridisColor(norm) {
  // Clamp norm to [0, 1]
  norm = Math.max(0, Math.min(1, norm));
  const idx = Math.floor(norm * (VIRIDIS.length - 1));
  const [r, g, b] = VIRIDIS[idx];
  return [r / 255, g / 255, b / 255];
}

let geometry, material;

export function createPointCloud(initialPoints, detector_id) 
{
  geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(flattenPoints(initialPoints));
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  // Compute colors by distance
  const colors = getColorByDetectorID(detector_id, initialPoints.length);
  // const colors = new Float32Array(getColorsByDistance(initialPoints));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  material = new THREE.PointsMaterial({
    size: 0.1, // Larger points
    vertexColors: true,
    sizeAttenuation: false, // Keep consistent size regardless of distance
  });

  return new THREE.Points(geometry, material);
}

export function updatePointCloud(pointCloud, newPoints, detector_id) 
{
  const flat = flattenPoints(newPoints);
  const newArray = new Float32Array(flat);

  if (newArray.length !== pointCloud.geometry.attributes.position.array.length) 
  {
    pointCloud.geometry.setAttribute('position', new THREE.BufferAttribute(newArray, 3));
    // Also update colors
    const colors = (getColorByDetectorID(detector_id, newPoints.length));
    // const colors = new Float32Array(getColorsByDistance(newPoints));
    pointCloud.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  } 
  else 
  {
    pointCloud.geometry.attributes.position.array.set(newArray);
    pointCloud.geometry.attributes.position.needsUpdate = true;
    // Update colors
    const colors = getColorByDetectorID(detector_id, newPoints.length);
    // const colors = getColorsByDistance(newPoints);
    pointCloud.geometry.attributes.color.array.set(colors);
    pointCloud.geometry.attributes.color.needsUpdate = true;
  }
  pointCloud.geometry.computeBoundingSphere();
}

function flattenPoints(points) {
  const zOffset = getCurrentZOffset();
  return points.map(pt => [pt[0], pt[1], pt[2] + zOffset]).flat();
}


function getColorByDetectorID(detector_id, numPoints) {
  let r, g, b;

  if (!detector_colors[detector_id]) {
    r = Math.random();
    g = Math.random();
    b = Math.random();
    detector_colors[detector_id] = [r, g, b];
  }
  else{
    [r, g, b] = detector_colors[detector_id];
  }

  const colors = new Float32Array(numPoints * 3);
  for (let i = 0; i < numPoints; i++) {
    colors[i * 3 + 0] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return colors;
}

// function getColorByDetectorID(detector_id) {
  
// }

function getColorsByDistance(points) {
  if (!points || points.length === 0) return [];
  // Compute distances
  const dists = points.map(pt => Math.sqrt(pt[0] ** 2 + pt[1] ** 2 + pt[2] ** 2));
  const min = Math.min(...dists);
  const max = Math.max(...dists);
  // Avoid division by zero
  const range = max - min || 1;
  // Map to colors
  return dists.map(d => getViridisColor((d - min) / range)).flat();
}
