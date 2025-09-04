import * as THREE from 'three';
import { createRoadMeshFromSpline, roadMeshes, polylines } from './roadmarkings.js';
export let roadNetwork = {
  Approaches: []
};


export function updateRoadTreeUI() {
  const treeDiv = document.getElementById("road-tree");
  treeDiv.innerHTML = "";
  roadNetwork.Approaches.forEach(app => {
    const appDiv = document.createElement("div");
    appDiv.innerHTML = `<b>Approach ${app.app_id}</b>`;
    app.lanes.forEach(lane => {
      const laneDiv = document.createElement("div");
      laneDiv.style.marginLeft = "20px";
      laneDiv.textContent = `Lane ${lane.lane_id} (${lane.type}), width: ${lane.width}`;
      appDiv.appendChild(laneDiv);
    });
    treeDiv.appendChild(appDiv);
  });
}

export function addLane(app_id, poly, width, type) {
  let approach = roadNetwork.Approaches.find(a => a.app_id === app_id);
  
  // If approach doesn't exist yet, create it
  if (!approach) {
    approach = { app_id, lanes: [] };
    roadNetwork.Approaches.push(approach);
  }

  const lane_id = approach.lanes.length;
  const lane = {
    lane_id,
    type,
    width,
    segments: buildLaneSegments(poly, width, type)
  };

  approach.lanes.push(lane);
}



function buildLaneSegments(points, width, type) {
  const halfWidth = width / 2;
  const segments = [];
  const origin = new THREE.Vector2(0, 0);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    const v0 = new THREE.Vector2(p0.x, p0.y);
    const v1 = new THREE.Vector2(p1.x, p1.y);

    // Find which endpoint is closer to origin
    const d0 = v0.distanceTo(origin);
    const d1 = v1.distanceTo(origin);

    let start, end;
    if (type === "ingress") {
      // arrow should point *towards* origin → end = closer point
      start = d0 < d1 ? v1 : v0;
      end   = d0 < d1 ? v0 : v1;
    } else {
      // arrow should point *away* from origin → start = closer point
      start = d0 < d1 ? v0 : v1;
      end   = d0 < d1 ? v1 : v0;
    }

    // Direction vector (start -> end)
    const dir = new THREE.Vector2().subVectors(end, start).normalize();

    // Normal (perpendicular)
    const normal = new THREE.Vector2(-dir.y, dir.x).normalize();

    // Offsets
    const left0 = [start.x + normal.x * halfWidth, start.y + normal.y * halfWidth];
    const right0 = [start.x - normal.x * halfWidth, start.y - normal.y * halfWidth];
    const left1 = [end.x + normal.x * halfWidth, end.y + normal.y * halfWidth];
    const right1 = [end.x - normal.x * halfWidth, end.y - normal.y * halfWidth];

    // Segment polygon (quad)
    const polygon = [left0, left1, right1, right0];

    // Midpoint for visualization
    const mid = [(start.x + end.x) / 2, (start.y + end.y) / 2];

    segments.push({
      polygon,
      direction_vectors: [[dir.x, dir.y]],
      midpoint: mid
    });
  }

  return segments;
}



// function getAllRoadMarkings() {
//   return roadNetwork
// }

// save drawn roadnetwork
export async function saveRoadNetwork() {
  console.log("Saving roadNetwork:", roadNetwork);
  await fetch('/api/roadnet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(roadNetwork)
  });
}


