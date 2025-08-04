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
from mockdata import update_bbs

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
            data = await websocket.receive_text()
            # Broadcast received data to all other clients
            for ws in list(clients):
                if ws != websocket and ws.application_state == WebSocketState.CONNECTED:
                    try:
                        await ws.send_text(data)
                    except Exception as e:
                        print("Send failed:", e)
                        clients.discard(ws)
    except WebSocketDisconnect:
        pass
    finally:
        clients.remove(websocket)
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://localhost:8000")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
