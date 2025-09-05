

export function initWebSocket({ onPointsReceived, onOBBReceived, onHeatmapReceived, onHeadingReceived, onAvgSpeedRecieved, onMaxSpeedRecieved }) {
  let socket;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectInterval = 3000; // 3 seconds

  function connect() {
    socket = new WebSocket(`ws://${window.location.host}/ws`);

    socket.addEventListener('open', () => {
      console.log('[WebSocket] Connected');
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'pointcloud') {
          // console.log("Received Pointcloud, from detector: ", data.detector_id, ", Type: ", data.pc_type)
          onPointsReceived(data);
        } else if (data.type === 'obb') {
          onOBBReceived(data);
        } // else if (data.type === 'heatmap') {
        //   onHeatmapReceived(data.data)
        // }
        // else if (data.type === 'heading') {
        //   onHeadingReceived(data)
        // }
        // else if (data.type === 'avg_speed_map') {
        //   onAvgSpeedRecieved(data)
        // }
        // else if (data.type === 'max_speed_map') {
        //   onMaxSpeedRecieved(data)
        // }
      } catch (err) {
        console.error('[WebSocket] JSON error:', err);
      }
    });

    socket.addEventListener('close', (event) => {
      console.log('[WebSocket] Disconnected', event.code, event.reason);
      
      // Attempt to reconnect if not manually closed
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`[WebSocket] Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
        setTimeout(connect, reconnectInterval);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('[WebSocket] Maximum reconnection attempts reached');
      }
    });

    socket.addEventListener('error', (err) => {
      console.error('[WebSocket] Error:', err);
    });
  }

  // Initial connection
  connect();

  // Return socket for potential external control
  return {
    getSocket: () => socket,
    reconnect: connect
  };
}
