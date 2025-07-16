import * as THREE from 'three';
import { initWebSocket } from './websocket.js';
import { createPointCloud, updatePointCloud } from './pointcloud.js';
import { addOBB } from './obb.js';
import { setupControls } from './controls.js';

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

// Add better lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Softer ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
scene.add(directionalLight);

// Add coordinate axes for reference
const axesHelper = new THREE.AxesHelper(2);
scene.add(axesHelper);

// Add a simple grid
const gridHelper = new THREE.GridHelper(4, 10, 0x444444, 0x444444);
scene.add(gridHelper);

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
    console.log('Received points:', points.length);
    updatePointCloud(pointCloud, points);
  },
  onOBBReceived: (obb) => {
    console.log('Received OBB:', obb);
    addOBB(scene, obb);
  },
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
