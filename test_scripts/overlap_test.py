import requests

SERVER_URL = "http://192.168.1.12:8000/api/roadnet/overlaps"

def test_polygons():
    # Test polygons designed to overlap with mock roadnet
    polygons = [
        [[5,5],[15,5],[15,15],[5,15],[5,5]],       # overlaps lane 101 segments
        [[32,32],[38,32],[38,38],[32,38],[32,32]], # overlaps lane 102
        [[-8,-8],[-6,-8],[-6,-6],[-8,-6],[-8,-8]], # overlaps lane 201
        [[50,50],[55,50],[55,55],[50,55],[50,50]]  # no overlap
    ]

    for i, poly in enumerate(polygons, start=1):
        payload = {
            "polygon": poly,
            "min_pct": 1.0  # very low threshold
        }
        print(f"\n--- Sending polygon #{i} ---")
        print("Payload:", poly)

        try:
            r = requests.post(SERVER_URL, json=payload)
            r.raise_for_status()
            resp = r.json()
            print("Response:")
            print(resp)
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    test_polygons()
