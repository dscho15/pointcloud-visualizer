
import io
import requests
from collections import defaultdict
from PIL import Image
import math 
import numpy as np

#API_KEY = "pk.eyJ1Ijoic3dhcmNvcGFsbSIsImEiOiJjbTl3bjI5cXowdHBlMmxzOXZvanZrdWY3In0.bBbAVRn74l-JlIDKAilosA"
API_KEY = "sk.eyJ1Ijoic3dhcmNvcGFsbSIsImEiOiJjbWRpbXRjbmQwZTdvMmxxeXZzb3g2OHBhIn0.xObuob5UikDQ08b4D2dIDw"
def wgs2tile(lat: np.float64, lon = np.float64, zoom_level: int = 22, tile_size: int = 256):
    mercator = -math.log(math.tan((0.25 +  lat / 360) * math.pi))
    world_x = tile_size * (lon / 360 + 0.5)
    world_y =  tile_size / 2 * (1 +  mercator / math.pi)
    pixel_x = math.floor(world_x*2**zoom_level)
    pixel_y = math.floor(world_y*2**zoom_level)
    tile_x = math.floor(pixel_x /tile_size)
    tile_y = math.floor(pixel_y/tile_size)
    
    return (tile_x, tile_y), (pixel_x, pixel_y)

def all_tile_ids(nw_tile, ne_tile, sw_tile, se_tile):
    x_min = min(nw_tile[0], sw_tile[0])
    x_max = max(ne_tile[0], se_tile[0])
    y_min = min(nw_tile[1], ne_tile[1])
    y_max = max(sw_tile[1], se_tile[1])
   
    tiles = []
    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            tiles.append((x, y))
    return tiles

def get_tiles(min_lon: np.float64, min_lat: np.float64, max_lon: np.float64, max_lat: np.float64, zoom_level, tile_size):
    nw_tile, nw_pixel = wgs2tile(max_lat, min_lon, zoom_level, tile_size)
    ne_tile, _ = wgs2tile(max_lat, max_lon, zoom_level, tile_size)
    sw_tile, _ = wgs2tile(min_lat, min_lon, zoom_level, tile_size)
    se_tile, se_pixel = wgs2tile(min_lat, max_lon, zoom_level, tile_size)
    left_crop = nw_pixel[0] - tile_size*(nw_tile[0])
    upper_crop = nw_pixel[1] - tile_size*(nw_tile[1])
    right_crop = se_pixel[0] - tile_size*(nw_tile[0])
    lower_crop = se_pixel[1] - tile_size*(nw_tile[1])
  
    return all_tile_ids(nw_tile, ne_tile, sw_tile, se_tile), (left_crop, upper_crop, right_crop, lower_crop) 


def create_full_image(all_columns: list):
    img = Image.new('RGB', (all_columns[0].width * len(all_columns), all_columns[0].height ))
    col_width = all_columns[0].width
    paste_width = 0
    for tile in all_columns:
        img.paste(tile, ( paste_width, 0))
        paste_width+= col_width
    return img
  
def create_tile_column(all_tiles: list):
    try: 
        column = Image.new('RGB', (all_tiles[0].width, all_tiles[0].height *len(all_tiles)))
        img_height = all_tiles[0].height
        paste_height = 0
        for tile in all_tiles:
            column.paste(tile, (0, paste_height))
            paste_height+= img_height
        return column
    except Exception as e: 
        print("Exception in create_tile_column: ", str(e))
        return None

def m2latlon(center_pnt, height, width):
    lat_center, lon_center = center_pnt
    d_heigh = height/2 # lat
    d_width = width/2 # lon
    
    lat_in_m = 111111
    d_lat = d_heigh/lat_in_m
    
    lon_in_m = lat_in_m *math.cos(math.radians(lat_center))
    d_lon = d_width/lon_in_m
    
    min_lat = lat_center - d_lat
    max_lat = lat_center + d_lat
    min_lon = lon_center - d_lon
    max_lon = lon_center + d_lon
    
    return min_lon, min_lat, max_lon, max_lat

    

def create_sat(center_pnt: tuple, height: int= 200, width: int = 200, zoom_level: int = 20, tile_size: int = 512): 
    
    min_lon, min_lat, max_lon, max_lat = m2latlon(center_pnt=center_pnt, height=height, width=width)# west, south, east, north
    print("min_lon, min_lat, max_lon, max_lat: ", min_lon, ", ",min_lat, ", ",max_lon, ", ",max_lat)
    tiles, crop_bounds = get_tiles(min_lon=min_lon, min_lat=min_lat, max_lon=max_lon, max_lat=max_lat, zoom_level=zoom_level, tile_size=tile_size)
    print("Tiles: ", len(tiles))

    all_columns = []

    grouped = defaultdict(list)
    for x, y in tiles:
        grouped[x].append(y)

    # Iterate through x and then all y for that x
    cnt = 0
    for x in sorted(grouped):
        col_tiles = []
        for y in sorted(grouped[x]):
            cnt+= 1
            print("tile nr: ", cnt)
            # url = 'https://api.mapbox.com/v4/mapbox.satellite/'+str(zoom_level) +'/' + str(x)  +'/'+  str(y) 
            # url += '@2x.png' if tile_size == 512 else '.png'
            url = f'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{tile_size}/{zoom_level}/{x}/{y}@2x?access_token={API_KEY}'

            # params = {
            #     'access_token': API_KEY              
            # }
            
            response = requests.get(url)#, params=params)     
            if response.status_code == 200:
        
                sat_tile = Image.open(io.BytesIO(response.content)).convert("RGB")
                col_tiles.append(sat_tile)
        
            else: 
                print("Error while fetching mapbox satellite image: ", str(response.status_code))
        
        
        column_img = create_tile_column(col_tiles)
        # column_img.save(str(x)+"column.png")
        all_columns.append(column_img)
                    
    sat_png = create_full_image(all_columns)   
    sat_png.save("uncropped.png")
    cropped = sat_png.crop(crop_bounds)

    return cropped



center_pnt = (55.363585, 10.490014)
sat_img = create_sat(center_pnt)
sat_img.save("test.png")
           
                    
      