// Satellite Origin Controller - Handles clicking to set satellite origin and rotation around that point
import * as THREE from 'three';

export class SatelliteOriginController {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.satellitePlane = null;
    this.isPositioningMode = false;
    this.clickHandler = null;
    this.originalSatellitePosition = { x: 0, y: 0, z: 0 };
    this.currentOffset = { x: 0, y: 0 };
    this.originPoint = { x: 0, y: 0 }; // The point that should be at (0,0)
    this.originalRotation = 0;
    
    // Visual feedback
    this.originMarker = null;
    this.createOriginMarker();
  }

  setSatellitePlane(plane) {
    this.satellitePlane = plane;
    if (plane) {
      // Store original position and rotation
      this.originalSatellitePosition = {
        x: plane.position.x,
        y: plane.position.y,
        z: plane.position.z
      };
      this.originalRotation = plane.rotation.z;
    }
  }

  createOriginMarker() {
    // Create a small visual marker for the origin point
    const geometry = new THREE.RingGeometry(0.5, 1, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.originMarker = new THREE.Mesh(geometry, material);
    this.originMarker.position.z = 0.1; // Slightly above satellite
    this.originMarker.visible = false;
    this.scene.add(this.originMarker);
  }

  enablePositioningMode() {
    if (!this.satellitePlane) {
      console.warn('No satellite plane available for positioning');
      return;
    }

    this.isPositioningMode = true;
    this.renderer.domElement.style.cursor = 'crosshair';
    
    // Add click event listener
    this.clickHandler = this.onCanvasClick.bind(this);
    this.renderer.domElement.addEventListener('click', this.clickHandler);
    
    console.log('Satellite positioning mode enabled. Click on the satellite image to set new origin.');
  }

  disablePositioningMode() {
    this.isPositioningMode = false;
    this.renderer.domElement.style.cursor = 'default';
    
    // Remove click event listener
    if (this.clickHandler) {
      this.renderer.domElement.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    
    console.log('Satellite positioning mode disabled.');
  }

  onCanvasClick(event) {
    if (!this.isPositioningMode || !this.satellitePlane) return;

    // Get mouse position in normalized device coordinates (-1 to +1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Create raycaster
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);

    // Check intersection with satellite plane
    const intersects = raycaster.intersectObject(this.satellitePlane);
    
    if (intersects.length > 0) {
      const clickPoint = intersects[0].point;
      this.setOriginPoint(clickPoint.x, clickPoint.y);
      
      // Show visual feedback
      this.showOriginMarker(clickPoint.x, clickPoint.y);
      
      console.log(`New satellite origin set at: (${clickPoint.x.toFixed(2)}, ${clickPoint.y.toFixed(2)})`);
    }
  }

  setOriginPoint(x, y) {
    if (!this.satellitePlane) return;

    // Store the origin point in satellite-local coordinates
    this.originPoint = { x, y };
    
    // Calculate the offset needed to move this point to (0,0)
    this.currentOffset = { x: -x, y: -y };
    
    // Apply the translation
    this.updateSatelliteTransform();
  }

  updateSatelliteTransform() {
    if (!this.satellitePlane) return;

    // Reset to original transform
    this.satellitePlane.position.set(
      this.originalSatellitePosition.x,
      this.originalSatellitePosition.y,
      this.originalSatellitePosition.z
    );
    this.satellitePlane.rotation.z = this.originalRotation;

    // Apply current rotation around the origin point
    const currentRotation = this.satellitePlane.rotation.z;
    
    // Calculate rotated offset
    const cos = Math.cos(currentRotation);
    const sin = Math.sin(currentRotation);
    
    const rotatedOffsetX = this.currentOffset.x * cos - this.currentOffset.y * sin;
    const rotatedOffsetY = this.currentOffset.x * sin + this.currentOffset.y * cos;
    
    // Apply the offset (translation to move origin point to 0,0)
    this.satellitePlane.position.x = this.originalSatellitePosition.x + rotatedOffsetX;
    this.satellitePlane.position.y = this.originalSatellitePosition.y + rotatedOffsetY;
  }

  showOriginMarker(x, y) {
    if (this.originMarker) {
      this.originMarker.position.x = 0; // Always at world origin after repositioning
      this.originMarker.position.y = 0;
      this.originMarker.visible = true;
    }
  }

  hideOriginMarker() {
    if (this.originMarker) {
      this.originMarker.visible = false;
    }
  }

  resetToOriginalPosition() {
    if (!this.satellitePlane) return;

    // Reset to original position and rotation
    this.satellitePlane.position.set(
      this.originalSatellitePosition.x,
      this.originalSatellitePosition.y,
      this.originalSatellitePosition.z
    );
    this.satellitePlane.rotation.z = this.originalRotation;
    
    // Reset internal state
    this.currentOffset = { x: 0, y: 0 };
    this.originPoint = { x: 0, y: 0 };
    
    this.hideOriginMarker();
    console.log('Satellite position reset to original.');
  }

  // Method to handle satellite rotation around the new origin
  rotateSatellite(rotationZ) {
    if (!this.satellitePlane) return;

    // Store the new rotation relative to original
    const deltaRotation = rotationZ - this.originalRotation;
    this.satellitePlane.rotation.z = rotationZ;
    
    // Update transform to maintain origin point at (0,0) with new rotation
    this.updateSatelliteTransform();
  }

  // Method to handle satellite translation
  translateSatellite(x, y) {
    if (!this.satellitePlane) return;

    // Update original position
    this.originalSatellitePosition.x = x;
    this.originalSatellitePosition.y = y;
    
    // Update transform
    this.updateSatelliteTransform();
  }

  cleanup() {
    this.disablePositioningMode();
    if (this.originMarker) {
      this.scene.remove(this.originMarker);
    }
  }
}
