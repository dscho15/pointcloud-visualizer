from pydantic import BaseModel, Field
from typing import List, Tuple
from shapely.geometry import Polygon
from pathlib import Path
from fastapi import HTTPException
import json

INTERSECTIONS_DIR = Path("data/intersections")

class IntersectionModel(BaseModel):
    name: str = Field(..., description="Name of the intersection")
    lat: float = Field(..., ge=-90, le=90, description="Latitude coordinate")
    lon: float = Field(..., ge=-180, le=180, description="Longitude coordinate")

class OverlapQuery(BaseModel):
    polygon: List[Tuple[float, float]] = Field(..., description="List of [x,y] vertices")
    min_pct: float = Field(0.0, ge=0.0, le=100.0)

class OverlapResult(BaseModel):
    app_id: int
    lane_id: int
    direction_vector: Tuple[float, float]
    overlap_pct: float

def load_roadnet_dict(intersection_id: str) -> dict:
    file_path = INTERSECTIONS_DIR / f"{intersection_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Intersection configuration not found")
    
    intersection = json.loads(file_path.read_text())
    return intersection.get("roadnet", {})

def make_valid_polygon(coords: List[Tuple[float, float]]) -> Polygon:
    """Create a valid Shapely polygon, fixing self-intersections if needed."""
    poly = Polygon(coords)
    return poly.buffer(0) if not poly.is_valid else poly

def calc_overlaps(query: OverlapQuery, roadnet: dict) -> List[OverlapResult]:
    """Find all lane segments that overlap with the query polygon."""
    incoming = make_valid_polygon(query.polygon)
    
    if incoming.is_empty or incoming.area == 0:
        raise HTTPException(status_code=400, detail="Invalid polygon")
    
    matches = []
    
    for app in roadnet.get("Approaches", []):
        app_id = app.get("app_id")
        
        for lane in app.get("lanes", []):
            lane_id = lane.get("lane_id")
            
            for segment in lane.get("segments", []):
                poly_coords = segment.get("polygon", [])
                
                if len(poly_coords) < 3:
                    continue
                
                seg_poly = make_valid_polygon(poly_coords)
                if seg_poly.is_empty:
                    continue
                
                intersection = incoming.intersection(seg_poly)
                if intersection.is_empty:
                    continue
                
                overlap_pct = 100.0 * (intersection.area / incoming.area)
                
                if overlap_pct >= query.min_pct:
                    # Get direction vector (default to origin if missing)
                    direction_vectors = segment.get("direction_vectors", [])
                    dir_vec = (0.0, 0.0)
                    
                    if direction_vectors and len(direction_vectors[0]) == 2:
                        dir_vec = tuple(map(float, direction_vectors[0]))
                    
                    matches.append(OverlapResult(
                        app_id=int(app_id),
                        lane_id=int(lane_id),
                        direction_vector=dir_vec,
                        overlap_pct=overlap_pct
                    ))
    
    return sorted(matches, key=lambda m: m.overlap_pct, reverse=True)