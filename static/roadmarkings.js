import * as THREE from 'three';
import { getCurrentRoadWidth } from './controls.js';

let currentPoints = [];
let polylines = [];
let roadMeshes = [];
let currentLine = null;
let selectedRoadIndex = null;

export function enableRoadMarkingDrawing(scene, camera, renderer) {
  // (Removed rotateCameraAroundPoint and orbitcontrols integration as requested)
  // Store point marker meshes for current drawing
  let pointMarkers = [];

  // Make clearPointMarkers accessible outside this function
  window.__clearRoadPointMarkers = clearPointMarkers;
  function clearPointMarkers() {
    for (const marker of pointMarkers) scene.remove(marker);
    pointMarkers = [];
  }

  // Keyboard shortcuts now trigger button clicks
  window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
      const btn = document.getElementById('reset-road-btn');
      if (btn) btn.click();
    } else if (event.key === 'n') {
      const btn = document.getElementById('new-road-btn');
      if (btn) btn.click();
    } else if (event.key === 'e') {
      const btn = document.getElementById('edit-road-btn');
      if (btn) btn.click();
    } else if (event.key === 'd') {
      const btn = document.getElementById('delete-road-btn');
      if (btn) btn.click();
    }
  });
// --- Keybinds Help Menu ---
function createKeybindsMenu() {
  if (document.getElementById('keybinds-menu')) return;
  const menu = document.createElement('div');
  menu.id = 'keybinds-menu';
  menu.style.position = 'fixed';
  menu.style.top = '10px';
  menu.style.right = '10px';
  menu.style.background = 'rgba(30,30,30,0.95)';
  menu.style.color = '#fff';
  menu.style.padding = '14px 18px';
  menu.style.borderRadius = '8px';
  menu.style.fontSize = '15px';
  menu.style.zIndex = 10000;
  menu.style.boxShadow = '0 2px 12px #0008';
  menu.innerHTML = `
    <b>Keybinds</b><br>
    <span style="color:#ffd700">N</span>: New Road<br>
    <span style="color:#ffd700">R</span>: Reset Drawing<br>
    <span style="color:#ffd700">E</span>: Edit Road<br>
    <span style="color:#ffd700">D</span>: Delete Road<br>
    <span style="color:#ffd700">Right Click</span>: Add Point<br>
    <span style="color:#ffd700">Double Click</span>: Finish Road<br>
    <hr style="border:1px solid #444; margin:8px 0;">
    <span style="font-size:13px; color:#aaa">You can close this menu with <b>?</b></span>
  `;
  document.body.appendChild(menu);
  // Toggle menu with ?
  window.addEventListener('keydown', (e) => {
    if (e.key === '?') {
      menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
    }
  });
}
createKeybindsMenu();

  renderer.domElement.addEventListener('pointerdown', (event) => {
    // Only respond to right mouse button (event.button === 2)
    if (event.button !== 2) return;
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

    // (Removed shift+click camera rotation as requested)

    // Merge with existing point if within 0.003 units (0.3 cm)
    let merged = false;
    for (let i = 0; i < currentPoints.length; i++) {
      if (point.distanceTo(currentPoints[i]) < 0.003) {
        // Snap to existing point
        point.copy(currentPoints[i]);
        merged = true;
        break;
      }
    }
    if (!merged) {
      currentPoints.push(point.clone());
      // Draw a small sphere at each clicked point
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      marker.position.copy(point);
      scene.add(marker);
      pointMarkers.push(marker);
      updateCurrentLine(scene);
    }
  });

  renderer.domElement.addEventListener('dblclick', () => {
    if (currentPoints.length > 1) {
      // Use current width from UI
      const width = getCurrentRoadWidth ? getCurrentRoadWidth() : 0.06;
      const curve = new THREE.CatmullRomCurve3(currentPoints);
      const roadMesh = createRoadMeshFromSpline(curve, width, 100);
      roadMesh.userData.width = width;
      scene.add(roadMesh);
      polylines.push(currentPoints.map(p => p.clone()));
      roadMeshes.push(roadMesh);
      selectRoad(polylines.length - 1, scene);
    }
    // Remove the current drawing line and point markers
    if (currentLine) {
      scene.remove(currentLine);
      currentLine = null;
    }
    clearPointMarkers();
    currentPoints = [];
    updateRoadUI();
  });
}

