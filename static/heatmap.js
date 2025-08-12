import * as THREE from 'three';
import { getHeadingVisible } from './ui-controls.js';

const heatmap_resolution = 0.5;  
const world_min = -100.0;
const world_max = 100.0;
const max_speed_possible = 130;
const heatmap_width = (world_max - world_min) / heatmap_resolution;
const heatmap_height = heatmap_width;  
const prev_obb_by_id = {}

// Initialize 3D heatmap grid: [height][width][5]
let heatmap_grid = Array.from({ length: heatmap_height }, () =>
  Array.from({ length: heatmap_width }, () => [0, 0, 0, 0, 0])
);


function world_to_grid(x, y) {
    const grid_x = (x - world_min) / heatmap_resolution;
    const grid_y = (y - world_min) / heatmap_resolution;
    return [Math.floor(grid_x), Math.floor(grid_y)];
}
    

export function updateHeatmap(boxes, sceneObjects, scene) {
    const alpha = 0.2;
    const box_list = boxes["boxes"]
    const timestamp = boxes["timestamp"];
    const track_ids = boxes["track_ids"];
    box_list.forEach((box, idx) => {

        // For each obb, add weight to occupied area on heatmap 
        const [x, y, , box_w, box_d, , theta] = box;
        
        const [grid_x, grid_y ]= world_to_grid(x, y);

        const occ_area_x = Math.max(1, Math.floor(box_w / heatmap_resolution));
        const occ_area_y = Math.max(1, Math.floor(box_d / heatmap_resolution));

        const start_x = grid_x - occ_area_x; // 2
        const start_y = grid_y - occ_area_y; // 2
        
        // Find object heading to update heatmap heading 
        const obj_head_x = Math.cos(theta);
        const obj_head_y = Math.sin(theta);
        
        // Calc speed: 
        const track_id = track_ids[idx];
        const prev = prev_obb_by_id[track_id];
        const speed = 0.0;
        if (prev){
            const dt = timestamp - prev["time"];
            if (dt > 0){
                const dx = x - prev["x"];
                const dy = y - prev["y"];
                speed = Math.hypot(dx, dy) / dt  // m/s
            }
                
        }
        prev_obb_by_id[track_id] = { x, y, time: timestamp };

        const step = heatmap_resolution / 2;

        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);

        for (let localX = -box_w / 2; localX <= box_w / 2; localX += step) {
        for (let localY = -box_d / 2; localY <= box_d / 2; localY += step) {
            // Rotate point by theta
            const rotatedX = localX * cosTheta - localY * sinTheta;
            const rotatedY = localX * sinTheta + localY * cosTheta;

            // Translate to world position
            const worldX = x + rotatedX;
            const worldY = y + rotatedY;

            // Map to grid
            const [gridX, gridY] = world_to_grid(worldX, worldY);

            if (
            gridX >= 0 && gridX < heatmap_width &&
            gridY >= 0 && gridY < heatmap_height
            ) {
            const cell = heatmap_grid[gridY][gridX];
            cell[0] += 1.0;

            const acc_head_x = cell[1];
            const acc_head_y = cell[2];

            cell[1] = (1 - alpha) * acc_head_x + alpha * obj_head_x;
            cell[2] = (1 - alpha) * acc_head_y + alpha * obj_head_y;
            cell[3] = (cell[3] * (cell[0] - 1) + speed) / cell[0];
            cell[4] = Math.max(cell[4], speed);
            }
        }
        }
    });
    
    updateHeat(extractHeat(), sceneObjects.heatmapTexture);
    updateHeading({ data: extractHeading(), width: heatmap_width }, scene);
    // updateAvgSpeed(extractAvgSpeed(), sceneObjects.avgSpeedTexture);
    // updateMaxSpeed(extractMaxSpeed(), sceneObjects.maxSpeedTexture);
}


function updateHeat(data, heatmapTexture) {
    if (!heatmapTexture) return;

    for (let i = 0; i < data.length; i++) {
        const v = data[i]; // already normalized to 0–255
        heatmapTexture.image.data[i * 4 + 0] = 255;   // Red
        heatmapTexture.image.data[i * 4 + 1] = 0;   // Green
        heatmapTexture.image.data[i * 4 + 2] = 0;   // Blue
        heatmapTexture.image.data[i * 4 + 3] = v; // Full opacity
    }

    heatmapTexture.needsUpdate = true;
}

const headingArrows = []; // store arrows for cleanup
const arr_len = 0.5; 
const arr_head_len = 0.2; 
const arr_head_w = 0.3;


