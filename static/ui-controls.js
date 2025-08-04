// UI Controls Module - Handles all user interface interactions
import { updateHeading } from './heatmap.js';
import { satelliteOriginController } from './satellite-origin.js';
import { settingsManager } from './settings-manager.js';

let selectedPC = null;
let pointClouds = {};
let satellitePlane = null;
let gridHelper = null;
let heatmapPlane = null;
let avgSpeedPlane = null;
let maxSpeedPlane = null;
let headingVisible = true;
let scene = null;

// Initialize UI controls with references to 3D objects
export function initUIControls(sceneRef, objects, camera, renderer) {
  scene = sceneRef;
  pointClouds = objects.pointClouds;
  satellitePlane = objects.satellitePlane;
  gridHelper = objects.gridHelper;
  heatmapPlane = objects.heatmapPlane;
  avgSpeedPlane = objects.avgSpeedPlane;
  maxSpeedPlane = objects.maxSpeedPlane;

  // Initialize satellite origin controller
  satelliteOriginController.initialize(camera, scene, renderer);

  setupPointCloudControls();
  setupSatelliteControls();
  setupVisualizationControls();
  setupSettingsManagement();
}

// Point Cloud UI Controls
function setupPointCloudControls() {
  const pcSelect = document.getElementById('pc-select');
  const pcControls = document.getElementById('pc-controls');
  const pcVisible = document.getElementById('pc-visible');
  const toggleBtn = document.getElementById('toggle-pc-controls');
  const pcX = document.getElementById('pc-x');
  const pcY = document.getElementById('pc-y');
  const pcZ = document.getElementById('pc-z');
  const pcRotZ = document.getElementById('pc-rot-z');

  if (!pcSelect) return;

  pcSelect.addEventListener('change', () => {
    const detectorId = pcSelect.value;
    if (!detectorId || !pointClouds[detectorId]) {
      pcControls.style.display = 'none';
      toggleBtn.style.display = 'none';
      selectedPC = null;
      return;
    }

    selectedPC = pointClouds[detectorId];
    pcControls.style.display = 'block';
    toggleBtn.style.display = 'inline-block';
    toggleBtn.textContent = 'Hide Controls';

    // Update UI values to match selected point cloud
    pcVisible.checked = selectedPC.visible;
    pcX.value = selectedPC.position.x;
    pcY.value = selectedPC.position.y;
    pcZ.value = selectedPC.position.z;
    pcRotZ.value = selectedPC.rotation.z;
  });

  // Point cloud property controls
  if (pcVisible) {
    pcVisible.addEventListener('input', () => {
      if (selectedPC) selectedPC.visible = pcVisible.checked;
    });
  }

  if (pcX) {
    pcX.addEventListener('input', () => {
      if (selectedPC) selectedPC.position.x = parseFloat(pcX.value);
    });
  }

  if (pcY) {
    pcY.addEventListener('input', () => {
      if (selectedPC) selectedPC.position.y = parseFloat(pcY.value);
    });
  }

  if (pcZ) {
    pcZ.addEventListener('input', () => {
      if (selectedPC) selectedPC.position.z = parseFloat(pcZ.value);
    });
  }

  if (pcRotZ) {
    pcRotZ.addEventListener('input', () => {
      if (selectedPC) selectedPC.rotation.z = parseFloat(pcRotZ.value);
    });
  }

  // Toggle button
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (pcControls.style.display === 'none') {
        pcControls.style.display = 'block';
        toggleBtn.textContent = 'Hide Controls';
      } else {
        pcControls.style.display = 'none';
        toggleBtn.textContent = 'Show Controls';
      }
    });
  }
}

// Satellite and Grid Controls
function setupSatelliteControls() {
  const showSatelliteCheckbox = document.getElementById('show-satellite');
  const showGridCheckbox = document.getElementById('show-grid-checkbox');
  const satX = document.getElementById('sat-x');
  const satY = document.getElementById('sat-y');
  const satRotZ = document.getElementById('sat-rot-z');
  const satScale = document.getElementById('sat-scale');
  const satScaleValue = document.getElementById('sat-scale-value');

  if (showSatelliteCheckbox) {
    showSatelliteCheckbox.addEventListener('change', (e) => {
      if (satellitePlane) satellitePlane.visible = e.target.checked;
    });
  }

  if (showGridCheckbox) {
    showGridCheckbox.addEventListener('change', (e) => {
      if (gridHelper) gridHelper.visible = e.target.checked;
    });
  }

  // Satellite positioning controls
  if (satX) {
    satX.addEventListener('input', () => {
      const value = parseFloat(satX.value);
      if (satellitePlane) {
        // Use satellite origin controller to maintain proper positioning
        const currentY = satellitePlane.position.y;
        satelliteOriginController.translateSatellite(value, currentY);
      }
    });
  }

  if (satY) {
    satY.addEventListener('input', () => {
      const value = parseFloat(satY.value);
      if (satellitePlane) {
        // Use satellite origin controller to maintain proper positioning
        const currentX = satellitePlane.position.x;
        satelliteOriginController.translateSatellite(currentX, value);
      }
    });
  }

  if (satRotZ) {
    satRotZ.addEventListener('input', () => {
      const value = parseFloat(satRotZ.value);
      // Use the origin controller for rotation around the set origin point
      satelliteOriginController.rotateSatellite(value);
    });
  }

  // Satellite scale control
  if (satScale && satScaleValue) {
    satScale.addEventListener('input', () => {
      const value = parseFloat(satScale.value);
      // Update the display value
      satScaleValue.textContent = value.toFixed(2);
      // Use the origin controller for scaling
      satelliteOriginController.scaleSatellite(value);
    });
  }
}

