

export function initWebSocket({ onPointsReceived, onOBBReceived, onHeatmapReceived, onHeadingReceived, onAvgSpeedRecieved, onMaxSpeedRecieved }) {
  const socket = new WebSocket(`ws://${window.location.host}/ws`);

  socket.addEventListener('open', () => {
    console.log('[WebSocket] Connected');
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'pointcloud') {
        onPointsReceived(data);
      } else if (data.type === 'obb') {
        onOBBReceived(data);
      } else if (data.type === 'heatmap') {
        onHeatmapReceived(data.data)
      }
      else if (data.type === 'heading') {
        onHeadingReceived(data)
      }
      else if (data.type === 'avg_speed_map') {
        onAvgSpeedRecieved(data)
      }
      else if (data.type === 'max_speed_map') {
        onMaxSpeedRecieved(data)
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