export function updateHeading(heading_data, scene) {
    // Clear existing arrows
    const headingVisible = getHeadingVisible();
    headingArrows.forEach(arrow => scene.remove(arrow));
    headingArrows.length = 0;

    // If no data provided, just clear arrows
    if (!heading_data || !heading_data.data) return;

    const { width, data } = heading_data;
    // Use the same coordinate system as the main heatmap
    const worldMin = world_min;  // -100
    const resolution = heatmap_resolution;  // 0.5

    const stride = 4; // Draw every 4th cell in both X and Y

    for (let i = 0; i < data.length; i++) {
        const gridX = i % width;
        const gridY = Math.floor(i / width);

        // Skip cells not on the stride
        if (gridX % stride !== 0 || gridY % stride !== 0) continue;

        const [dx, dy] = data[i];
        const mag = Math.hypot(dx, dy);
        if (mag < 0.01) continue; // skip zero vectors

        const worldX = worldMin + gridX * resolution;
        const worldY = worldMin + gridY * resolution;

        const origin = new THREE.Vector3(worldX, worldY, 0.05); // Position above the heatmap plane
        const dir = new THREE.Vector3(dx, dy, 0).normalize();

        const arrow = new THREE.ArrowHelper(dir, origin, arr_len, 0x105222, arr_head_len, arr_head_w);
        arrow.visible = headingVisible;
        scene.add(arrow);
        headingArrows.push(arrow);
    }
}



function updateAvgSpeed(data , speedTexture) {
    if (!speedTexture) return;

    for (let i = 0; i < data.length; i++) {
        const v = data[i];
    
        if (v === 0) {
            speedTexture.image.data[i * 4 + 0] = 0;
            speedTexture.image.data[i * 4 + 1] = 0;
            speedTexture.image.data[i * 4 + 2] = 0;
            speedTexture.image.data[i * 4 + 3] = 0;
            continue;
        }
    
        const [r, g, b] = blueToRedColormap(v);
        speedTexture.image.data[i * 4 + 0] = r;
        speedTexture.image.data[i * 4 + 1] = g;
        speedTexture.image.data[i * 4 + 2] = b;
        speedTexture.image.data[i * 4 + 3] = 255; // full opacity
    }
    speedTexture.needsUpdate = true;
}

function updateMaxSpeed(data, speedTexture) {
    if (!speedTexture) return;

    for (let i = 0; i < data.length; i++) {
        const v = data[i];
    
        if (v === 0) {
            // No data — make pixel fully transparent
        
            speedTexture.image.data[i * 4 + 0] = 0;
            speedTexture.image.data[i * 4 + 1] = 0;
            speedTexture.image.data[i * 4 + 2] = 0;
            speedTexture.image.data[i * 4 + 3] = 0;
            continue;
        }
    
        const [r, g, b] = blueToRedColormap(v);
        speedTexture.image.data[i * 4 + 0] = r;
        speedTexture.image.data[i * 4 + 1] = g;
        speedTexture.image.data[i * 4 + 2] = b;
        speedTexture.image.data[i * 4 + 3] = 255; // full opacity
    }
    speedTexture.needsUpdate = true;
}
    
function blueToRedColormap(v) {
    const maxSpeed = 130; // upper limit of expected speed
    const t = Math.min(v / maxSpeed, 1); // clamp to [0,1]
    const r = Math.round(255 * (1 - t)); // red decreases
    const g = 0;
    const b = Math.round(255 * t);       // blue increases
    return [r, g, b];
}




function extractHeat(){
    const height = heatmap_grid.length;
    const width = heatmap_grid[0].length;

    // Extract first channel
    const heatOnly = heatmap_grid.map(row => row.map(cell => cell[0]));

    // Max value for normalization
    let maxVal = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
        if (heatOnly[y][x] > maxVal) {
            maxVal = heatOnly[y][x];
        }
        }
    }
    maxVal += 1e-6; // avoid division by zero

    // Normalize and flatten
    const heatmapList = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
        const normalized = Math.min(
            255,
            Math.max(0, (heatOnly[y][x] / maxVal) * 255)
        );
        heatmapList.push(Math.round(normalized));
        }
    }
    return heatmapList
}

function extractHeading(){
    const height = heatmap_grid.length;
    const width = heatmap_grid[0].length;

    const headingList = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
        const cell = heatmap_grid[y][x];
        headingList.push([cell[1], cell[2]]); // channels 1 and 2
        }
    }

    return headingList;
}

function extractAvgSpeed(){
    const height = heatmap_grid.length;
    const width = heatmap_grid[0].length;

    const speed_list = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
        const cell = heatmap_grid[y][x];
        speed_list.push(cell[4]);
        }
    }
    return speed_list;
}

function extractMaxSpeed(){
    const height = heatmap_grid.length;
    const width = heatmap_grid[0].length;

    const speed_list = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
        const cell = heatmap_grid[y][x];
        speed_list.push(cell[4]);
        }
    }
    return speed_list;
}
