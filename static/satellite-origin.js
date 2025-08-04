// Satellite Origin Positioning Module
import * as THREE from 'three';

class SatelliteOriginController {
  constructor() {
    this.isOriginMode = false;
    this.camera = null;
    this.scene = null;
    this.satellitePlane = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Store the custom origin point for rotation
    this.customOrigin = new THREE.Vector3(0, 0, 0);
    this.basePosition = new THREE.Vector3(0, 0, -0.01); // Base position after origin is set
    this.hasCustomOrigin = false;
    
    this.originalCursor = null;
    this.statusElement = null;
    this.modeButton = null;
    this.resetButton = null;
    
    // Prevent multiple initialization
    this.initialized = false;
    
    this.initializeUI();
  }

  initialize(camera, scene, renderer) {
    if (this.initialized) return;
    
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.initialized = true;
  }

  setSatellitePlane(satellitePlane) {
    this.satellitePlane = satellitePlane;
  }

  initializeUI() {
    // Use correct IDs from HTML
    this.modeButton = document.getElementById('set-satellite-origin-btn');
    this.statusElement = document.getElementById('origin-mode-status');
    this.resetButton = document.getElementById('reset-satellite-origin-btn');

    if (this.modeButton) {
      // Remove any existing listeners to prevent duplicates
      this.modeButton.removeEventListener('click', this.toggleOriginMode);
      this.modeButton.addEventListener('click', () => {
        this.toggleOriginMode();
      });
    }

    if (this.resetButton) {
      this.resetButton.removeEventListener('click', this.resetSatellitePosition);
      this.resetButton.addEventListener('click', () => {
        this.resetSatellitePosition();
      });
    }

    // Add click listener to the canvas
    const canvas = document.getElementById('webgl');
    if (canvas) {
      // Remove existing listener to prevent duplicates
      canvas.removeEventListener('click', this.handleCanvasClick);
      
      // Store bound function for proper removal
      this.handleCanvasClick = (event) => {
        if (this.isOriginMode) {
          this.handleOriginClick(event);
        }
      };
      
      canvas.addEventListener('click', this.handleCanvasClick);

      // Store original cursor for restoration
      this.originalCursor = canvas.style.cursor || 'default';
    }
  }

  toggleOriginMode() {
    // Prevent toggling if not properly initialized
    if (!this.initialized) {
      console.warn('Controller not properly initialized');
      return;
    }
    
    this.isOriginMode = !this.isOriginMode;
    
    if (this.isOriginMode) {
      this.enterOriginMode();
    } else {
      this.exitOriginMode();
    }
  }

  enterOriginMode() {
    if (!this.satellitePlane) {
      this.showErrorMessage('Please wait for satellite image to load first!');
      this.isOriginMode = false;
      return;
    }

    // Update UI
    if (this.modeButton) {
      this.modeButton.textContent = '❌ Cancel Origin Mode';
      this.modeButton.style.background = '#f44336';
      this.modeButton.classList.add('origin-mode-active');
    }
    
    if (this.statusElement) {
      this.statusElement.style.display = 'block';
    }
    
    // Change cursor to crosshair
    const canvas = document.getElementById('webgl');
    if (canvas) {
      canvas.style.cursor = 'crosshair';
      canvas.classList.add('crosshair-cursor');
    }

    console.log('Origin mode activated - click on satellite to set new origin');
  }

  exitOriginMode() {
    // Update UI
    if (this.modeButton) {
      this.modeButton.textContent = '📍 Set Satellite Origin';
      this.modeButton.style.background = '#FF9800';
      this.modeButton.classList.remove('origin-mode-active');
    }
    
    if (this.statusElement) {
      this.statusElement.style.display = 'none';
    }
    
    // Restore original cursor
    const canvas = document.getElementById('webgl');
    if (canvas) {
      canvas.style.cursor = this.originalCursor;
      canvas.classList.remove('crosshair-cursor');
    }

    console.log('Origin mode deactivated');
  }