// --- Ribbon/Road mesh from spline ---
function createRoadMeshFromSpline(curve, width = 0.06, segments = 100, getHeight = null) {
  const halfWidth = width / 2;
  const points = curve.getPoints(segments);
  const leftSide = [];
  const rightSide = [];
  const uvs = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // Get tangent for direction
    const t = curve.getTangent(i / (points.length - 1));
    // 2D normal (perpendicular in xy)
    const normal = new THREE.Vector3(-t.y, t.x, 0).normalize();
    // Optionally follow terrain
    let height = 0;
    if (getHeight) height = getHeight(p.x, p.y);
    // Center point
    const center = new THREE.Vector3(p.x, p.y, getHeight ? height : p.z);
    // Offset left/right
    leftSide.push(center.clone().add(normal.clone().multiplyScalar(halfWidth)));
    rightSide.push(center.clone().add(normal.clone().multiplyScalar(-halfWidth)));
    // UVs: u = 0 (left), 1 (right); v = along road
    uvs.push([0, i / (points.length - 1)]);
    uvs.push([1, i / (points.length - 1)]);
  }

  // Build geometry for the road surface
  const positions = [];
  const uvArray = [];
  for (let i = 0; i < leftSide.length - 1; i++) {
    // Quad: left[i], left[i+1], right[i+1], right[i]
    // First triangle
    positions.push(...leftSide[i].toArray(), ...leftSide[i + 1].toArray(), ...rightSide[i + 1].toArray());
    uvArray.push(...uvs[2 * i], ...uvs[2 * (i + 1)], ...uvs[2 * (i + 1) + 1]);
    // Second triangle
    positions.push(...leftSide[i].toArray(), ...rightSide[i + 1].toArray(), ...rightSide[i].toArray());
    uvArray.push(...uvs[2 * i], ...uvs[2 * (i + 1) + 1], ...uvs[2 * i + 1]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
  geometry.computeVertexNormals();

  // Road color: dark gray
  const material = new THREE.MeshStandardMaterial({
    color: 0x222222,
    side: THREE.DoubleSide,
    metalness: 0.2,
    roughness: 0.7,
  });

  // --- Dashed lines on each side (road edge markings) ---
  const dashedLines = [];
  function makeDashedLine(pointsArr) {
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pointsArr);
    // Compute line distances for dashes
    const line = new THREE.Line(lineGeom, new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 1.2,
      gapSize: 0.7,
      linewidth: 2,
    }));
    // This is required for dashed lines to show up
    line.computeLineDistances();
    line.material.needsUpdate = true;
    return line;
  }
  const leftLine = makeDashedLine(leftSide);
  const rightLine = makeDashedLine(rightSide);
  dashedLines.push(leftLine, rightLine);

  const mesh = new THREE.Mesh(geometry, material);
  // Add dashed lines to scene when mesh is added
  mesh._dashedLines = dashedLines;
  mesh._dashedLinesAdded = false;
  mesh.onBeforeRender = function(renderer, scene) {
    if (!mesh._dashedLinesAdded) {
      for (const l of dashedLines) {
        scene.add(l);
      }
      mesh._dashedLinesAdded = true;
    }
  };
  mesh.onAfterRender = function(renderer, scene) {
    // Remove dashed lines if mesh is removed from scene
    if (mesh._dashedLinesAdded && !scene.children.includes(mesh)) {
      for (const l of dashedLines) {
        if (scene.children.includes(l)) scene.remove(l);
      }
      mesh._dashedLinesAdded = false;
    }
  };

  return mesh;
}
    // Remove the current drawing line
    if (currentLine) {
      scene.remove(currentLine);
      currentLine = null;
    }
    currentPoints = [];
    // updateRoadUI();
