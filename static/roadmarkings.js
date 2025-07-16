import * as THREE from 'three';

let currentPoints = [];
let polylines = [];
let currentLine = null;

export function enableRoadMarkingDrawing(scene, camera, renderer) {
  renderer.domElement.addEventListener('pointerdown', (event) => {
    // Get mouse position in normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Raycast to the xy-plane (z=0)
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);

    currentPoints.push(point.clone());
    updateCurrentLine(scene);
  });

  renderer.domElement.addEventListener('dblclick', () => {
    if (currentPoints.length > 1) {
      // Interpolate a spline through all points (except endpoints)
      // Use CatmullRomCurve3 for smooth interpolation
      const curve = new THREE.CatmullRomCurve3(currentPoints);
      const numPoints = Math.max(50, currentPoints.length * 10);
      const splinePoints = curve.getPoints(numPoints);
      const geometry = new THREE.BufferGeometry().setFromPoints(splinePoints);
      const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      polylines.push(currentPoints.map(p => p.clone()));
    }
    // Remove the current drawing line
    if (currentLine) {
      scene.remove(currentLine);
      currentLine = null;
    }
    currentPoints = [];
  });
}

function updateCurrentLine(scene) {
  if (currentLine) scene.remove(currentLine);
  if (currentPoints.length < 2) return;
  const geometry = new THREE.BufferGeometry().setFromPoints(currentPoints);
  const material = new THREE.LineDashedMaterial({ color: 0xffff00, dashSize: 0.2, gapSize: 0.1 });
  currentLine = new THREE.Line(geometry, material);
  scene.add(currentLine);
}

export function getAllRoadMarkings() {
  return polylines;
}
