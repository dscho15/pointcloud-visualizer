// Settings Manager Module - Exports and imports all visualizer settings
import { satelliteOriginController } from './satellite-origin.js';

class SettingsManager {
  constructor() {
    this.pointCloudSets = {};
    this.scene = null;
    this.sceneObjects = {};
  }

  initialize(scene, objects, pointCloudSets) {
    this.scene = scene;
    this.sceneObjects = objects;
    this.pointCloudSets = pointCloudSets;
  }

  // Export all current settings
  exportSettings() {
    const settings = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      pointClouds: this.exportPointCloudSettings(),
      satellite: this.exportSatelliteSettings(),
      visualization: this.exportVisualizationSettings(),
      camera: this.exportCameraSettings(),
      grid: this.exportGridSettings()
    };

    console.log('Exported settings:', settings);
    return settings;
  }

  // Export point cloud settings
  exportPointCloudSettings() {
    const pcSettings = {};
    
    for (const [id, pointClouds] of Object.entries(this.pointCloudSets)) {
      if (pointClouds) {
        const type = "foreground"; // expecting the settings to be the same for foreground and background

        pcSettings[id] = {
          visible: pointClouds[type].visible,
          position: {
            x: pointClouds[type].position.x,
            y: pointClouds[type].position.y,
            z: pointClouds[type].position.z
          },
          rotation: {
            x: pointClouds[type].rotation.x,
            y: pointClouds[type].rotation.y,
            z: pointClouds[type].rotation.z
          },
          scale: {
            x: pointClouds[type].scale.x,
            y: pointClouds[type].scale.y,
            z: pointClouds[type].scale.z
          }
        };
      }
    }

    return pcSettings;
  }

  // Export satellite settings
  exportSatelliteSettings() {
    const satellitePlane = this.sceneObjects.satellitePlane;
    if (!satellitePlane) {
      return null;
    }

    const settings = {
      visible: satellitePlane.visible,
      position: {
        x: satellitePlane.position.x,
        y: satellitePlane.position.y,
        z: satellitePlane.position.z
      },
      rotation: {
        x: satellitePlane.rotation.x,
        y: satellitePlane.rotation.y,
        z: satellitePlane.rotation.z
      },
      scale: {
        x: satellitePlane.scale.x,
        y: satellitePlane.scale.y,
        z: satellitePlane.scale.z
      },
      customOrigin: {
        hasCustomOrigin: satelliteOriginController.hasCustomOriginSet(),
        originPoint: satelliteOriginController.hasCustomOriginSet() ? 
                     satelliteOriginController.getCustomOrigin() : null
      }
    };

    return settings;
  }

  // Export visualization settings
  exportVisualizationSettings() {
    const heatmapCheckbox = document.getElementById('show-heatmap-checkbox');
    const headingCheckbox = document.getElementById('show-heading-checkbox');
    const maxSpeedCheckbox = document.getElementById('show-maxspeed-checkbox');
    const avgSpeedCheckbox = document.getElementById('show-avgspeed-checkbox');

    return {
      heatmap: {
        visible: heatmapCheckbox ? heatmapCheckbox.checked : false,
        planeVisible: this.sceneObjects.heatmapPlane ? this.sceneObjects.heatmapPlane.visible : false
      },
      heading: {
        visible: headingCheckbox ? headingCheckbox.checked : false
      },
      maxSpeed: {
        visible: maxSpeedCheckbox ? maxSpeedCheckbox.checked : false,
        planeVisible: this.sceneObjects.maxSpeedPlane ? this.sceneObjects.maxSpeedPlane.visible : false
      },
      avgSpeed: {
        visible: avgSpeedCheckbox ? avgSpeedCheckbox.checked : false,
        planeVisible: this.sceneObjects.avgSpeedPlane ? this.sceneObjects.avgSpeedPlane.visible : false
      }
    };
  }

  // Export camera settings
  exportCameraSettings() {
    if (!this.scene || !this.scene.camera) {
      return null;
    }

    // Get camera from scene manager if available
    const camera = this.scene.camera || this.scene.children.find(child => child.isCamera);
    if (!camera) {
      return null;
    }

    return {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      },
      rotation: {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z
      },
      fov: camera.fov || null,
      zoom: camera.zoom || null
    };
  }

  // Export grid settings
  exportGridSettings() {
    const gridCheckbox = document.getElementById('show-grid-checkbox');
    const gridHelper = this.sceneObjects.gridHelper;

    return {
      visible: gridCheckbox ? gridCheckbox.checked : false,
      helperVisible: gridHelper ? gridHelper.visible : false
    };
  }

  // Get UI slider values
  exportUISliderValues() {
    const sliders = {
      pointCloud: {},
      satellite: {}
    };

    // Point cloud sliders (for currently selected PC)
    const pcSelect = document.getElementById('pc-select');
    if (pcSelect && pcSelect.value) {
      const selectedId = pcSelect.value;
      sliders.pointCloud[selectedId] = {
        x: this.getSliderValue('pc-x'),
        y: this.getSliderValue('pc-y'),
        z: this.getSliderValue('pc-z'),
        rotationZ: this.getSliderValue('pc-rot-z')
      };
    }

    // Satellite sliders
    sliders.satellite = {
      x: this.getSliderValue('sat-x'),
      y: this.getSliderValue('sat-y'),
      rotationZ: this.getSliderValue('sat-rot-z'),
      scale: this.getSliderValue('sat-scale')
    };

    return sliders;
  }

  // Helper method to get slider value
  getSliderValue(id) {
    const slider = document.getElementById(id);
    return slider ? parseFloat(slider.value) : null;
  }

  // Import settings (apply settings to the scene)
  importSettings(settings) {
    console.log('Importing settings:', settings);

    try {
      // Import point cloud settings
      if (settings.pointClouds) {
        this.importPointCloudSettings(settings.pointClouds);
      }

      // Import satellite settings
      if (settings.satellite) {
        this.importSatelliteSettings(settings.satellite);
      }

      // Import visualization settings
      if (settings.visualization) {
        this.importVisualizationSettings(settings.visualization);
      }

      // Import grid settings
      if (settings.grid) {
        this.importGridSettings(settings.grid);
      }

      console.log('Settings imported successfully');
      return true;
    } catch (error) {
      console.error('Error importing settings:', error);
      return false;
    }
  }

  // Import point cloud settings
  importPointCloudSettings(pcSettings) {
    for (const [id, settings] of Object.entries(pcSettings)) {
      const pointCloudSet = this.pointCloudSets[id];
      if (pointCloudSet && settings) {
        // Apply settings to both foreground and background point clouds
        ['foreground', 'background'].forEach(type => {
          const pointCloud = pointCloudSet[type];
          if (pointCloud) {
            pointCloud.visible = settings.visible;
            if (settings.position) {
              pointCloud.position.set(settings.position.x, settings.position.y, settings.position.z);
            }
            if (settings.rotation) {
              pointCloud.rotation.set(settings.rotation.x, settings.rotation.y, settings.rotation.z);
            }
            if (settings.scale) {
              pointCloud.scale.set(settings.scale.x, settings.scale.y, settings.scale.z);
            }
          }
        });
      }
    }
  }

  // Import satellite settings
  importSatelliteSettings(satSettings) {
    const satellitePlane = this.sceneObjects.satellitePlane;
    if (!satellitePlane || !satSettings) return;

    satellitePlane.visible = satSettings.visible;
    satellitePlane.position.set(satSettings.position.x, satSettings.position.y, satSettings.position.z);
    satellitePlane.rotation.set(satSettings.rotation.x, satSettings.rotation.y, satSettings.rotation.z);
    satellitePlane.scale.set(satSettings.scale.x, satSettings.scale.y, satSettings.scale.z);

    // Update UI sliders
    this.updateUISliders();
  }

  // Import visualization settings
  importVisualizationSettings(vizSettings) {
    // Update checkboxes
    this.setCheckbox('show-heatmap-checkbox', vizSettings.heatmap?.visible);
    this.setCheckbox('show-heading-checkbox', vizSettings.heading?.visible);
    this.setCheckbox('show-maxspeed-checkbox', vizSettings.maxSpeed?.visible);
    this.setCheckbox('show-avgspeed-checkbox', vizSettings.avgSpeed?.visible);

    // Update plane visibility
    if (this.sceneObjects.heatmapPlane) {
      this.sceneObjects.heatmapPlane.visible = vizSettings.heatmap?.planeVisible || false;
    }
    if (this.sceneObjects.maxSpeedPlane) {
      this.sceneObjects.maxSpeedPlane.visible = vizSettings.maxSpeed?.planeVisible || false;
    }
    if (this.sceneObjects.avgSpeedPlane) {
      this.sceneObjects.avgSpeedPlane.visible = vizSettings.avgSpeed?.planeVisible || false;
    }
  }

  // Import grid settings
  importGridSettings(gridSettings) {
    this.setCheckbox('show-grid-checkbox', gridSettings.visible);
    if (this.sceneObjects.gridHelper) {
      this.sceneObjects.gridHelper.visible = gridSettings.helperVisible;
    }
  }

  // Helper method to set checkbox value
  setCheckbox(id, value) {
    const checkbox = document.getElementById(id);
    if (checkbox && typeof value === 'boolean') {
      checkbox.checked = value;
    }
  }

  // Update UI sliders to match current object values
  updateUISliders() {
    // Update satellite sliders
    const satellitePlane = this.sceneObjects.satellitePlane;
    if (satellitePlane) {
      this.setSliderValue('sat-x', satellitePlane.position.x);
      this.setSliderValue('sat-y', satellitePlane.position.y);
      this.setSliderValue('sat-rot-z', satellitePlane.rotation.z);
      this.setSliderValue('sat-scale', satellitePlane.scale.x);
    }
  }

  // Helper method to set slider value
  setSliderValue(id, value) {
    const slider = document.getElementById(id);
    if (slider && typeof value === 'number') {
      slider.value = value;
      
      // Update scale display if it's the scale slider
      if (id === 'sat-scale') {
        const scaleDisplay = document.getElementById('sat-scale-value');
        if (scaleDisplay) {
          scaleDisplay.textContent = value.toFixed(2);
        }
      }
    }
  }

  // Send settings to server API
  async sendSettingsToAPI(settings = null) {
    const settingsData = settings || this.exportSettings();
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Settings sent to API:', result);
        return result;
      } else {
        console.error('Failed to send settings to API:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Error sending settings to API:', error);
      return null;
    }
  }

  // Get settings from server API
  async getSettingsFromAPI() {
    try {
      const response = await fetch('/api/settings');
      
      if (response.ok) {
        const settings = await response.json();
        console.log('Settings received from API:', settings);
        return settings;
      } else {
        console.error('Failed to get settings from API:', response.statusText);
        return null;
      }
    } catch (error) {
      console.error('Error getting settings from API:', error);
      return null;
    }
  }

  // Export settings as downloadable JSON file
  downloadSettings() {
    const settings = this.exportSettings();
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `pointcloud-settings-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Import settings from uploaded JSON file
  uploadSettings(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          const success = this.importSettings(settings);
          resolve(success);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

// Export singleton instance
export const settingsManager = new SettingsManager();
