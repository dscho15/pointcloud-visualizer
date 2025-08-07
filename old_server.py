import numpy as np
import json
import random
import asyncio
from pathlib import Path
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketState
from natsort import natsorted
import math
from mock import update_bbs

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



prev_obb_by_id = {}

heatmap_resolution = 0.25  # meters per cell
world_min = -100.0
world_max = 100.0
max_speed_possible = 130
heatmap_width = int((world_max - world_min) / heatmap_resolution)  # = 800
heatmap_height = heatmap_width  # = 800
heatmap_grid = np.zeros((heatmap_height, heatmap_width, 5), dtype=np.float32)


def world_to_grid(x, y):
    grid_x = int((x - world_min) / heatmap_resolution)
    grid_y = int((y - world_min) / heatmap_resolution)
    return grid_x, grid_y


def update_heatmap(boxes):
    global heatmap_grid 
    alpha = 0.2
    timestamp = boxes["timestamp"]
    track_ids = boxes["track_ids"]
    for idx,box in enumerate(boxes["boxes"]):
        # For each obb, add weight to occupied area on heatmap 
        x, y,_, box_w, box_d,_, theta = box#[0], box[1], box[3], box[4], box[6]
        
        grid_x, grid_y = world_to_grid(x, y)

        occ_area_x = max(1, int(box_w / heatmap_resolution))
        occ_area_y = max(1, int(box_d / heatmap_resolution))

        start_x = grid_x - occ_area_x // 2
        start_y = grid_y - occ_area_y // 2
        
        # Find object heading to update heatmap heading 
        obj_head_x = math.cos(theta)
        obj_head_y = math.sin(theta)
        
        # Calc speed: 
        track_id = track_ids[idx]
        prev = prev_obb_by_id.get(track_id)
        speed = 0.0
        if prev:
            dt = timestamp - prev["time"]
            if dt > 0:
                dx = x - prev["x"]
                dy = y - prev["y"]
                speed = math.hypot(dx, dy) / dt  # m/s
        prev_obb_by_id[track_id] = {"x": x, "y": y, "time": timestamp}

        for dx in range(occ_area_x):
            for dy in range(occ_area_y):
                xi = start_x + dx
                yi = start_y + dy
                if 0 <= xi < heatmap_width and 0 <= yi < heatmap_height:
                    cell = heatmap_grid[yi, xi]
                    cell[0] += 1.0
                    
                    acc_head_x = cell[1]
                    acc_head_y = cell[2]
                    cell[1] = (1 - alpha) * acc_head_x + alpha * obj_head_x
                    cell[2] = (1 - alpha) * acc_head_y + alpha * obj_head_y
                    cell[3] = (cell[3] * (cell[0] - 1) + speed) / cell[0]  # average
                    cell[4] = max(cell[4], speed)

        

async def broadcast_fake_data():
    i = 0
    while True:
        files = natsorted(list(Path("./recording/interval_").glob("interval_*.npy")))

        if clients and len(files) > 0:
            file = files[i % len(files)]
            i += 1
            
            points = np.load(file)[:, :3]
            timestamp = time.time()
            pointcloud_0 = {
                "type": "pointcloud",
                "detector_id": 0,
                "pc_type": "foreground",
                "points": points.tolist(),
                "timestamp": timestamp
                
            }
            offset = np.array([4.0, 4.0, 0.0])  # Move it 2 units along X axis

            points_offset = points + offset

            pointcloud_1 = {
                "type": "pointcloud",
                "detector_id": 0,
                "pc_type": "background",
                "points": points_offset.tolist(),
                "timestamp": timestamp                
            }
                     
            obb = update_bbs()
            obb_0 = {
                "type": "obb",
                "boxes": obb, #x y z h w d theta
                "detector_id": 0,
                "class_ids": [0, 1, 2],
                "track_ids": [0, 1, 2], 
                "timestamp": timestamp, 
                "scores": [0.5,0.5,0.5]
            }
 

           

            to_remove = set()

            async def send_to_client(ws, data):
                if ws.application_state == WebSocketState.CONNECTED:
                    try:
                        await ws.send_text(json.dumps(data))
                    except Exception as e:
                        print("Send failed:", e)
                        to_remove.add(ws)

            # Send pointclouds, obbs, heatmap
            # print(f"Sending pointcloud to {len(clients)} clients")
     
            await asyncio.gather(*(send_to_client(ws, pointcloud_0) for ws in list(clients)))
            
            if (i == 1): 
                await asyncio.gather(*(send_to_client(ws, pointcloud_1) for ws in list(clients)))
            
            await asyncio.gather(*(send_to_client(ws, obb_0) for ws in list(clients)))

            # await asyncio.gather(*(send_to_client(ws, heatmap_data) for ws in list(clients)))
            # await asyncio.gather(*(send_to_client(ws, heading_data) for ws in list(clients)))
            # await asyncio.gather(*(send_to_client(ws, avg_speed_data) for ws in list(clients)))
            # await asyncio.gather(*(send_to_client(ws, max_speed_data) for ws in list(clients)))
            

            for ws in to_remove:
                clients.discard(ws)

        await asyncio.sleep(0.1)



@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_fake_data())

if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)