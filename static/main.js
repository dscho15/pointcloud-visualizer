import * as THREE from 'three';
import { initWebSocket } from './websocket.js';
import { createPointCloud, updatePointCloud } from './pointcloud.js';
// import { addOBB } from './obb.js';
import { setupControls } from './controls.js';
import { enableRoadMarkingDrawing, setupRoadUI } from './roadmarkings.js';
import { addOBBtoPointcloud } from './obb.js';

const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222); // Dark background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 5); // Better initial position
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const controls = setupControls(camera, renderer.domElement);
// Enable interactive road marking drawing
enableRoadMarkingDrawing(scene, camera, renderer);
// Setup road UI (selection, delete, new)
setupRoadUI(scene, camera, renderer);

// Add better lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Softer ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
scene.add(directionalLight);

// Add large, thick coordinate axes for reference
const axesLength = 10;
const axesHelper = new THREE.AxesHelper(axesLength);
scene.add(axesHelper);


// get satellite image: 
// === Load satellite image as ground plane ===
let satellitePlane = null; // declare globally
const textureLoader = new THREE.TextureLoader();

textureLoader.load('/static/uncropped.png', (texture) => {
  const satWidth = 200;
  const satHeight = 220;

  const satGeometry = new THREE.PlaneGeometry(satWidth, satHeight);
  const satMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1.0,
  });

  satellitePlane = new THREE.Mesh(satGeometry, satMaterial);
  satellitePlane.position.set(0, 0, -0.01);
  scene.add(satellitePlane);
});

const showSatelliteCheckbox = document.getElementById('show-satellite');
if (showSatelliteCheckbox) {
  showSatelliteCheckbox.addEventListener('change', (e) => {
    satellitePlane.visible = e.target.checked;
  });
}
const satX = document.getElementById('sat-x');
const satY = document.getElementById('sat-y');
const satRotZ = document.getElementById('sat-rot-z');

if (satX && satY) {
  satX.addEventListener('input', () => {
    if (satellitePlane) satellitePlane.position.x = parseFloat(satX.value);
  });

  satY.addEventListener('input', () => {
    if (satellitePlane) satellitePlane.position.y = parseFloat(satY.value);
  });
}
if (satRotZ) {
  satRotZ.addEventListener('input', () => {
    if (satellitePlane) satellitePlane.rotation.z = parseFloat(satRotZ.value);
  });
}
// Create a grid that covers (0, 250) in x and (-100, 100) in y
const gridSizeX = 200;
const gridSizeY = 200;
const gridDivisionsX = 200; // 1m per division in x
const gridDivisionsY = 200; // 1m per division in y
const gridColor = 0x888888;

// Create a grid helper (centered at origin, square)
const gridHelper = new THREE.GridHelper(gridSizeX, gridDivisionsX, gridColor, gridColor);
gridHelper.rotation.x = Math.PI / 2; // x-y plane
// Scale y to cover 200m (so grid is 250x200)
gridHelper.position.set(0, 0, 0);
// gridHelper.scale.y = gridSizeY / gridSizeX;
// Move grid so it covers (0,250) in x and (-100,100) in y
// By default, grid is centered at (0,0), so shift by (gridSizeX/2, 0, 0)
// gridHelper.position.x = gridSizeX / 2;
scene.add(gridHelper);

// After adding gridHelper to the scene
const showGridCheckbox = document.getElementById('show-grid-checkbox');
if (showGridCheckbox) {
  showGridCheckbox.addEventListener('change', (e) => {
    gridHelper.visible = e.target.checked;
  });
}

// Handle resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});




// Add PC control: 
const pcSelect = document.getElementById('pc-select');
const pcControls = document.getElementById('pc-controls');
const pcVisible = document.getElementById('pc-visible');
const toggleBtn = document.getElementById('toggle-pc-controls');
const pcX = document.getElementById('pc-x');
const pcY = document.getElementById('pc-y');
const pcZ = document.getElementById('pc-z');
const pcRotZ = document.getElementById('pc-rot-z');

// Hold references to dynamic objects
const pointClouds = {};


// Listen for websocket data
initWebSocket({
  onPointsReceived: ({points, detector_id}) => {
    console.log('From detector: ',detector_id,', received points:', points.length);

    if (!pointClouds[detector_id]) {
      const pc = createPointCloud(points, detector_id);
      pointClouds[detector_id] = pc;
      scene.add(pc)
      updatePointCloudDropdown(); 
    }
    else{
      updatePointCloud(pointClouds[detector_id], points, detector_id);
    }
    
  },
  onOBBReceived: (obbData) => {
    console.log(obbData.boxes.length,' objects detected in PC from detector ',obbData.detector_id);
    const pc = pointClouds[obbData.detector_id];
    if (pc) {
      addOBBtoPointcloud(pc, obbData);
    } else {
      console.warn('No point cloud found for detector:', obbData.detector_id);
    }
  }
});


let selectedPC = null;
pcSelect.addEventListener('change', () => {
  const detectorId = pcSelect.value;
  if (!detectorId || !pointClouds[detectorId]) {
    pcControls.style.display = 'none';
    toggleBtn.style.display = 'none';
    selectedPC = null;
    // pcControlsVisible = false;
    return;
  }

  selectedPC = pointClouds[detectorId];
  // pcControlsVisible = true;
  pcControls.style.display = 'block';
  toggleBtn.style.display = 'inline-block';
  toggleBtn.textContent = 'Hide Controls';

  pcVisible.checked = selectedPC.visible;
  pcX.value = selectedPC.position.x;
  pcY.value = selectedPC.position.y;
  pcZ.value = selectedPC.position.z;
  pcRotZ.value = selectedPC.rotation.z;
});
// pcSelect.addEventListener('change', () => {
//   const detectorId = pcSelect.value;
//   if (!detectorId || !pointClouds[detectorId]) {
//     pcControls.style.display = 'none';
//     toggleBtn.style.display = 'none';
//     selectedPC = null;
//     return;
//   }

//   selectedPC = pointClouds[detectorId];
//   pcControls.style.display = 'block';

//   pcVisible.checked = selectedPC.visible;
//   pcX.value = selectedPC.position.x;
//   pcY.value = selectedPC.position.y;
//   pcZ.value = selectedPC.position.z;
//   pcRotZ.value = selectedPC.rotation.z;
// });

pcVisible.addEventListener('input', () => {
  if (selectedPC) selectedPC.visible = pcVisible.checked;
});
pcX.addEventListener('input', () => {
  if (selectedPC) selectedPC.position.x = parseFloat(pcX.value);
});
pcY.addEventListener('input', () => {
  if (selectedPC) selectedPC.position.y = parseFloat(pcY.value);
});
pcZ.addEventListener('input', () => {
  if (selectedPC) selectedPC.position.z = parseFloat(pcZ.value);
});
pcRotZ.addEventListener('input', () => {
  if (selectedPC) selectedPC.rotation.z = parseFloat(pcRotZ.value);
});

toggleBtn.addEventListener('click', () => {
  if (pcControls.style.display === 'none') {
    pcControls.style.display = 'block';
    toggleBtn.textContent = 'Hide Controls';
  } 
  else {
    pcControls.style.display = 'none';
    toggleBtn.textContent = 'Show Controls';
  }
});

function updatePointCloudDropdown() {
  pcSelect.innerHTML = '<option value="">-- Select Point Cloud --</option>';
  for (const id in pointClouds) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `Detector ${id}`;
    pcSelect.appendChild(option);
  }
}












function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
