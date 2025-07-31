import * as THREE from 'three';

export function updateHeatmap(data, heatmapTexture) {
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
const arr_len = 0.3; 
const arr_head_len = 0.1; 
const arr_head_w = 0.1


export function updateHeading({ width, _, data }, headingVisible, scene) {
    // Clear existing arrows
    headingArrows.forEach(arrow => scene.remove(arrow));
    headingArrows.length = 0;

    const worldMin = -100;
    const resolution = 0.25;

    for (let i = 0; i < data.length; i++) {
        const dx = data[i][0];
        const dy = data[i][1];

        const mag = Math.hypot(dx, dy);
        if (mag < 0.01) continue; // skip zero vectors

        const gridX = i % width;
        const gridY = Math.floor(i / width);

        const worldX = worldMin + gridX * resolution;
        const worldY = worldMin + gridY * resolution;

        const origin = new THREE.Vector3(worldX, worldY, 0.05);
        const dir = new THREE.Vector3(dx, dy, 0).normalize();

        const arrow = new THREE.ArrowHelper(dir, origin, arr_len, 0x105222, arr_head_len, arr_head_w);
        arrow.visible = headingVisible;
        scene.add(arrow);
        headingArrows.push(arrow);
    }
    }

export function updateAvgSpeed({ width, height, data }, speedTexture) {
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

export function updateMaxSpeed({ width, height, data }, speedTexture) {
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