// Selection and UI logic
function selectRoad(index, scene) {
  if (selectedRoadIndex !== null && roadMeshes[selectedRoadIndex]) {
    // Remove highlight from previous
    roadMeshes[selectedRoadIndex].material.emissive = undefined;
    roadMeshes[selectedRoadIndex].material.color.set(0x222222); // Reset to road color
  }
  selectedRoadIndex = index;
  if (roadMeshes[selectedRoadIndex]) {
    // Highlight selected (slightly lighter gray, not blue)
    roadMeshes[selectedRoadIndex].material.emissive = new THREE.Color(0x444444);
    roadMeshes[selectedRoadIndex].material.color.set(0x444444);
    // --- Add width UI sync for selected road ---
    const slider = document.getElementById('road-width-slider');
    const valueBox = document.getElementById('road-width-value');
    if (slider && valueBox && roadMeshes[selectedRoadIndex].userData.width) {
      slider.value = roadMeshes[selectedRoadIndex].userData.width;
      valueBox.value = roadMeshes[selectedRoadIndex].userData.width;
    }
    // Listen for width changes and update mesh
    if (slider && valueBox) {
      // Remove previous listeners
      slider.oninput = valueBox.oninput = null;
      const updateWidth = (val) => {
        const w = parseFloat(val);
        if (!w || w < 0.01 || w > 0.2) return;
        // Remove old mesh and dashed lines
        const oldMesh = roadMeshes[selectedRoadIndex];
        if (oldMesh._dashedLines) {
          for (const l of oldMesh._dashedLines) if (scene.children.includes(l)) scene.remove(l);
        }
        scene.remove(oldMesh);
        // Recreate mesh with new width
        const curve = new THREE.CatmullRomCurve3(polylines[selectedRoadIndex]);
        const newMesh = createRoadMeshFromSpline(curve, w, 100);
        newMesh.userData.width = w;
        scene.add(newMesh);
        roadMeshes[selectedRoadIndex] = newMesh;
        selectRoad(selectedRoadIndex, scene); // Reselect to update UI
      };
      slider.oninput = (e) => { valueBox.value = e.target.value; updateWidth(e.target.value); };
      valueBox.oninput = (e) => { slider.value = e.target.value; updateWidth(e.target.value); };
    }
  }
  updateRoadUI();
}

function deleteSelectedRoad(scene) {
  if (selectedRoadIndex !== null && roadMeshes[selectedRoadIndex]) {
    // Remove dashed lines from scene if present
    const mesh = roadMeshes[selectedRoadIndex];
    if (mesh._dashedLines) {
      for (const l of mesh._dashedLines) {
        if (scene.children.includes(l)) scene.remove(l);
      }
    }
    scene.remove(mesh);
    roadMeshes[selectedRoadIndex] = null;
    polylines[selectedRoadIndex] = null;
    selectedRoadIndex = null;
    updateRoadUI();
  }
}

function updateRoadUI() {
  const delBtn = document.getElementById('delete-road-btn');
  const editBtn = document.getElementById('edit-road-btn');
  const status = document.getElementById('road-status');
  const n = polylines.filter(p => p).length;
  delBtn.disabled = selectedRoadIndex === null;
  editBtn.disabled = selectedRoadIndex === null;
  status.textContent = n + ' road' + (n === 1 ? '' : 's');
}

// Click to select road
function enableRoadSelection(scene, camera, renderer) {
  renderer.domElement.addEventListener('pointerdown', (event) => {
    const mouse = new THREE.Vector2(
      ((event.clientX - renderer.domElement.getBoundingClientRect().left) / renderer.domElement.clientWidth) * 2 - 1,
      -((event.clientY - renderer.domElement.getBoundingClientRect().top) / renderer.domElement.clientHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    let found = false;
    for (let i = 0; i < roadMeshes.length; i++) {
      if (!roadMeshes[i]) continue;
      const intersects = raycaster.intersectObject(roadMeshes[i]);
      if (intersects.length > 0) {
        selectRoad(i, scene);
        found = true;
        break;
      }
    }
    if (!found) {
      selectRoad(null, scene);
    }
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
  return polylines.filter(p => p);
}


// Expose for main.js
function deleteSelectedRoadPublic(scene) {
  deleteSelectedRoad(scene);
}

function setupRoadUI(scene, camera, renderer) {
  document.getElementById('delete-road-btn').onclick = () => deleteSelectedRoad(scene);
  document.getElementById('edit-road-btn').onclick = () => {
    // Edit mode (future)
    alert('Edit mode not implemented yet.');
  };
  document.getElementById('new-road-btn').onclick = () => {
    // Deselect current, allow new road drawing
    selectRoad(null, scene);
    // Clear currentPoints, remove preview line and point markers
    currentPoints = [];
    if (currentLine) {
      scene.remove(currentLine);
      currentLine = null;
    }
    if (typeof clearPointMarkers === 'function') clearPointMarkers();
  };
  // Add a reset button if not present
  let resetBtn = document.getElementById('reset-road-btn');
  if (!resetBtn) {
    resetBtn = document.createElement('button');
    resetBtn.id = 'reset-road-btn';
    resetBtn.style.display = 'none';
    document.body.appendChild(resetBtn);
  }
  resetBtn.onclick = () => {
    currentPoints = [];
    if (currentLine) { scene.remove(currentLine); currentLine = null; }
    // Remove all cached point markers (force global clear)
    if (window.__clearRoadPointMarkers) window.__clearRoadPointMarkers();
    updateRoadUI();
  };
  enableRoadSelection(scene, camera, renderer);
  updateRoadUI();
}

export { setupRoadUI, deleteSelectedRoadPublic };
