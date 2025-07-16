# 3D Road/Point Cloud Visualizer

This project is an interactive 3D road and point cloud visualizer built with Three.js (frontend) and FastAPI (Python backend). It allows users to draw, edit, and delete road markings as splines/ribbons in the xy-plane, visualize point clouds, and interact with the scene in real time.

## Features

- **Draw Roads:** Add points (right-click) to create new roads as smooth splines. Double right-click to finish a road.
- **Edit & Delete:** Select, highlight, and delete roads. (Edit mode is a placeholder for future work.)
- **Road Mesh:** Each road is rendered as a 3D ribbon with realistic width, normals, and UVs.
- **Edge Markings:** Continuous dashed white lines are rendered along each side of the road, like real road edge markings.
- **Point Markers:** Red spheres are shown at each clicked point during road creation.
- **Keyboard Shortcuts:**
  - `N`: New road
  - `R`: Reset drawing
  - `E`: Edit road (not implemented)
  - `D`: Delete selected road
- **UI Overlay:** Floating menu shows available keybinds and road status.
- **Selection:** Click on a road to select and highlight it.
- **WebSocket Data:** (Optional) Receives point cloud and OBB data from the FastAPI backend.

## Usage

1. **Install dependencies:**
   - Python: `fastapi`, `uvicorn`
   - JavaScript: Uses Three.js (via ES6 modules)

2. **Run the backend:**
   ```bash
   uvicorn server_fastapi:app --reload
   ```
   This serves the static files and WebSocket endpoint.

3. **Open the frontend:**
   - Navigate to `http://localhost:8000` in your browser.

4. **Draw roads:**
   - Right-click to add points in the scene (on the xy-plane).
   - Double right-click to finish the road.
   - Use the UI buttons or keyboard shortcuts for actions.

## File Structure

- `static/`
  - `index.html` — Main HTML file and UI overlay
  - `main.js` — Scene setup, Three.js integration, and WebSocket
  - `roadmarkings.js` — Road drawing, mesh generation, selection, and UI logic
  - `controls.js` — OrbitControls setup
  - `pointcloud.js`, `obb.js` — Point cloud and bounding box visualization
  - `style.css` — UI styles
- `server_fastapi.py` — FastAPI backend for static files and WebSocket
- `requirements.txt` — Python dependencies

## Controls & Keybinds

- **Right Click:** Add point
- **Double Right Click:** Finish road
- **N:** New road
- **R:** Reset drawing
- **E:** Edit road (not implemented)
- **D:** Delete selected road

## Notes

- Only right mouse button adds points (left click is ignored for drawing).
- Roads are rendered with realistic dark gray color and white dashed edge lines.
- The edit mode is a placeholder for future enhancements.