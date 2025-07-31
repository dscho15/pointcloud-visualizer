import math 

obb_0_boxes = [
    [1.5, 2, 0.15, 1.0, 0.5, 0.3, 0],  # straight line
    [5, 2.4, 0.15, 1.0, 0.5, 0.3, 0],  # circle
    [7, 2, 0.5, 0.3, 0.3, 1.0, 0],     # triangle
]

# Parameters to keep track of movement state
straight_speed = 10.0  # m per loop, along +x axis
direction = 1
circle_center = (5, 2.4)
circle_radius = 20.0
circle_angle = 0

triangle_points = [(7, 2), (-10, -2), (2, -10)]
triangle_index = 0
triangle_pos = list(triangle_points[0])
triangle_target = list(triangle_points[1])
triangle_speed = 0.5

def update_bbs(): 
    global obb_0_boxes, direction, circle_angle, triangle_index, triangle_pos, triangle_target

    # --- Update Straight Movement (box 0) ---
    if obb_0_boxes[0][0] > 50:
        direction = -1
    elif obb_0_boxes[0][0] < 0:
        direction = 1
    
    dx0 = straight_speed * direction
    obb_0_boxes[0][0] += dx0
    obb_0_boxes[0][6] = 0 if direction == 1 else math.pi  # Facing right (0 rad) or left (π rad)

    # --- Update Circular Movement (box 1) ---
    circle_angle += 5./ circle_radius
    if circle_angle > 2 * math.pi:
        circle_angle -= 2 * math.pi

    cx = circle_center[0] + circle_radius * math.cos(circle_angle)
    cy = circle_center[1] + circle_radius * math.sin(circle_angle)

    # Compute direction as derivative of circle position (tangent vector)
    tangent_angle = circle_angle + math.pi / 2  # Perpendicular to radius vector, counterclockwise
    obb_0_boxes[1][0] = cx
    obb_0_boxes[1][1] = cy
    obb_0_boxes[1][6] = tangent_angle % (2 * math.pi)

    # --- Update Triangle Movement (box 2) ---
    dx = triangle_target[0] - triangle_pos[0]
    dy = triangle_target[1] - triangle_pos[1]
    dist = math.hypot(dx, dy)

    if dist < triangle_speed:
        triangle_index = (triangle_index + 1) % len(triangle_points)
        triangle_pos = triangle_target
        triangle_target = list(triangle_points[(triangle_index + 1) % len(triangle_points)])
        angle = math.atan2(
            triangle_target[1] - triangle_pos[1],
            triangle_target[0] - triangle_pos[0]
        )
    else:
        triangle_pos[0] += triangle_speed * dx / dist
        triangle_pos[1] += triangle_speed * dy / dist
        angle = math.atan2(dy, dx)

    obb_0_boxes[2][0] = triangle_pos[0]
    obb_0_boxes[2][1] = triangle_pos[1]
    obb_0_boxes[2][6] = angle % (2 * math.pi)

    return obb_0_boxes

""""""""""mock data end """