// load roadnetwork from server
export async function loadRoadNetwork(scene, roadnetData = null) {
  if (!roadnetData) {  // TODO: add roadnet as input the correct places, now its always null
    const res = await fetch("/api/roadnet");
    roadnetData = await res.json();
  }
  
  const res = await fetch('/api/roadnet');
  const data = await res.json();
  console.log("Loaded roadNetwork:", data);
  if (!data || !data.Approaches) return;

  // restore roadNetwork
  roadNetwork = data;

  // rebuild meshes for each lane
  data.Approaches.forEach(app => {
    app.lanes.forEach(lane => {
      const poly = []; 
      // reconstruct lane centerline from segment polygons (take midpoints of left/right)
      lane.segments.forEach(seg => {
        const [l0, l1, r1, r0] = seg.polygon;
        const mid0 = [(l0[0] + r0[0]) / 2, (l0[1] + r0[1]) / 2];
        const mid1 = [(l1[0] + r1[0]) / 2, (l1[1] + r1[1]) / 2];
        if (poly.length === 0) poly.push(new THREE.Vector3(mid0[0], mid0[1], 0));
        poly.push(new THREE.Vector3(mid1[0], mid1[1], 0));
      });

      if (poly.length > 1) {
        const curve = new THREE.CatmullRomCurve3(poly);
        const mesh = createRoadMeshFromSpline(curve, lane.width, 100);
        mesh.userData = { lane_id: lane.lane_id, app_id: app.app_id, type: lane.type };
        scene.add(mesh);
        roadMeshes.push(mesh);
        polylines.push(poly);
      }
    });
  });

  updateRoadTreeUI();
}

export function clearRoadNetwork(sceneManager) {
  const scene = sceneManager.getScene();
  roadMeshes.forEach(obj => {
      scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
  });
  const toRemove = [];

  // Collect all meshes
  scene.traverse((obj) => {
    if (obj.isMesh || obj.isLine) toRemove.push(obj);
  });

  toRemove.forEach((mesh) => {
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      // If material is an array (multi-material mesh)
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    if (mesh.parent) mesh.parent.remove(mesh);
  });

  // Clear array without reassigning
  roadMeshes.length = 0;

  // If you also track polylines, reset them
  polylines.length = 0;
  roadNetwork.Approaches.length = 0;
  sceneManager.getScene().add(sceneManager.getObjects().gridHelper);
}

export function showAddLanePopup(poly, initialWidth, scene, onSave) {
  const popup = document.getElementById("add-lane-popup");
  popup.style.display = "block";

  const widthInput = document.getElementById("road-width-value");
  const typeInput = document.getElementById("lane-type");
  const approachInput = document.getElementById("lane-approach-id");
  const saveBtn = document.getElementById("lane-save-btn");

  // Prefill values
  widthInput.value = initialWidth;
  typeInput.value = "ingress";
  approachInput.value = "";

  saveBtn.disabled = false;

  // Create a temporary preview mesh
  const curve = new THREE.CatmullRomCurve3(poly);
  let previewMesh = createRoadMeshFromSpline(curve, initialWidth, 100);
  scene.add(previewMesh);

  // Live update width while typing/changing
  widthInput.oninput = () => {
    const newWidth = parseFloat(widthInput.value);
    if (!newWidth || newWidth <= 0) return;

  

    previewMesh = createRoadMeshFromSpline(curve, newWidth, 100);
    scene.add(previewMesh);
  };

  // Cleanup on save/close
  const cleanup = () => {
    popup.style.display = "none";
    saveBtn.onclick = null;
    widthInput.oninput = null;

  };


  // Save handler
  saveBtn.onclick = () => {
    const app_id = parseInt(approachInput.value, 10);
    const type = typeInput.value;
    const width = parseFloat(widthInput.value);
    if (!app_id) {
      alert("Please enter a valid Approach ID");
      return;
    }

    onSave(app_id, poly, width, type);
    visualizeLaneDirections(
      roadNetwork.Approaches.find(a => a.app_id === app_id).lanes.slice(-1)[0],
      scene
    );
    cleanup();
  };
}




function visualizeLaneDirections(lane, scene) {
  lane.segments.forEach(seg => {
    const [dx, dy] = seg.direction_vectors[0];
    const [mx, my] = seg.midpoint;

    const dir = new THREE.Vector3(dx, dy, 0).normalize();
    const origin = new THREE.Vector3(mx, my, 0);

    const length = 2;   // arrow size, scale as needed
    const color = lane.type === "ingress" ? 0xff0000 : 0x0000ff; // red = ingress, blue = egress

    const arrow = new THREE.ArrowHelper(dir, origin, length, color, 0.5, 0.5);
    scene.add(arrow);
  });
}