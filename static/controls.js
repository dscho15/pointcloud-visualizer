import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


let currentRoadWidth = 0.06;
let currentZOffset = 0;

// Listen for slider and number input changes
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('road-width-slider');
    const valueBox = document.getElementById('road-width-value');
    if (slider && valueBox) {
      const sync = (val, from) => {
        let floatVal = parseFloat(val) || 0;
        currentRoadWidth = floatVal;
        if (from !== 'slider') slider.value = floatVal;
        if (from !== 'box') valueBox.value = floatVal;
      };
      slider.addEventListener('input', e => sync(e.target.value, 'slider'));
      valueBox.addEventListener('input', e => sync(e.target.value, 'box'));
      valueBox.addEventListener('change', e => sync(e.target.value, 'box'));
    }

  });
}

export function getCurrentRoadWidth() {
  return currentRoadWidth;
}

export function getCurrentZOffset() {
  return currentZOffset;
}

export function setupControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  return controls;
}

