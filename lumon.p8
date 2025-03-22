pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- pico-8 3d maze game: severance hallways style
-- objective: start at the elevator and visit in order:
-- "optics and design", "mammalians nurturable", "wellness",
-- "choreography and merriment" then reach "mdr".
-- every play-through generates a new maze.

-------------------------
-- globals & constants --
-------------------------
mwidth = 21          -- maze grid width (odd for dfs carving)
mheight = 21         -- maze grid height
fov = 3.14159265 / 4 -- field of view (45 degrees)
maxd = 16            -- maximum raycast distance
step = 0.05          -- raycasting step increment

-------------------------
-- init & maze setup  --
-------------------------
function _init()
  -- build maze: fill with walls (1) then carve passages (0)
  maze = {}
  for y = 1, mheight do
    maze[y] = {}
    for x = 1, mwidth do
      maze[y][x] = 1
    end
  end
  carve(2, 2)

  -- define department names (in order)
  depts = { "elevator",
    "optics and design",
    "mammalians nurturable",
    "wellness",
    "choreography and merriment",
    "mdr" }

  -- pick random open (0) cells for each stop.
  local opens = {}
  for y = 1, mheight do
    for x = 1, mwidth do
      if maze[y][x] == 0 then
        add(opens, { x = x, y = y })
      end
    end
  end
  shuffle(opens)
  dept_positions = {}
  for i = 1, #depts do
    dept_positions[i] = opens[i]
  end
  current_dept = 1 -- index of last reached stop (elevator is start)

  -- set up player: start at the elevator cell center.
  player = {
    x = dept_positions[1].x - 0.5,
    y = dept_positions[1].y - 0.5,
    a = 0
  } -- facing right initially

  msg = ""
  show_minimap = false
  debug_mode = false
  game_state = "intro"
end

-- recursive dfs maze carving (cells are 1 for wall, 0 for passage)
function carve(x, y)
  maze[y][x] = 0
  local dirs = { { 0, -2 }, { 2, 0 }, { 0, 2 }, { -2, 0 } }
  shuffle(dirs)
  for d in all(dirs) do
    local nx = x + d[1]
    local ny = y + d[2]
    if ny > 0 and ny <= mheight and nx > 0 and nx <= mwidth and maze[ny][nx] == 1 then
      -- remove the wall between current cell and neighbor.
      maze[y + d[2] / 2][x + d[1] / 2] = 0
      carve(nx, ny)
    end
  end
end

-- fisher-yates shuffle for a table
function shuffle(t)
  for i = #t, 2, -1 do
    local j = flr(rnd(i)) + 1
    t[i], t[j] = t[j], t[i]
  end
end

-------------------------
-- player & collision  --
-------------------------
function _update()
  if game_state == "intro" then
    if btnp(0) or btnp(1) or btnp(2) or btnp(3) or btnp(4) or btnp(5) then
      game_state = "playing"
    end
    return
  end

  local rot_speed = 0.04
  local move_speed = 0.1
  if btnp(4) then show_minimap = not show_minimap end
  if btnp(5) then
    debug_mode = not debug_mode
  end

  -- rotate left/right (arrow left/right)
  if btn(0) then player.a = player.a - rot_speed end
  if btn(1) then player.a = player.a + rot_speed end

  -- move forward/back (arrow up/down)
  local move = 0
  if btn(2) then move = move + move_speed end
  if btn(3) then move = move - move_speed end

  local nx = player.x + cos(player.a) * move
  local ny = player.y + sin(player.a) * move
  if not colliding(nx, ny) then
    player.x = nx
    player.y = ny
  end

  check_dept()
end

-- check if the new position would hit a wall.
function colliding(x, y)
  local cx = flr(x) + 1
  local cy = flr(y) + 1
  if cx < 1 or cx > mwidth or cy < 1 or cy > mheight then
    return true
  end
  return maze[cy][cx] == 1
end

-- check if player reached the next department stop.
function check_dept()
  local cx = flr(player.x) + 1
  local cy = flr(player.y) + 1
  local target = dept_positions[current_dept + 1]
  if target and cx == target.x and cy == target.y then
    current_dept = current_dept + 1
    msg = "arrived at " .. depts[current_dept]
  end
  if current_dept == #depts then
    msg = "you've reached mdr! you win!"
  end
end

