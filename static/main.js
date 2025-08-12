import * as THREE from 'three';
import { initWebSocket } from './websocket.js';
import { createPointCloud, updatePointCloud } from './pointcloud.js';
// import { updateHeatmap, updateHeading, updateAvgSpeed, updateMaxSpeed } from './heatmap.js';
import { addOBBtoPointcloud } from './obb.js';
import { SceneManager } from './scene-manager.js';
import { initUIControls, updatePointCloudDropdown, getHeadingVisible, setSatellitePlane } from './ui-controls.js';
import { settingsManager } from './settings-manager.js';
// import { enableRoadMarkingDrawing, setupRoadUI } from './roadmarkings.js';


// Initialize the application
class PointCloudApp {
    constructor() {
        this.canvas = document.getElementById('webgl');
        this.sceneManager = new SceneManager(this.canvas);
        this.pointClouds = {};
        this.foreground = 1;
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
            onPointsReceived: (data) => {
                if (!this.pointClouds[data.detector_id]) 
                {
                    if (data.pc_type === "foreground") {
                        this.pointClouds[data.detector_id] = {
                            foreground: createPointCloud(data.points, { pointType: 'foreground' }),
                            background: createPointCloud([], { pointType: 'background' }),
                        };
                    } else if (data.pc_type === "background") {
                        this.pointClouds[data.detector_id] = {
                            foreground: createPointCloud([], { pointType: 'foreground' }),
                            background: createPointCloud(data.points, { pointType: 'background', colorMap: 'viridis' }),
                        };
                    }
                    else {
                        console.error("Unknown point cloud type received:", data.pc_type);
                        return;
                    }
                    scene.add(this.pointClouds[data.detector_id]["foreground"]);
                    scene.add(this.pointClouds[data.detector_id]["background"]);
                    updatePointCloudDropdown();
                }
                else {
                    if (
                        data.pc_type === "foreground" ||
                        data.pc_type === "background"
                    ) 
                    {
                        updatePointCloud(
                            this.pointClouds[data.detector_id][data.pc_type],
                            data.points,
                            data.detector_id
                        );
                    }
                }
            },

            onOBBReceived: (obbData) => {
                const pc = this.pointClouds[obbData.detector_id]["foreground"];
                if (pc) {
                    addOBBtoPointcloud(pc, obbData, objects, scene);
                } else {
                    console.warn('No point cloud found for detector:', obbData.detector_id);
                }
            },

            // onHeatmapReceived: (heat_data) => {
            //     updateHeatmap(heat_data, objects.heatmapTexture);
            // },

            // onHeadingReceived: (heading_data) => {
            //     updateHeading(heading_data, getHeadingVisible(), scene);
            // },

            // onAvgSpeedRecieved: (speed_data) => {
            //     updateAvgSpeed(speed_data, objects.avgSpeedTexture);
            // },

            // onMaxSpeedRecieved: (speed_data) => {
            //     updateMaxSpeed(speed_data, objects.maxSpeedTexture);
            // },
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
