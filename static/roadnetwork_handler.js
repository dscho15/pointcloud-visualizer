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

export function addLane(app_id, poly, width, type, reversed = false) {
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
        reversed,
        segments: buildLaneSegments(poly, width, type, reversed)
    };

    approach.lanes.push(lane);
}



function buildLaneSegments(points, width, type, reversed = false) {
    const halfWidth = width / 2;
    const segments = [];

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];

        const v0 = new THREE.Vector2(p0.x, p0.y);
        const v1 = new THREE.Vector2(p1.x, p1.y);

        // Always follow the drawing order: p0 → p1
        let start = v0;
        let end = v1;

        // If reversed, flip the direction
        if (reversed) {
            start = v1;
            end = v0;
        }

        // Direction vector (start -> end) - follows road drawing direction
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

// save drawn roadnetwork
export async function saveRoadNetwork() {
    try {
        console.log("Saving roadNetwork:", roadNetwork);
        const res = await fetch('/api/roadnet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roadNetwork)
        });

        if (!res.ok) {
            const errorData = await res.json();
            console.error("Failed to save roadnetwork:", errorData);
            // Show user-friendly error message
            if (errorData.detail?.error === 'no_intersection_selected') {
                alert("Please select an intersection before saving road network data.");
            } else {
                alert(`Failed to save road network: ${errorData.detail?.message || 'Unknown error'}`);
            }
            return false;
        }

        const result = await res.json();
        console.log("Roadnetwork saved successfully:", result);
        return true;

    } catch (error) {
        console.error("Error saving roadnetwork:", error);
        alert("Network error occurred while saving road network data.");
        return false;
    }
}


// load roadnetwork from server
export async function loadRoadNetwork(scene, roadnetData = null) {
    let data;
    try {
        if (!roadnetData) {  // TODO: add roadnet as input the correct places, now its always null
            const res = await fetch("/api/roadnet");
            if (!res.ok) {
                const errorData = await res.json();
                console.error("Failed to load roadnetwork:", errorData);
                return;
            }
            const responseData = await res.json();
            // Handle new server response format
            data = responseData.roadnet || responseData;
        } else {
            data = roadnetData;
        }
        console.log("Loaded roadNetwork:", data);
        if (!data || !data.Approaches) return;
    } catch (error) {
        console.error("Error loading roadnetwork:", error);
        return;
    }

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

                // Show direction arrows for loaded lanes
                visualizeLaneDirections(lane, scene);
            }
        });
    });

    updateRoadTreeUI();
}

export function clearRoadNetwork(sceneManager) {
    const scene = sceneManager.getScene();

    // Clear direction arrows
    clearAllArrows(scene);

    // Only remove meshes that are actually in roadMeshes array
    roadMeshes.forEach(obj => {
        if (obj && scene.children.includes(obj)) {
            scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                // If material is an array (multi-material mesh)
                if (Array.isArray(obj.material)) {
                    obj.material.forEach((mat) => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }
    });

    // Clear arrays
    roadMeshes.length = 0;
    polylines.length = 0;
    roadNetwork.Approaches.length = 0;
}

export function showAddLanePopup(poly, initialWidth, scene, onSave) {
    const popup = document.getElementById("add-lane-popup");
    popup.style.display = "block";

    const widthInput = document.getElementById("road-width-value");
    const typeInput = document.getElementById("lane-type");
    const approachInput = document.getElementById("lane-approach-id");
    const reversedInput = document.getElementById("lane-direction-reversed");
    const saveBtn = document.getElementById("lane-save-btn");

    // Prefill values
    widthInput.value = initialWidth;
    typeInput.value = "ingress";
    approachInput.value = "";
    reversedInput.checked = false;

    saveBtn.disabled = false;

    // Create a temporary preview mesh
    const curve = new THREE.CatmullRomCurve3(poly);
    let previewMesh = createRoadMeshFromSpline(curve, initialWidth, 100);
    scene.add(previewMesh);

    // Live update width while typing/changing
    widthInput.oninput = () => {
        const newWidth = parseFloat(widthInput.value);
        if (!newWidth || newWidth <= 0) return;

        // Remove old preview mesh and dispose of its resources
        if (previewMesh) {
            scene.remove(previewMesh);
            if (previewMesh.geometry) previewMesh.geometry.dispose();
            if (previewMesh.material) previewMesh.material.dispose();
            if (previewMesh._dashedLines) {
                previewMesh._dashedLines.forEach(line => {
                    scene.remove(line);
                    if (line.geometry) line.geometry.dispose();
                    if (line.material) line.material.dispose();
                });
            }
        }

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
        const reversed = reversedInput.checked;

        if (!app_id) {
            alert("Please enter a valid Approach ID");
            return;
        }

        onSave(app_id, poly, width, type, reversed);
        visualizeLaneDirections(
            roadNetwork.Approaches.find(a => a.app_id === app_id).lanes.slice(-1)[0],
            scene
        );
        cleanup();
    };
}




// Store arrows for cleanup
const laneArrows = new Map(); // lane_id -> arrow objects

export function visualizeLaneDirections(lane, scene) {
    // Clean up existing arrows for this lane
    if (laneArrows.has(lane.lane_id)) {
        laneArrows.get(lane.lane_id).forEach(arrow => scene.remove(arrow));
        laneArrows.delete(lane.lane_id);
    }

    const arrows = [];
    lane.segments.forEach(seg => {
        const [dx, dy] = seg.direction_vectors[0];
        const [mx, my] = seg.midpoint;

        const dir = new THREE.Vector3(dx, dy, 0).normalize();
        const origin = new THREE.Vector3(mx, my, 0.05); // Slightly above ground

        const length = 1.5;   // Smaller arrow size
        const color = 0xff0000; // Always red for consistency

        const arrow = new THREE.ArrowHelper(dir, origin, length, color, 0.4, 0.3);
        arrows.push(arrow);
        scene.add(arrow);
    });

    // Store arrows for this lane
    laneArrows.set(lane.lane_id, arrows);
}

// Clean up arrows for a specific lane
export function clearArrowsForLane(scene, lane_id) {
    if (laneArrows.has(lane_id)) {
        laneArrows.get(lane_id).forEach(arrow => scene.remove(arrow));
        laneArrows.delete(lane_id);
    }
}

// Clean up all arrows
export function clearAllArrows(scene) {
    laneArrows.forEach(arrows => {
        arrows.forEach(arrow => scene.remove(arrow));
    });
    laneArrows.clear();
}