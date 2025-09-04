from pydantic import BaseModel, Field
from typing import List, Tuple
from shapely.geometry import Polygon as ShapelyPolygon
from shapely.ops import unary_union
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
import json
ROADNET_PATH = Path("roadnet.json")
INTERSECTIONS_DIR = Path("data/intersections")


def load_roadnet_dict(current_intersection) -> dict:
    file_path = INTERSECTIONS_DIR / f"{current_intersection}.json"
    if not file_path.exists():
        print("Not found: ", file_path)
        raise HTTPException(status_code=404, detail=f"No Intersection chosen or configuration not found")
    intersection = json.loads(file_path.read_text())
    return intersection.get("roadnet", {})

def safe_polygon(coords: List[Tuple[float, float]]) -> ShapelyPolygon:
    """
    Build a valid Shapely polygon from coords; fix self-intersections if needed.
    """
    poly = ShapelyPolygon(coords)
    if not poly.is_valid:
        # common fix for slight self-intersections
        poly = poly.buffer(0)
    return poly

class OverlapQuery(BaseModel):
    # One polygon sent by your external producer (same coordinate system as roadnet)
    polygon: List[Tuple[float, float]] = Field(..., description="List of [x,y] vertices")
    # Optional: minimum percent overlap to report (relative to incoming polygon area)
    min_pct: float = Field(0.0, ge=0.0, le=100.0)

class OverlapResult(BaseModel):
    app_id: int
    lane_id: int
    direction_vector: Tuple[float, float]
    overlap_pct: float



class IntersectionModel(BaseModel):
    name: str
    lat: float
    lon: float

def calc_overlaps(query: OverlapQuery, roadnet: dict):
    """
    Check the incoming polygon against all lane segments.
    Return all segments that overlap >= min_pct of the incoming polygon.
    overlap_pct is (intersection_area / incoming_polygon_area) * 100.
    """

    incoming = safe_polygon(query.polygon)
    if incoming.is_empty or incoming.area == 0:
        raise Warning(status_code=400, detail="Incoming polygon is empty or degenerate")

    incoming_area = incoming.area
    min_fraction = query.min_pct / 100.0

    matches: List[OverlapResult] = []

    for app in roadnet.get("Approaches", []):
        app_id = app.get("app_id")
        for lane in app.get("lanes", []):
            lane_id = lane.get("lane_id")
            segments = lane.get("segments", [])

            for _, seg in enumerate(segments):
                poly_coords = seg.get("polygon", [])
                if len(poly_coords) < 3:
                    continue  # not a polygon

                seg_poly = safe_polygon(poly_coords)
                if seg_poly.is_empty or seg_poly.area == 0:
                    continue

                inter = incoming.intersection(seg_poly)
                if inter.is_empty:
                    continue

                inter_area = inter.area
                pct = 100.0 * (inter_area / incoming_area)

                if pct >= query.min_pct:
                    # direction vector: we stored as [[dx, dy], ...]; take the first
                    dir_vec = (0.0, 0.0)
                    dv = seg.get("direction_vectors") or []
                    if isinstance(dv, list) and len(dv) > 0 and len(dv[0]) == 2:
                        dir_vec = (float(dv[0][0]), float(dv[0][1]))

                    matches.append(OverlapResult(
                        app_id=int(app_id),
                        lane_id=int(lane_id),
                        direction_vector=dir_vec,
                        overlap_pct=float(pct)
                    ))

    # Sort by highest overlap first (optional)
    matches.sort(key=lambda m: m.overlap_pct, reverse=True)

    return matches



