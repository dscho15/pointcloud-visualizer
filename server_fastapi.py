import json
import random
import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketState

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
    while True:
        if clients:
            pointcloud = {
                "type": "pointcloud",
                "points": [[random.uniform(-1, 1) for _ in range(3)] for _ in range(300)]
            }
            obb = {
                "type": "obb",
                "center": [random.uniform(-1, 1) for _ in range(3)],
                "size": [1.0, 0.5, 0.3],
                "rotation": [
                    1, 0, 0,
                    0, 1, 0,
                    0, 0, 1
                ]
            }
            for ws in list(clients):
                if ws.application_state == WebSocketState.CONNECTED:
                    try:
                        await ws.send_text(json.dumps(pointcloud))
                        await ws.send_text(json.dumps(obb))
                    except Exception as e:
                        print("Send failed:", e)
        await asyncio.sleep(2)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(broadcast_fake_data())

if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://localhost:8000")
    uvicorn.run("server_fastapi:app", host="0.0.0.0", port=8000, reload=True)
