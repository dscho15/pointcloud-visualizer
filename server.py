import numpy as np
import json
import random
import asyncio

from pathlib import Path

import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketState
from natsort import natsorted
from contextlib import asynccontextmanager

import math

from pydantic import BaseModel
from typing import Dict, Any, Optional
from server_helpers import  load_roadnet_dict, calc_overlaps, IntersectionModel, OverlapQuery
from satellite import SatelliteImageDownloader

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global startup_time
    startup_time = time.time()
    asyncio.create_task(broadcaster())
    print(f"Server started at {startup_time}")
    yield
    # Shutdown
    print("Server shutting down...")
    # Signal broadcaster to stop
    await message_queue.put(None)
    
    # Close all WebSocket connections gracefully
    if clients:
        close_tasks = []
        for ws in list(clients):
            try:
                close_tasks.append(ws.close(code=1001, reason="Server shutdown"))
            except Exception as e:
                print(f"Error closing WebSocket {id(ws)}: {e}")
        
        if close_tasks:
            await asyncio.gather(*close_tasks, return_exceptions=True)
    
    print("Server shutdown complete")

app = FastAPI(lifespan=lifespan)

# Store connected WebSocket clients with metadata
clients = set()
client_metadata = {}  # Track client connection info

# Shared queue for broadcasting messages
message_queue = asyncio.Queue()

# Store current settings (in-memory for this example)
current_settings = {}

# Connection tracking
connection_stats = {
    "total_connections": 0,
    "active_connections": 0,
    "failed_connections": 0,
    "last_disconnect": None
}

sat_image_downloader = SatelliteImageDownloader("sk.eyJ1Ijoic3dhcmNvcGFsbSIsImEiOiJjbWRpbXRjbmQwZTdvMmxxeXZzb3g2OHBhIn0.xObuob5UikDQ08b4D2dIDw")


INTERSECTIONS_DIR = Path("data/intersections")
INTERSECTIONS_DIR.mkdir(parents=True, exist_ok=True)
current_intersection = None


# -----------------------------
# Pydantic models for API
# -----------------------------
class SettingsModel(BaseModel):
    timestamp: str
    version: str
    pointClouds: Optional[Dict[str, Any]] = None
    satellite: Optional[Dict[str, Any]] = None
    visualization: Optional[Dict[str, Any]] = None
    camera: Optional[Dict[str, Any]] = None
    grid: Optional[Dict[str, Any]] = None

# -----------------------------
# Serve static files
# -----------------------------
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/data/satellite", StaticFiles(directory="data/satellite"), name="satellite")

@app.get("/")
def get_index():
    return FileResponse("static/index.html")

# -----------------------------
# Health check and status endpoints
# -----------------------------
@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "server": "pointcloud-visualizer",
        "version": "1.0.0",
        "uptime": time.time() - startup_time if 'startup_time' in globals() else 0
    }

@app.get("/api/status")
async def server_status():
    """Detailed server status including WebSocket connections"""
    return {
        "server": {
            "status": "running",
            "timestamp": time.time(),
            "uptime": time.time() - startup_time if 'startup_time' in globals() else 0,
            "current_intersection": current_intersection
        },
        "websocket": {
            "active_connections": connection_stats["active_connections"],
            "total_connections": connection_stats["total_connections"],
            "failed_connections": connection_stats["failed_connections"],
            "last_disconnect": connection_stats["last_disconnect"],
            "clients": [
                {
                    "client_id": cid,
                    "connected_at": metadata["connected_at"],
                    "client_ip": metadata["client_ip"],
                    "messages_received": metadata["messages_received"],
                    "connection_duration": time.time() - metadata["connected_at"]
                }
                for cid, metadata in client_metadata.items()
            ]
        },
        "settings": {
            "has_settings": bool(current_settings),
            "settings_keys": list(current_settings.keys()) if current_settings else []
        }
    }

@app.get("/api/ws/stats")
async def websocket_stats():
    """WebSocket connection statistics"""
    return {
        "active_connections": connection_stats["active_connections"],
        "total_connections": connection_stats["total_connections"],
        "failed_connections": connection_stats["failed_connections"],
        "last_disconnect": connection_stats["last_disconnect"],
        "queue_size": message_queue.qsize()
    }