// Visualization Controls (Heatmaps, Speed, Heading)
function setupVisualizationControls() {
  const showHeatCheckbox = document.getElementById('show-heatmap-checkbox');
  const showHeadingCheckbox = document.getElementById('show-heading-checkbox');
  const showMaxSpeedCheckbox = document.getElementById('show-maxspeed-checkbox');
  const showAvgSpeedCheckbox = document.getElementById('show-avgspeed-checkbox');

  if (showHeatCheckbox) {
    showHeatCheckbox.addEventListener('change', (e) => {
      if (heatmapPlane) heatmapPlane.visible = e.target.checked;
    });
  }

  if (showHeadingCheckbox) {
    showHeadingCheckbox.addEventListener('change', (e) => {
      headingVisible = e.target.checked;
      // Update existing heading arrows visibility
      updateHeading(null, headingVisible, scene);
    });
  }

  if (showMaxSpeedCheckbox) {
    showMaxSpeedCheckbox.addEventListener('change', (e) => {
      if (maxSpeedPlane) maxSpeedPlane.visible = e.target.checked;
    });
  }

  if (showAvgSpeedCheckbox) {
    showAvgSpeedCheckbox.addEventListener('change', (e) => {
      if (avgSpeedPlane) avgSpeedPlane.visible = e.target.checked;
    });
  }
}

// Settings Management Controls
function setupSettingsManagement() {
  const exportBtn = document.getElementById('export-settings-btn');
  const saveToApiBtn = document.getElementById('save-to-api-btn');
  const importBtn = document.getElementById('import-settings-btn');
  const importFileInput = document.getElementById('import-settings-file');
  const loadFromApiBtn = document.getElementById('load-from-api-btn');
  const statusElement = document.getElementById('settings-status');

  // Helper function to update status
  function updateStatus(message, isError = false) {
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = isError ? '#f44336' : '#4CAF50';
      setTimeout(() => {
        statusElement.textContent = 'Ready';
        statusElement.style.color = '#ccc';
      }, 3000);
    }
  }

  // Export settings as JSON file
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      try {
        settingsManager.downloadSettings();
        updateStatus('Settings exported');
      } catch (error) {
        console.error('Export error:', error);
        updateStatus('Export failed', true);
      }
    });
  }

  // Save settings to API
  if (saveToApiBtn) {
    saveToApiBtn.addEventListener('click', async () => {
      try {
        updateStatus('Saving...');
        const result = await settingsManager.sendSettingsToAPI();
        if (result) {
          updateStatus('Saved to server');
        } else {
          updateStatus('Save failed', true);
        }
      } catch (error) {
        console.error('Save to API error:', error);
        updateStatus('Save failed', true);
      }
    });
  }

  // Import settings from file
  if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        updateStatus('Importing...');
        const success = await settingsManager.uploadSettings(file);
        if (success) {
          updateStatus('Settings imported');
        } else {
          updateStatus('Import failed', true);
        }
      } catch (error) {
        console.error('Import error:', error);
        updateStatus('Import failed', true);
      }

      // Clear the file input
      event.target.value = '';
    });
  }

  // Load settings from API
  if (loadFromApiBtn) {
    loadFromApiBtn.addEventListener('click', async () => {
      try {
        updateStatus('Loading...');
        const result = await settingsManager.getSettingsFromAPI();
        if (result && result.settings) {
          const success = settingsManager.importSettings(result.settings);
          if (success) {
            updateStatus('Loaded from server');
          } else {
            updateStatus('Load failed', true);
          }
        } else {
          updateStatus('No settings on server', true);
        }
      } catch (error) {
        console.error('Load from API error:', error);
        updateStatus('Load failed', true);
      }
    });
  }
}

// Update point cloud dropdown when new detectors are added
export function updatePointCloudDropdown() {
  const pcSelect = document.getElementById('pc-select');
  if (!pcSelect) return;

  pcSelect.innerHTML = '<option value="">Select Point Cloud</option>';
  for (const id in pointClouds) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `Detector ${id}`;
    pcSelect.appendChild(option);
  }
}

// Update point clouds reference when new ones are added
export function setPointClouds(newPointClouds) {
  pointClouds = newPointClouds;
}

// Get current heading visibility state
export function getHeadingVisible() {
  return headingVisible;
}

// Update satellite plane reference
export function setSatellitePlane(plane) {
  satellitePlane = plane;
  // Also update the satellite origin controller
  satelliteOriginController.setSatellitePlane(plane);
}