  handleOriginClick(event) {
    if (!this.satellitePlane || !this.camera || !this.renderer) {
      console.warn('Required objects not initialized');
      return;
    }

    // Prevent event bubbling
    event.stopPropagation();

    // Get mouse coordinates in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Set up raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check intersection with satellite plane
    const intersects = this.raycaster.intersectObject(this.satellitePlane);

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      console.log('Clicked point:', intersectionPoint);

      // Set the new custom origin
      this.setCustomOrigin(intersectionPoint);
      
      // Exit origin mode
      this.isOriginMode = false;
      this.exitOriginMode();
    } else {
      console.log('Click did not intersect with satellite plane');
      this.showErrorMessage('Please click directly on the satellite image');
    }
  }

  setCustomOrigin(clickedPoint) {
    if (!this.satellitePlane) return;

    // Store the original world position that should become the new origin
    this.customOrigin.copy(clickedPoint);
    this.hasCustomOrigin = true;

    // Calculate and store the base position after moving to origin
    const offsetX = -clickedPoint.x;
    const offsetY = -clickedPoint.y;

    // Apply offset to satellite plane
    this.satellitePlane.position.x += offsetX;
    this.satellitePlane.position.y += offsetY;

    // Store this as the base position for rotation calculations
    this.basePosition = new THREE.Vector3(
      this.satellitePlane.position.x,
      this.satellitePlane.position.y,
      this.satellitePlane.position.z
    );

    // Reset rotation to zero when setting new origin
    this.satellitePlane.rotation.z = 0;

    // Update UI sliders to reflect new position
    this.updateUISliders();

    console.log(`Custom origin set at: (${clickedPoint.x.toFixed(2)}, ${clickedPoint.y.toFixed(2)})`);
    console.log(`Satellite moved by offset: (${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`);
    console.log(`Base position stored: (${this.basePosition.x.toFixed(2)}, ${this.basePosition.y.toFixed(2)})`);
    
    // Show success message
    this.showSuccessMessage(clickedPoint);
  }

  // Method to handle rotation around custom origin
  rotateAroundCustomOrigin(angle) {
    if (!this.satellitePlane) {
      console.warn('No satellite plane available');
      return;
    }

    if (!this.hasCustomOrigin || !this.basePosition) {
      // If no custom origin, use default rotation around satellite center
      this.satellitePlane.rotation.z = angle;
      console.log(`Default rotation: ${angle.toFixed(2)} rad`);
      return;
    }

    // Rotation around custom origin:
    // 1. Move satellite so that the origin point is at (0,0)
    // 2. Apply rotation
    // 3. Move back to final position

    // Get the offset from the world origin to the base position
    const baseOffset = this.basePosition.clone();
    
    // Apply rotation to the base offset
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    const rotatedX = baseOffset.x * cos - baseOffset.y * sin;
    const rotatedY = baseOffset.x * sin + baseOffset.y * cos;

    // Set the new position and rotation
    this.satellitePlane.position.set(rotatedX, rotatedY, this.basePosition.z);
    this.satellitePlane.rotation.z = angle;

    // Update UI sliders
    this.updateUISliders();

    console.log(`Custom rotation: ${angle.toFixed(2)} rad around origin, new pos: (${rotatedX.toFixed(2)}, ${rotatedY.toFixed(2)})`);
  }

  updateUISliders() {
    if (!this.satellitePlane) return;

    const satX = document.getElementById('sat-x');
    const satY = document.getElementById('sat-y');

    if (satX) {
      // Clamp to slider range
      const clampedX = Math.max(-200, Math.min(200, this.satellitePlane.position.x));
      satX.value = clampedX;
    }
    if (satY) {
      // Clamp to slider range  
      const clampedY = Math.max(-200, Math.min(200, this.satellitePlane.position.y));
      satY.value = clampedY;
    }
  }

  resetSatellitePosition() {
    if (!this.satellitePlane) {
      console.warn('Satellite plane not available');
      return;
    }

    // Reset to center position
    this.satellitePlane.position.set(0, 0, -0.01);
    this.satellitePlane.rotation.z = 0;

    // Clear custom origin and base position
    this.customOrigin.set(0, 0, 0);
    this.basePosition.set(0, 0, -0.01);
    this.hasCustomOrigin = false;

    // Update UI sliders
    const satX = document.getElementById('sat-x');
    const satY = document.getElementById('sat-y');
    const satRotZ = document.getElementById('sat-rot-z');

    if (satX) satX.value = 0;
    if (satY) satY.value = 0;
    if (satRotZ) satRotZ.value = 0;

    console.log('Satellite position and custom origin reset to center');
    this.showSuccessMessage({ x: 0, y: 0 }, 'Reset to Center');
  }

  showSuccessMessage(clickedPoint, title = 'Origin Set!') {
    // Remove any existing messages first
    const existingMessages = document.querySelectorAll('.satellite-message');
    existingMessages.forEach(msg => msg.remove());

    // Create temporary success message
    const message = document.createElement('div');
    message.className = 'satellite-message';
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(76, 175, 80, 0.95);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: fadeInOut 3s ease-in-out;
      backdrop-filter: blur(5px);
    `;
    
    message.innerHTML = `
      ✅ <strong>${title}</strong><br>
      Point (${clickedPoint.x.toFixed(1)}, ${clickedPoint.y.toFixed(1)}) ${title.includes('Reset') ? 'reset to' : 'moved to'} origin
    `;

    document.body.appendChild(message);

    // Remove message after 3 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  showErrorMessage(text) {
    // Remove any existing messages first
    const existingMessages = document.querySelectorAll('.satellite-message');
    existingMessages.forEach(msg => msg.remove());

    // Create temporary error message
    const message = document.createElement('div');
    message.className = 'satellite-message';
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(244, 67, 54, 0.95);
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: fadeInOut 3s ease-in-out;
      backdrop-filter: blur(5px);
    `;
    
    message.innerHTML = `❌ <strong>Error:</strong><br>${text}`;

    document.body.appendChild(message);

    // Remove message after 3 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  // Public method to get rotation method for use by UI controls
  getRotationMethod() {
    return (angle) => this.rotateAroundCustomOrigin(angle);
  }

  // Public method to check if custom origin is set
  hasCustomOriginSet() {
    return this.hasCustomOrigin;
  }

  // Public method to get custom origin
  getCustomOrigin() {
    return this.customOrigin.clone();
  }

  // Method for manual satellite translation (used by sliders)
  translateSatellite(x, y) {
    if (!this.satellitePlane) return;
    
    this.satellitePlane.position.x = x;
    this.satellitePlane.position.y = y;
    
    // If we have a custom origin, update the base position to maintain rotation around the intended point
    if (this.hasCustomOrigin) {
      // Update base position to reflect the manual translation
      this.basePosition.set(x, y, this.satellitePlane.position.z);
      console.log(`Manual translation: updating base position to (${x.toFixed(2)}, ${y.toFixed(2)})`);
    }
  }

  // Method for satellite rotation (used by rotation slider)
  rotateSatellite(angle) {
    this.rotateAroundCustomOrigin(angle);
  }

  // Method for satellite scaling
  scaleSatellite(scale) {
    if (!this.satellitePlane) return;
    
    if (this.hasCustomOrigin) {
      // Scale around the custom origin point
      this.scaleAroundCustomOrigin(scale);
    } else {
      // Simple scale around center
      this.satellitePlane.scale.setScalar(scale);
    }
    
    console.log(`Satellite scaled to: ${scale.toFixed(2)}`);
  }

  // Scale around custom origin point
  scaleAroundCustomOrigin(scale) {
    if (!this.satellitePlane || !this.hasCustomOrigin) {
      this.satellitePlane.scale.setScalar(scale);
      return;
    }

    // Get current position relative to origin
    const currentPos = this.satellitePlane.position.clone();
    
    // Scale the position relative to origin
    const scaledPos = currentPos.multiplyScalar(scale / this.satellitePlane.scale.x);
    
    // Apply new position and scale
    this.satellitePlane.position.copy(scaledPos);
    this.satellitePlane.scale.setScalar(scale);
  }
}

// Add CSS animation for success message
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  }
`;
document.head.appendChild(style);

// Export singleton instance
export const satelliteOriginController = new SatelliteOriginController();