# -----------------------------
# Settings management endpoints
# -----------------------------
@app.post("/api/settings")
async def save_settings(settings: SettingsModel):
    """Save current visualizer settings"""
    global current_settings
    current_settings = settings.dict()
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

# -----------------------------
# WebSocket broadcaster
# -----------------------------
async def broadcaster():
    """Continuously broadcast messages from the queue to all connected clients."""
    while True:
        try:
            message = await message_queue.get()
            if message is None:
                break  # Allows shutdown
            
            if not clients:
                continue  # No clients to broadcast to
                
            to_remove = []
            send_tasks = []

            for ws in list(clients):  # Create a copy to avoid modification during iteration
                if ws.application_state == WebSocketState.CONNECTED:
                    send_tasks.append(ws.send_text(message))
                else:
                    to_remove.append(ws)
                    print(f"Removing disconnected client: {id(ws)}")

            if send_tasks:
                results = await asyncio.gather(*send_tasks, return_exceptions=True)
                for ws, res in zip(list(clients), results):
                    if isinstance(res, Exception):
                        print(f"Send failed for client {id(ws)}: {res}")
                        to_remove.append(ws)
                        connection_stats["failed_connections"] += 1

            # Clean up disconnected clients
            for ws in to_remove:
                if ws in clients:
                    clients.discard(ws)
                    client_metadata.pop(id(ws), None)
                    connection_stats["active_connections"] = len(clients)
                    
        except Exception as e:
            print(f"Broadcaster error: {e}")
            continue

# Event handlers moved to lifespan function above

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = id(websocket)
    try:
        await websocket.accept()
        clients.add(websocket)
        
        # Track client metadata
        client_metadata[client_id] = {
            "connected_at": time.time(),
            "client_ip": websocket.client.host if websocket.client else "unknown",
            "messages_received": 0
        }
        
        # Update connection stats
        connection_stats["total_connections"] += 1
        connection_stats["active_connections"] = len(clients)
        
        print(f"Client connected: {client_id} from {client_metadata[client_id]['client_ip']}")
        print(f"Active connections: {connection_stats['active_connections']}")

        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connection_status",
            "status": "connected",
            "client_id": client_id,
            "server_time": time.time()
        }))

        while True:
            try:
                data = await websocket.receive_text()
                client_metadata[client_id]["messages_received"] += 1
                
                # Echo message back to all clients (broadcast)
                await message_queue.put(data)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"Error receiving message from client {client_id}: {e}")
                break
                
    except Exception as e:
        print(f"WebSocket connection error for client {client_id}: {e}")
        connection_stats["failed_connections"] += 1
    finally:
        # Clean up client
        if websocket in clients:
            clients.discard(websocket)
        client_metadata.pop(client_id, None)
        
        # Update stats
        connection_stats["active_connections"] = len(clients)
        connection_stats["last_disconnect"] = time.time()
        
        print(f"Client disconnected: {client_id}")
        print(f"Active connections: {connection_stats['active_connections']}")


@app.post("/api/roadnet")
async def save_roadnet(data: dict):
    """Save roadnet data inside a specific intersection JSON"""
    try:
        if not current_intersection:
            raise HTTPException(
                status_code=400, 
                detail={
                    "error": "no_intersection_selected",
                    "message": "No intersection has been selected. Please load an intersection first.",
                    "suggestion": "Use GET /api/intersections to list available intersections"
                }
            )
        
        file_path = INTERSECTIONS_DIR / f"{current_intersection}.json"
        if not file_path.exists():
            raise HTTPException(
                status_code=404, 
                detail={
                    "error": "intersection_not_found",
                    "message": f"Intersection configuration file not found: {current_intersection}",
                    "file_path": str(file_path),
                    "suggestion": "Verify the intersection name and try loading it again"
                }
            )

        # Load existing intersection
        intersection = json.loads(file_path.read_text())
        intersection["roadnet"] = data
        intersection["updated"] = time.time()
        
        file_path.write_text(json.dumps(intersection, indent=2))

        return {
            "status": "success", 
            "message": f"Roadnet saved for {current_intersection}",
            "intersection": current_intersection,
            "timestamp": time.time()
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "json_decode_error",
                "message": "Failed to parse intersection configuration file",
                "details": str(e)
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_server_error",
                "message": "An unexpected error occurred while saving roadnet data",
                "details": str(e)
            }
        )


