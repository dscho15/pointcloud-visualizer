export function initWebSocket({ onPointsReceived, onOBBReceived }) {
  const socket = new WebSocket('ws://localhost:8080'); // Adjust to your WebSocket server

  socket.addEventListener('open', () => {
    console.log('[WebSocket] Connected');
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'pointcloud') {
        // Expecting { type: "pointcloud", points: [[x, y, z], ...] }
        onPointsReceived(data.points);
      } else if (data.type === 'obb') {
        // Expecting { type: "obb", center: [x, y, z], size: [sx, sy, sz], rotation: [3x3 matrix flat] }
        onOBBReceived(data);
      } else {
        console.warn('[WebSocket] Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing message:', err);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[WebSocket] Disconnected');
  });

  socket.addEventListener('error', (err) => {
    console.error('[WebSocket] Error:', err);
  });
}
