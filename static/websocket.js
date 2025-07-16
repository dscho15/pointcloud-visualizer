export function initWebSocket({ onPointsReceived, onOBBReceived }) {
  const socket = new WebSocket(`ws://${window.location.host}/ws`);

  socket.addEventListener('open', () => {
    console.log('[WebSocket] Connected');
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'pointcloud') {
        onPointsReceived(data.points);
      } else if (data.type === 'obb') {
        onOBBReceived(data);
      }
    } catch (err) {
      console.error('[WebSocket] JSON error:', err);
    }
  });

  socket.addEventListener('close', () => {
    console.log('[WebSocket] Disconnected');
  });

  socket.addEventListener('error', (err) => {
    console.error('[WebSocket] Error:', err);
  });
}