@app.get("/api/roadnet")
async def get_roadnet():
    """Get roadnet data from a specific intersection JSON"""
    try:
        if not current_intersection:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "no_intersection_selected", 
                    "message": "No intersection has been selected. Please load an intersection first.",
                    "suggestion": "Use GET /api/intersections to list available intersections"
                }
            )
        
        roadnet_data = load_roadnet_dict(current_intersection)
        return {
            "status": "success",
            "intersection": current_intersection,
            "roadnet": roadnet_data,
            "timestamp": time.time()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_server_error",
                "message": "An unexpected error occurred while loading roadnet data",
                "intersection": current_intersection,
                "details": str(e)
            }
        )


@app.post("/api/roadnet/overlaps")
async def find_overlaps(query: OverlapQuery):
    roadnet = load_roadnet_dict(current_intersection)
    return calc_overlaps(query, roadnet)


@app.get("/api/intersections")
async def list_intersections():
    """List all available intersections"""
    files = natsorted([f.stem for f in INTERSECTIONS_DIR.glob("*.json")])
    return {"intersections": files}

@app.get("/api/intersections/{name}")
async def get_intersection(name: str):
    """Load one intersection JSON"""
    global current_intersection
    current_intersection = name
    file_path = INTERSECTIONS_DIR / f"{name}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Intersection {name} not found")
    return json.loads(file_path.read_text())

@app.post("/api/intersections")
async def create_intersection(intersection: IntersectionModel):
    """Create a new intersection file"""
    try:
        global current_intersection
        
        # Validate intersection name
        if not intersection.name or not intersection.name.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_name",
                    "message": "Intersection name cannot be empty",
                    "field": "name"
                }
            )
        
        # Validate coordinates
        if not (-90 <= intersection.lat <= 90):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_latitude",
                    "message": "Latitude must be between -90 and 90 degrees",
                    "field": "lat",
                    "value": intersection.lat
                }
            )
            
        if not (-180 <= intersection.lon <= 180):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_longitude", 
                    "message": "Longitude must be between -180 and 180 degrees",
                    "field": "lon",
                    "value": intersection.lon
                }
            )

        current_intersection = intersection.name.strip()
        file_path = INTERSECTIONS_DIR / f"{current_intersection}.json"

        if file_path.exists():
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "intersection_exists",
                    "message": f"Intersection '{current_intersection}' already exists",
                    "intersection_name": current_intersection,
                    "suggestion": "Use a different name or delete the existing intersection first"
                }
            )

        sat_path = f"data/satellite/{current_intersection}.png"

        # Download satellite image with error handling
        try:
            sat_image_downloader.create_satellite_image(intersection.lat, intersection.lon, 200, 200, sat_path)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "satellite_download_failed",
                    "message": "Failed to download satellite imagery",
                    "coordinates": {"lat": intersection.lat, "lon": intersection.lon},
                    "details": str(e)
                }
            )

        data = {
            "name": current_intersection,
            "lat": intersection.lat,
            "lon": intersection.lon,
            "created": time.time(),
            "updated": time.time(),
            "satellite_image": sat_path,
            "roadnet": {}
        }

        file_path.write_text(json.dumps(data, indent=2))

        return {
            "status": "success", 
            "message": "Intersection created successfully", 
            "intersection": data,
            "timestamp": time.time()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_server_error",
                "message": "An unexpected error occurred while creating intersection",
                "details": str(e)
            }
        )



# -----------------------------
# Run the server
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    print("Starting server on http://localhost:8000")
    uvicorn.run(
        "server:app",
        host="localhost",
        port=8000,
        reload=True,
        loop="uvloop",       # Faster event loop
        ws="websockets"      # Faster WebSocket backend
    )
