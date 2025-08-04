import * as THREE from 'three';
import { initWebSocket } from './websocket.js';
import { createPointCloud, updatePointCloud } from './pointcloud.js';
import { updateHeatmap, updateHeading, updateAvgSpeed, updateMaxSpeed } from './heatmap.js';
import { addOBBtoPointcloud } from './obb.js';
import { SceneManager } from './scene-manager.js';
import { initUIControls, updatePointCloudDropdown, getHeadingVisible, setSatellitePlane } from './ui-controls.js';
import { settingsManager } from './settings-manager.js';

// Initialize the application
class PointCloudApp {
  constructor() {
    this.canvas = document.getElementById('webgl');
    this.sceneManager = new SceneManager(this.canvas);
    this.pointClouds = {};
    
    this.init();
  }

  init() {
    // Initialize UI controls with scene references
    const objects = this.sceneManager.getObjects();
    objects.pointClouds = this.pointClouds;
    
    initUIControls(
      this.sceneManager.getScene(), 
      objects, 
      this.sceneManager.getCamera(),
      this.sceneManager.getRenderer()
    );
    
    // Initialize settings manager
    settingsManager.initialize(
      this.sceneManager.getScene(),
      objects,
      this.pointClouds
    );
    
    // Set up WebSocket communication
    this.setupWebSocket();
    
    // Start animation loop
    this.sceneManager.animate();
    
    // Set up satellite plane callback for UI
    this.setupSatelliteCallback();
    
    // Add settings management to global scope for console access
    window.settingsManager = settingsManager;
    
    // Auto-save settings when changes occur (optional)
    this.setupAutoSave();
  }

  setupSatelliteCallback() {
    // Check periodically if satellite plane is loaded and update UI reference
    const checkSatellite = () => {
      const satellitePlane = this.sceneManager.getObjects().satellitePlane;
      if (satellitePlane) {
        setSatellitePlane(satellitePlane);
      } else {
        setTimeout(checkSatellite, 100);
      }
    };
    checkSatellite();
  }

  setupWebSocket() {
    const scene = this.sceneManager.getScene();
    const objects = this.sceneManager.getObjects();

    initWebSocket({
      onPointsReceived: ({ points, detector_id }) => {
        if (!this.pointClouds[detector_id]) {
          const pc = createPointCloud(points, detector_id);
          this.pointClouds[detector_id] = pc;
          scene.add(pc);
          updatePointCloudDropdown();
        } else {
          updatePointCloud(this.pointClouds[detector_id], points, detector_id);
        }
      },

      onOBBReceived: (obbData) => {
        const pc = this.pointClouds[obbData.detector_id];
        if (pc) {
          addOBBtoPointcloud(pc, obbData);
        } else {
          console.warn('No point cloud found for detector:', obbData.detector_id);
        }
      },

      onHeatmapReceived: (heat_data) => {
        updateHeatmap(heat_data, objects.heatmapTexture);
      },

      onHeadingReceived: (heading_data) => {
        updateHeading(heading_data, getHeadingVisible(), scene);
      },

      onAvgSpeedRecieved: (speed_data) => {
        console.log("Received avg speed data");
        updateAvgSpeed(speed_data, objects.avgSpeedTexture);
      },

      onMaxSpeedRecieved: (speed_data) => {
        console.log("Received max speed data");
        updateMaxSpeed(speed_data, objects.maxSpeedTexture);
      },
    });
  }
  
  setupAutoSave() {
    // Auto-save settings every 10 seconds if there are changes
    let lastSettingsHash = '';
    
    setInterval(() => {
      try {
        const currentSettings = settingsManager.exportSettings();
        const currentHash = JSON.stringify(currentSettings);
        
        if (currentHash !== lastSettingsHash) {
          lastSettingsHash = currentHash;
          // Optionally send to API
          settingsManager.sendSettingsToAPI(currentSettings);
          console.log('Settings auto-saved');
        }
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }, 10000); // 10 seconds
  }
}

// Start the application
new PointCloudApp();
