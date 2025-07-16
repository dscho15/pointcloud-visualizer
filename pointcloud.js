import * as THREE from 'three';

let geometry, material;

export function createPointCloud(initialPoints) 
{
  geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(flattenPoints(initialPoints));
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

  material = new THREE.PointsMaterial({
    size: 0.05,
    color: 0x00ffcc,
  });

  return new THREE.Points(geometry, material);
}

export function updatePointCloud(pointCloud, newPoints) 
{
  const flat = flattenPoints(newPoints);
  const newArray = new Float32Array(flat);

  if (newArray.length !== pointCloud.geometry.attributes.position.array.length) {
    pointCloud.geometry.setAttribute('position', new THREE.BufferAttribute(newArray, 3));
  } else {
    pointCloud.geometry.attributes.position.array.set(newArray);
    pointCloud.geometry.attributes.position.needsUpdate = true;
  }
  pointCloud.geometry.computeBoundingSphere();
}

function flattenPoints(points) {
  return points.flat();
}
