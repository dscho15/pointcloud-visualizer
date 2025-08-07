import numpy as np
import json
import random
import asyncio
from pathlib import Path
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketState
from natsort import natsorted
import math
from unused.mockdata import update_bbs
from pydantic import BaseModel
from typing import Dict, Any, Optional

app = FastAPI()

# Store connected WebSocket clients
clients = set()

# Store current settings (in-memory for this example)
current_settings = {}

# Pydantic models for API
class SettingsModel(BaseModel):
    timestamp: str
    version: str
    pointClouds: Optional[Dict[str, Any]] = None
    satellite: Optional[Dict[str, Any]] = None
    visualization: Optional[Dict[str, Any]] = None
    camera: Optional[Dict[str, Any]] = None
    grid: Optional[Dict[str, Any]] = None

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def get_index():
    return FileResponse("static/index.html")

# API Endpoints for settings management
@app.post("/api/settings")
async def save_settings(settings: SettingsModel):
    """Save current visualizer settings"""
    global current_settings
    current_settings = settings.dict()
    
    # You could also save to a file or database here
    # with open("settings.json", "w") as f:
    #     json.dump(current_settings, f, indent=2)
    
    return {
        "status": "success",
        "message": "Settings saved successfully",
        "timestamp": settings.timestamp
    }

@app.get("/api/settings")
async def get_settings():
    """Get current visualizer settings"""
    global current_settings
    
    if not current_settings:
        # Return default/empty settings if none exist
        return {
            "status": "no_settings",
            "message": "No settings found",
            "settings": None
        }
    
    return {
        "status": "success",
        "settings": current_settings
    }

@app.get("/api/settings/pointcloud/{detector_id}")
async def get_pointcloud_settings(detector_id: str):
    """Get settings for a specific point cloud detector"""
    global current_settings
    
    if not current_settings or "pointClouds" not in current_settings:
        raise HTTPException(status_code=404, detail="No point cloud settings found")
    
    pc_settings = current_settings["pointClouds"].get(detector_id)
    if not pc_settings:
        raise HTTPException(status_code=404, detail=f"No settings found for detector {detector_id}")
    
    return {
        "detector_id": detector_id,
        "settings": pc_settings
    }

@app.get("/api/settings/satellite")
async def get_satellite_settings():
    """Get satellite-specific settings"""
    global current_settings
    
    if not current_settings or "satellite" not in current_settings:
        raise HTTPException(status_code=404, detail="No satellite settings found")
    
    return {
        "settings": current_settings["satellite"]
    }

@app.get("/api/settings/export")
async def export_settings():
    """Export all settings as JSON file"""
    global current_settings
    
    if not current_settings:
        raise HTTPException(status_code=404, detail="No settings to export")
    
    # Create a downloadable JSON response
    from fastapi.responses import JSONResponse
    
    return JSONResponse(
        content=current_settings,
        headers={
            "Content-Disposition": "attachment; filename=pointcloud-settings.json"
        }
    )

@app.delete("/api/settings")
async def clear_settings():
    """Clear all saved settings"""
    global current_settings
    current_settings = {}
    
    return {
        "status": "success",
        "message": "All settings cleared"
    }


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
    uvicorn.run("server:app", host="192.168.1.12", port=8000, reload=True)
