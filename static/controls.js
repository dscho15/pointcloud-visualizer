import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


let currentRoadWidth = 0.06;

// Listen for slider and number input changes
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('road-width-slider');
    const valueBox = document.getElementById('road-width-value');
    if (slider && valueBox) {
      const sync = (val) => {
        currentRoadWidth = parseFloat(val);
        slider.value = currentRoadWidth;
        valueBox.value = currentRoadWidth;
      };
      slider.addEventListener('input', e => sync(e.target.value));
      valueBox.addEventListener('input', e => sync(e.target.value));
    }
  });
}

export function getCurrentRoadWidth() {
  return currentRoadWidth;
}

export function setupControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  return controls;
}

