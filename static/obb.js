import * as THREE from 'three';


const obbMap = {};

// Color palette per class_id (define more if needed)
const class_palettes = {
  0: ['#BCBFFA', '#9196F7', '#666EF4', "#3B45F1", "#111CEE", "#0E16C7", "#0B1299"],   // Cars: blue
  1: ['#7FDC7F', '#5BD25B', '#37C837', '#2ca02c', '#238023', '#14532d', "#25DA25"],   // Bikes: Green 
  2: ['#F23A3A', '#E30E0E', '#EA7171', '#E44949', '#DE2121', '#A61919', "#8E1515"],   // Pedestrians: Red
};

const track_colors = {}; 
const assigned_colors = new Set(); 
const track_to_detector = {};

function getRandomColorFromPalette(class_id) {
  const palette = class_palettes[class_id] || ['#aaaaaa']; // fallback gray
  const availableColors = palette.filter(color => !assigned_colors.has(color));
  const color = availableColors.length > 0
    ? availableColors[Math.floor(Math.random() * availableColors.length)]
    : palette[Math.floor(Math.random() * palette.length)];

  assigned_colors.add(color);
  return new THREE.Color(color);
}


function hexFromTHREEColor(color) {
  return '#' + color.getHexString();
}

export function addOBBtoPointcloud(pointCloud, obbData) {
  const {boxes, detector_id, class_ids, track_ids} = obbData; 

  if (!pointCloud) return;

  // Clear existing OBBs for that detector
  if (obbMap[detector_id]) {
    obbMap[detector_id].forEach(mesh => pointCloud.remove(mesh));
  }
  obbMap[detector_id] = [];
  const activeTrackIds = new Set();

  boxes.forEach(([x, y, z, dx, dy, dz, theta], i) => {
    const track_id = track_ids[i]
    const class_id = class_ids[i]
    activeTrackIds.add(track_id);
    track_to_detector[track_id] = detector_id;
    
    if (!track_colors[track_id]) {
      track_colors[track_id] = getRandomColorFromPalette(class_id)
    }
    
    const color = track_colors[track_id]

    const geometry = new THREE.BoxGeometry(dx, dy, dz);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });

    const obbMesh = new THREE.Mesh(geometry, material);

    // Rotate around Z, set position relative to PC (local transform), add as pc child
    obbMesh.rotation.z = theta;
    obbMesh.position.set(x, y, z);
    pointCloud.add(obbMesh);
    obbMap[detector_id].push(obbMesh);
  });
    // Remove objects that have left scene from all lists
  for (const track_id in track_to_detector) {
    if (track_to_detector[track_id] === detector_id){
      if (!activeTrackIds.has(Number(track_id))) {
        const colorHex = hexFromTHREEColor(track_colors[track_id]);
        assigned_colors.delete(colorHex);
        delete track_colors[track_id];
        delete track_to_detector[track_id];
      }
  
    }
  }
  
}

