import * as THREE from 'three';

export function addOBB(scene, { center, size, rotation }) {
  const [sx, sy, sz] = size;
  const boxGeometry = new THREE.BoxGeometry(sx, sy, sz);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });

  const obbMesh = new THREE.Mesh(boxGeometry, material);

  const rotationMatrix = new THREE.Matrix4().fromArray([
    rotation[0], rotation[1], rotation[2], 0,
    rotation[3], rotation[4], rotation[5], 0,
    rotation[6], rotation[7], rotation[8], 0,
    0,           0,           0,           1,
  ]);

  const position = new THREE.Vector3(center[0], center[1], center[2]);
  obbMesh.applyMatrix4(rotationMatrix);
  obbMesh.position.copy(position);

  scene.add(obbMesh);
}
