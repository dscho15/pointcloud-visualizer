// 3D Scene Setup Module - Handles Three.js scene initialization
import * as THREE from 'three';
import { setupControls } from './controls.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.objects = {
      pointClouds: {},
      satellitePlane: null,
      gridHelper: null,
      heatmapPlane: null,
      avgSpeedPlane: null,
      maxSpeedPlane: null,
      heatmapTexture: null,
      avgSpeedTexture: null,
      maxSpeedTexture: null
    };

    this.initializeScene();
    this.setupLighting();
    this.setupGrid();
    this.setupHeatmapPlanes();
    this.loadSatelliteImage();
    this.setupEventListeners();
  }

  initializeScene() {
    // Scene setup
    this.scene.background = new THREE.Color(0xFFFFFF);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Controls setup
    this.controls = setupControls(this.camera, this.renderer.domElement);
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.scene.add(directionalLight);

    // Coordinate axes
    const axesHelper = new THREE.AxesHelper(10);
    this.scene.add(axesHelper);
  }

  setupGrid() {
    const gridSizeX = 200;
    const gridDivisionsX = 200;
    const gridColor = 0x888888;

    this.objects.gridHelper = new THREE.GridHelper(
      gridSizeX, 
      gridDivisionsX, 
      gridColor, 
      gridColor
    );
    this.objects.gridHelper.rotation.x = Math.PI / 2; // x-y plane
    this.objects.gridHelper.position.set(0, 0, 0);
    this.scene.add(this.objects.gridHelper);
  }

  setupHeatmapPlanes() {
    // Create heatmap texture and plane
    // Match the heatmap grid size: (world_max - world_min) / heatmap_resolution = 200 / 0.5 = 400
    const texWidth = 400;
    const texHeight = 400;
    const worldWidth = 200;
    const worldHeight = 200;

    // Heatmap
    const heatmapData = new Uint8Array(texWidth * texHeight * 4);
    this.objects.heatmapTexture = new THREE.DataTexture(
      heatmapData, 
      texWidth, 
      texHeight, 
      THREE.RGBAFormat
    );
    this.objects.heatmapTexture.minFilter = THREE.LinearFilter;
    this.objects.heatmapTexture.magFilter = THREE.LinearFilter;
    this.objects.heatmapTexture.needsUpdate = true;

    const heatmapMaterial = new THREE.MeshBasicMaterial({
      map: this.objects.heatmapTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    this.objects.heatmapPlane = new THREE.Mesh(geometry, heatmapMaterial);
    this.objects.heatmapPlane.position.set(0, 0, -0.1); // Position slightly below z=0 so point clouds appear on top
    this.scene.add(this.objects.heatmapPlane);

    // Speed textures
    this.objects.avgSpeedTexture = new THREE.DataTexture(
      new Uint8Array(texWidth * texHeight * 4),
      texWidth,
      texHeight,
      THREE.RGBAFormat
    );

    this.objects.maxSpeedTexture = new THREE.DataTexture(
      new Uint8Array(texWidth * texHeight * 4),
      texWidth,
      texHeight,
      THREE.RGBAFormat
    );

    // Average speed plane
    this.objects.avgSpeedPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(worldWidth, worldHeight),
      new THREE.MeshBasicMaterial({
        map: this.objects.avgSpeedTexture,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        blending: THREE.NormalBlending
      })
    );
    this.objects.avgSpeedPlane.position.z = 0.02;
    this.scene.add(this.objects.avgSpeedPlane);

    // Max speed plane
    this.objects.maxSpeedPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(worldWidth, worldHeight),
      new THREE.MeshBasicMaterial({
        map: this.objects.maxSpeedTexture,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        blending: THREE.NormalBlending
      })
    );
    this.objects.maxSpeedPlane.position.z = 0.02;
    this.scene.add(this.objects.maxSpeedPlane);

    // Update texture settings
    this.objects.avgSpeedTexture.needsUpdate = true;
    this.objects.maxSpeedTexture.needsUpdate = true;
  }

  loadSatelliteImage() {
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

      this.objects.satellitePlane = new THREE.Mesh(satGeometry, satMaterial);
      this.objects.satellitePlane.position.set(0, 0, -0.01);
      this.scene.add(this.objects.satellitePlane);
    });
  }

  setupEventListeners() {
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Animation loop
  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Getters for external access
  getScene() { return this.scene; }
  getCamera() { return this.camera; }
  getRenderer() { return this.renderer; }
  getObjects() { return this.objects; }
}
