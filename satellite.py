import io
import math
import requests
from PIL import Image
from typing import Tuple, List
from collections import defaultdict

class SatelliteImageDownloader:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.tile_count = 0
    
    def wgs84_to_tile(self, lat: float, lon: float, zoom: int, tile_size: int = 256) -> Tuple[Tuple[int, int], Tuple[int, int]]:
        """Convert WGS84 coordinates to tile coordinates and pixel coordinates."""
        # Web Mercator projection
        lat_rad = math.radians(lat)
        n = 2 ** zoom
        
        tile_x = int((lon + 180) / 360 * n)
        tile_y = int((1 - math.asinh(math.tan(lat_rad)) / math.pi) / 2 * n)
        
        # Calculate pixel coordinates within the tile
        pixel_x = int(((lon + 180) / 360 * n - tile_x) * tile_size)
        pixel_y = int(((1 - math.asinh(math.tan(lat_rad)) / math.pi) / 2 * n - tile_y) * tile_size)
        
        return (tile_x, tile_y), (pixel_x, pixel_y)
    
    def meters_to_bbox(self, center_lat: float, center_lon: float, width_m: int, height_m: int) -> Tuple[float, float, float, float]:
        """Convert center point and dimensions in meters to bounding box."""
        # Approximate conversion (more accurate at equator)
        lat_deg_per_m = 1 / 111111  # roughly 111km per degree
        lon_deg_per_m = lat_deg_per_m / math.cos(math.radians(center_lat))
        
        half_height_deg = (height_m / 2) * lat_deg_per_m
        half_width_deg = (width_m / 2) * lon_deg_per_m
        
        return (
            center_lon - half_width_deg,  # min_lon
            center_lat - half_height_deg,  # min_lat  
            center_lon + half_width_deg,  # max_lon
            center_lat + half_height_deg   # max_lat
        )
    
    def get_tiles_for_bbox(self, min_lon: float, min_lat: float, max_lon: float, max_lat: float, zoom: int, tile_size: int = 256):
        """Get all tile coordinates needed to cover the bounding box."""
        # Get corner tiles
        (nw_tile_x, nw_tile_y), (nw_pixel_x, nw_pixel_y) = self.wgs84_to_tile(max_lat, min_lon, zoom, tile_size)
        (se_tile_x, se_tile_y), (se_pixel_x, se_pixel_y) = self.wgs84_to_tile(min_lat, max_lon, zoom, tile_size)
        
        # Generate all tiles in the range
        tiles = []
        for x in range(nw_tile_x, se_tile_x + 1):
            for y in range(nw_tile_y, se_tile_y + 1):
                tiles.append((x, y))
        
        # Calculate crop bounds for final image
        left_crop = nw_pixel_x
        top_crop = nw_pixel_y
        right_crop = se_pixel_x + (se_tile_x - nw_tile_x) * tile_size
        bottom_crop = se_pixel_y + (se_tile_y - nw_tile_y) * tile_size
        
        return tiles, (left_crop, top_crop, right_crop, bottom_crop)
    
    def download_tile(self, x: int, y: int, zoom: int, tile_size: int = 256) -> Image.Image:
        """Download a single tile from Mapbox."""
        url = f'https://api.mapbox.com/v4/mapbox.satellite/{zoom}/{x}/{y}'
        url += '@2x.png' if tile_size == 512 else '.png'
        
        params = {'access_token': self.api_key}
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content)).convert("RGB")
        except requests.RequestException as e:
            print(f"Error downloading tile ({x}, {y}): {e}")
            # Return a blank tile as fallback
            return Image.new('RGB', (tile_size, tile_size), color=(128, 128, 128))
    
    def stitch_tiles(self, tiles: List[Tuple[int, int]], zoom: int, tile_size: int = 256) -> Image.Image:
        """Download and stitch tiles into a single image."""
        if not tiles:
            raise ValueError("No tiles to stitch")
        
        # Group tiles by column (x coordinate)
        columns = defaultdict(list)
        for x, y in tiles:
            columns[x].append(y)
        
        # Sort to ensure consistent ordering
        sorted_x = sorted(columns.keys())
        for x in sorted_x:
            columns[x].sort()
        
        # Create columns
        column_images = []
        for x in sorted_x:
            column_tiles = []
            for y in columns[x]:
                tile = self.download_tile(x, y, zoom, tile_size)
                column_tiles.append(tile)
                self.tile_count += 1
            
            # Stack tiles vertically to create column
            if column_tiles:
                column_height = len(column_tiles) * tile_size
                column_img = Image.new('RGB', (tile_size, column_height))
                
                for i, tile in enumerate(column_tiles):
                    column_img.paste(tile, (0, i * tile_size))
                
                column_images.append(column_img)
        
        # Combine columns horizontally
        if not column_images:
            raise ValueError("No column images created")
        
        total_width = len(column_images) * tile_size
        total_height = column_images[0].height
        final_image = Image.new('RGB', (total_width, total_height))
        
        for i, column in enumerate(column_images):
            final_image.paste(column, (i * tile_size, 0))
        
        return final_image
    
    def create_satellite_image(self, center_lat: float, center_lon: float, width_m: int, height_m: int, 
                             output_path: str, zoom: int = 19, tile_size: int = 512):
        """Create a satellite image for the specified area."""
        # Convert center point and dimensions to bounding box
        min_lon, min_lat, max_lon, max_lat = self.meters_to_bbox(center_lat, center_lon, width_m, height_m)
        
        # Get tiles needed
        tiles, crop_bounds = self.get_tiles_for_bbox(min_lon, min_lat, max_lon, max_lat, zoom, tile_size)
        
        print(f"Downloading {len(tiles)} tiles...")
        
        # Stitch tiles together
        stitched_image = self.stitch_tiles(tiles, zoom, tile_size)
        
        # Crop to exact bounds
        cropped_image = stitched_image.crop(crop_bounds)
        
        # Save result
        cropped_image.save(output_path)
        print(f"Satellite image saved to {output_path}")
        print(f"Total tiles downloaded: {self.tile_count}")

# Usage example:
if __name__ == "__main__":
    API_KEY = "sk.eyJ1Ijoic3dhcmNvcGFsbSIsImEiOiJjbWRpbXRjbmQwZTdvMmxxeXZzb3g2OHBhIn0.xObuob5UikDQ08b4D2dIDw"
    
    downloader = SatelliteImageDownloader(API_KEY)
    
    # Download 200x200 meter satellite image
    downloader.create_satellite_image(
        center_lat=40.7128,  # NYC latitude
        center_lon=-74.0060, # NYC longitude
        width_m=200,
        height_m=200,
        output_path="satellite_image.png",
        zoom=19
    )