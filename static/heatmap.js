import * as THREE from 'three';
import { getHeadingVisible } from './ui-controls.js';

const heatmap_resolution = 0.5;
const world_min = -100.0;
const world_max = 100.0;
const max_speed_possible = 130;

const heatmap_width = (world_max - world_min) / heatmap_resolution;
const heatmap_height = heatmap_width;
const CHANNELS = 5; // heat, head_x, head_y, avg_speed, max_speed

// One big flat array: size = width * height * channels
let heatmap_grid = new Float32Array(heatmap_width * heatmap_height * CHANNELS);
let global_max_heat = 1e-6; // Track max heat incrementally

const prev_obb_by_id = {};

// World → grid coords
function world_to_grid(x, y) {
    return [
        Math.floor((x - world_min) / heatmap_resolution),
        Math.floor((y - world_min) / heatmap_resolution)
    ];
}

// Flat array index
function idx(x, y, c) {
    return (y * heatmap_width + x) * CHANNELS + c;
}

// ----------------------------
// Main Update
// ----------------------------
export function updateHeatmap(boxes, sceneObjects, scene) {
    const alpha = 0.2;
    const box_list = boxes["boxes"];
    const timestamp = boxes["timestamp"];
    const track_ids = boxes["track_ids"];

    box_list.forEach((box, idxBox) => {
        const [x, y, , box_w, box_d, , theta] = box;

        const obj_head_x = Math.cos(theta);
        const obj_head_y = Math.sin(theta);

        // Speed calculation
        const track_id = track_ids[idxBox];
        const prev = prev_obb_by_id[track_id];
        let speed = 0.0;
        if (prev) {
            const dt = timestamp - prev.time;
            if (dt > 0) {
                const dx = x - prev.x;
                const dy = y - prev.y;
                speed = Math.hypot(dx, dy) / dt;
            }
        }
        prev_obb_by_id[track_id] = { x, y, time: timestamp };

        // Iterate over covered cells
        const step = heatmap_resolution / 2;
        const cosTheta = obj_head_x;
        const sinTheta = obj_head_y;

        for (let localX = -box_w / 2; localX <= box_w / 2; localX += step) {
            for (let localY = -box_d / 2; localY <= box_d / 2; localY += step) {
                const rotatedX = localX * cosTheta - localY * sinTheta;
                const rotatedY = localX * sinTheta + localY * cosTheta;

                const worldX = x + rotatedX;
                const worldY = y + rotatedY;

                const [gridX, gridY] = world_to_grid(worldX, worldY);
                if (gridX >= 0 && gridX < heatmap_width &&
                    gridY >= 0 && gridY < heatmap_height) {

                    const countIdx = idx(gridX, gridY, 0);
                    const headXIdx = countIdx + 1;
                    const headYIdx = countIdx + 2;
                    const avgSpeedIdx = countIdx + 3;
                    const maxSpeedIdx = countIdx + 4;

                    // Update heat
                    heatmap_grid[countIdx] += 1;
                    if (heatmap_grid[countIdx] > global_max_heat) {
                        global_max_heat = heatmap_grid[countIdx];
                    }

                    // Update heading
                    heatmap_grid[headXIdx] = (1 - alpha) * heatmap_grid[headXIdx] + alpha * obj_head_x;
                    heatmap_grid[headYIdx] = (1 - alpha) * heatmap_grid[headYIdx] + alpha * obj_head_y;

                    // Update avg speed
                    const count = heatmap_grid[countIdx];
                    heatmap_grid[avgSpeedIdx] = (heatmap_grid[avgSpeedIdx] * (count - 1) + speed) / count;

                    // Update max speed
                    heatmap_grid[maxSpeedIdx] = Math.max(heatmap_grid[maxSpeedIdx], speed);
                }
            }
        }
    });

    updateHeat(extractHeat(), sceneObjects.heatmapTexture);
    updateHeading({ data: extractHeading(), width: heatmap_width }, scene);
}

// ----------------------------
// Texture Updates
// ----------------------------
function updateHeat(data, heatmapTexture) {
    if (!heatmapTexture) return;

    const texData = heatmapTexture.image.data;
    for (let i = 0; i < data.length; i++) {
        const v = data[i];
        texData[i * 4 + 0] = 255;
        texData[i * 4 + 1] = 0;
        texData[i * 4 + 2] = 0;
        texData[i * 4 + 3] = v;
    }
    heatmapTexture.needsUpdate = true;
}

// ----------------------------
// Arrow Pool for Heading
// ----------------------------
const headingArrows = [];
let arrowPoolSize = 0;
const arr_len = 0.5, arr_head_len = 0.2, arr_head_w = 0.3;

export function updateHeading(heading_data, scene) {
    const headingVisible = getHeadingVisible();
    if (!heading_data || !heading_data.data) return;

    const { width, data } = heading_data;
    const worldMin = world_min;
    const resolution = heatmap_resolution;
    const stride = 4;

    let arrowIndex = 0;

    for (let i = 0; i < data.length; i++) {
        const gridX = i % width;
        const gridY = Math.floor(i / width);
        if (gridX % stride !== 0 || gridY % stride !== 0) continue;

        const [dx, dy] = data[i];
        const mag = Math.hypot(dx, dy);
        if (mag < 0.01) continue;

        const worldX = worldMin + gridX * resolution;
        const worldY = worldMin + gridY * resolution;
        const origin = new THREE.Vector3(worldX, worldY, 0.05);
        const dir = new THREE.Vector3(dx, dy, 0).normalize();

        let arrow;
        if (arrowIndex < arrowPoolSize) {
            arrow = headingArrows[arrowIndex];
            arrow.position.copy(origin);
            arrow.setDirection(dir);
        } else {
            arrow = new THREE.ArrowHelper(dir, origin, arr_len, 0x105222, arr_head_len, arr_head_w);
            headingArrows.push(arrow);
            arrowPoolSize++;
            scene.add(arrow);
        }
        arrow.visible = headingVisible;
        arrowIndex++;
    }

    for (let i = arrowIndex; i < arrowPoolSize; i++) {
        headingArrows[i].visible = false;
    }
}

// ----------------------------
// Data Extraction
// ----------------------------
function extractHeat() {
    const heatList = new Uint8Array(heatmap_width * heatmap_height);
    const invMax = 255 / global_max_heat;

    for (let i = 0; i < heatList.length; i++) {
        const v = heatmap_grid[i * CHANNELS];
        heatList[i] = Math.round(Math.min(255, v * invMax));
    }
    return heatList;
}

function extractHeading() {
    const headingList = new Array(heatmap_width * heatmap_height);
    for (let i = 0; i < headingList.length; i++) {
        headingList[i] = [
            heatmap_grid[i * CHANNELS + 1],
            heatmap_grid[i * CHANNELS + 2]
        ];
    }
    return headingList;
}
