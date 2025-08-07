

export function initWebSocket({ onPointsReceived, onOBBReceived, onHeatmapReceived, onHeadingReceived, onAvgSpeedRecieved, onMaxSpeedRecieved }) {
  const socket = new WebSocket(`ws://${window.location.host}/ws`);

  socket.addEventListener('open', () => {
    console.log('[WebSocket] Connected');
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'pointcloud') {

        console.log("Recieved Pointcloud, from detector: ", data.detector_id, ", Type: ", data.pc_type)

        onPointsReceived(data);
      } else if (data.type === 'obb') {
        // console.log("Recieved Object Track")
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
