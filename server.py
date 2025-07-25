import numpy as np
import json
import random
import asyncio
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketState
from natsort import natsorted

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def get_index():
    return FileResponse("static/index.html")

# Store connected WebSocket clients
clients = set()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    print("Client connected")
    try:
        while True:
            # Just keep the connection alive, don't wait for messages
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    finally:
        clients.remove(websocket)
        print("Client disconnected")
        
async def broadcast_fake_data():
    
    i = 0
    
    while True:
        
        files = natsorted(list(Path("./recording/interval_").glob("interval_*.npy")))
        
        if clients and len(files) > 0:
            
            file = files[i % len(files)]
            i += 1
            
            points = np.load(file)[:, :3]
                                    
            pointcloud_0 = {
                "type": "pointcloud",
                "detector_id": 0,
                "points": points.tolist(),
            }
            offset = np.array([2.0, 0.0, 0.0])  # Move it 2 units along X axis
            points_offset = points + offset
            pointcloud_1 = {
                "type": "pointcloud",
                "detector_id": 1,
                "points": points_offset.tolist(),
            }
            obb_0 = {
                "type": "obb",
                "boxes": [[1, 2, 0.15, 1.0, 0.5, 0.3, 0], [5, 2, 0.15, 1.0, 0.5, 0.3, 0],  [7, 2, 0.5, 0.3, 0.3, 1.0, 0]], # x,y,z, l,w,h, theta
                "detector_id": 0, 
                "class_ids": [0, 1, 2],
                "track_ids": [0, 1, 2]
            }
            obb_1 = {
                "type": "obb",
                "boxes": [[2, 1, 0, 1.0, 0.5, 0.3, 0]], # x,y,z, h,w,d, theta
                "detector_id": 1, 
                "class_ids": [0],
                "track_ids": [3]
            }
            
            to_remove = set()
            
            async def send_to_client(ws, detector_pc, detecor_obb):
                if ws.application_state == WebSocketState.CONNECTED:
                    try:
                        await ws.send_text(json.dumps(detector_pc))
                        await ws.send_text(json.dumps(detecor_obb))
                    except Exception as e:
                        print("Send failed:", e)
                        to_remove.add(ws)
            
            await asyncio.gather(*(send_to_client(ws, pointcloud_0, obb_0) for ws in list(clients)))
            await asyncio.gather(*(send_to_client(ws, pointcloud_1, obb_1) for ws in list(clients)))
            
            for ws in to_remove:
                clients.discard(ws)
                
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_fake_data())

if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
