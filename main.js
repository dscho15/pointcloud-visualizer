import * as THREE from 'three';
import { initWebSocket } from './websocket.js';
import { createPointCloud, updatePointCloud } from './pointcloud.js';
import { addOBB } from './obb.js';
import { setupControls } from './controls.js';

const canvas = document.getElementById('webgl');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const controls = setupControls(camera, renderer.domElement);

// Add light
const light = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(light);

// Handle resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hold references to dynamic objects
let pointCloud = createPointCloud([]);
scene.add(pointCloud);

// Listen for websocket data
initWebSocket({
  onPointsReceived: (points) => {
    updatePointCloud(pointCloud, points);
  },
  onOBBReceived: (obb) => {
    addOBB(scene, obb);
  },
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