-------------------------
-- raycast & rendering --
-------------------------
function _draw()
  if game_state == "intro" then
    cls(0)
    print("severance maze", 40, 20, 7)
    print("based on the tv show severance", 10, 30, 7)
    print("objective: visit all depts on", 10, 40, 7)
    print("the lumon severed floor and", 10, 50, 7)
    print("return to the elevator.", 10, 60, 7)
    print("press any key to start", 30, 70, 7)
    return
  end

  if debug_mode then
    cls(1)
  else
    cls(0)
  end
  draw3d()
  if show_minimap then draw_minimap() end
  print(msg, 2, 2, 7)
  print("next: " .. (depts[current_dept + 1] or "none"), 2, 10, 3)
  if debug_mode then
    print("debug mode", 2, 20, 8)
    print("pos: " .. flr(player.x * 100) / 100 .. ", " .. flr(player.y * 100) / 100, 2, 28, 9)
    print("angle: " .. flr(player.a * 100) / 100, 2, 36, 9)
    print("dept: " .. current_dept, 2, 44, 9)
  end
end

-- raycaster to render vertical wall slices.
function draw3d()
  for x = 0, 127 do
    local ray_angle = player.a - fov / 2 + (x / 127) * fov
    local d = cast_ray(ray_angle)
    local wall_height = 64 / d
    local y1 = 64 - wall_height / 2
    local y2 = 64 + wall_height / 2

    -- compute hit position
    local hit_x = player.x + cos(ray_angle) * d
    local hit_y = player.y + sin(ray_angle) * d
    local frac_x = hit_x - flr(hit_x)
    local frac_y = hit_y - flr(hit_y)

    -- if hit near a grid corner (90るぬ angle), outline with a grey column (color 6)
    if (frac_x < 0.1 or frac_x > 0.9) and (frac_y < 0.1 or frac_y > 0.9) then
      rectfill(x, y1, x, y2, 6)
    else
      local shade = 7 - flr((d / maxd) * 3)
      shade = mid(shade, 4, 7)
      rectfill(x, y1, x, y2, shade)
    end
  end
end

-- cast a ray at angle 'a' and return distance until a wall is hit.
function cast_ray(a)
  -- initial setup
  local dir_x = cos(a)
  local dir_y = sin(a)
  -- map position to grid
  local map_x = flr(player.x)
  local map_y = flr(player.y)

  -- length of ray from one x or y side to next
  local delta_dist_x = abs(1 / (dir_x == 0 and 0.00001 or dir_x))
  local delta_dist_y = abs(1 / (dir_y == 0 and 0.00001 or dir_y))

  local step_x, side_dist_x
  if dir_x < 0 then
    step_x = -1
    side_dist_x = (player.x - map_x) * delta_dist_x
  else
    step_x = 1
    side_dist_x = (map_x + 1 - player.x) * delta_dist_x
  end

  local step_y, side_dist_y
  if dir_y < 0 then
    step_y = -1
    side_dist_y = (player.y - map_y) * delta_dist_y
  else
    step_y = 1
    side_dist_y = (map_y + 1 - player.y) * delta_dist_y
  end

  -- dda loop
  local side
  while true do
    if side_dist_x < side_dist_y then
      side_dist_x = side_dist_x + delta_dist_x
      map_x = map_x + step_x
      side = 0
    else
      side_dist_y = side_dist_y + delta_dist_y
      map_y = map_y + step_y
      side = 1
    end

    -- check if ray has hit a wall
    if map_x < 1 or map_x > mwidth or map_y < 1 or map_y > mheight then
      return maxd
    elseif maze[map_y][map_x] == 1 then
      break
    end
  end

  -- calculate distance
  local dist
  if side == 0 then
    dist = (map_x - player.x + (1 - step_x) / 2) / dir_x
  else
    dist = (map_y - player.y + (1 - step_y) / 2) / dir_y
  end

  return min(dist, maxd)
end

-- draw a simple minimap in the upper-left corner.
function draw_minimap()
  local scale = 4
  for y = 1, mheight do
    for x = 1, mwidth do
      local col = maze[y][x] == 1 and 8 or 0
      rectfill((x - 1) * scale, (y - 1) * scale, x * scale - 1, y * scale - 1, col)
    end
  end
  -- mark only the next department stop on the minimap
  local next_dept = dept_positions[current_dept + 1]
  if next_dept then
    circfill((next_dept.x - 0.5) * scale, (next_dept.y - 0.5) * scale, 1, 10)
  end
  -- mark player position and facing direction
  local px = player.x * scale
  local py = player.y * scale
  circfill(px, py, 1, 7)
  local dx = cos(player.a)
  local dy = sin(player.a)
  line(px, py, px + dx * 3, py + dy * 3, 7)
end

__gfx__
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00700700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00077000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00077000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00700700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
