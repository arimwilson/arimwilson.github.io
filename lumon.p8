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
mwidth=21         -- maze grid width (odd for dfs carving)
mheight=21        -- maze grid height
fov=3.14159265/3     -- field of view (60るぬ)
maxd=16           -- maximum raycast distance
step=0.05         -- raycasting step increment

-------------------------
-- init & maze setup  --
-------------------------
function _init()
  -- build maze: fill with walls (1) then carve passages (0)
  maze = {}
  for y=1,mheight do
    maze[y] = {}
    for x=1,mwidth do
      maze[y][x] = 1
    end
  end
  carve(2,2)
  
  -- define department names (in order)
  depts = {"elevator",
           "optics and design",
           "mammalians nurturable",
           "wellness",
           "choreography and merriment",
           "mdr"}
  
  -- pick random open (0) cells for each stop.
  local opens = {}
  for y=1,mheight do
    for x=1,mwidth do
      if maze[y][x] == 0 then
        add(opens, {x=x, y=y})
      end
    end
  end
  shuffle(opens)
  dept_positions = {}
  for i=1,#depts do
    dept_positions[i] = opens[i]
  end
  current_dept = 1  -- index of last reached stop (elevator is start)
  
  -- set up player: start at the elevator cell center.
  player = { x = dept_positions[1].x - 0.5,
             y = dept_positions[1].y - 0.5,
             a = 0 }  -- facing right initially
  
  msg = ""
end

-- recursive dfs maze carving (cells are 1 for wall, 0 for passage)
function carve(x,y)
  maze[y][x] = 0
  local dirs = { {0,-2}, {2,0}, {0,2}, {-2,0} }
  shuffle(dirs)
  for d in all(dirs) do
    local nx = x + d[1]
    local ny = y + d[2]
    if ny > 0 and ny <= mheight and nx > 0 and nx <= mwidth and maze[ny][nx] == 1 then
      -- remove the wall between current cell and neighbor.
      maze[ y + d[2]/2 ][ x + d[1]/2 ] = 0
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
  local rot_speed = 0.08
  local move_speed = 0.1
  
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
function colliding(x,y)
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
  local target = dept_positions[current_dept+1]
  if target and cx == target.x and cy == target.y then
    current_dept = current_dept + 1
    msg = "arrived at "..depts[current_dept]
  end
  if current_dept == #depts then
    msg = "you've reached mdr! you win!"
  end
end

-------------------------
-- raycast & rendering --
-------------------------
function _draw()
  cls(0)  -- clear screen (black)
  draw3d()
  draw_minimap()
  print(msg, 2, 2, 7)
  print("next: "..(depts[current_dept+1] or "none"), 2, 10, 7)
end

-- simple raycaster to render vertical wall slices.
function draw3d()
  for x = 0, 127 do
    local ray_angle = player.a - fov/2 + (x/128)*fov
    local d = cast_ray(ray_angle)
    local wall_height = 64 / d
    local y1 = 64 - wall_height/2
    local y2 = 64 + wall_height/2
    rectfill(x, y1, x, y2, 7)
  end
end

-- cast a ray at angle 'a' and return distance until a wall is hit.
function cast_ray(a)
  local d = 0
  while d < maxd do
    local rx = player.x + cos(a) * d
    local ry = player.y + sin(a) * d
    local cx = flr(rx) + 1
    local cy = flr(ry) + 1
    if cx < 1 or cx > mwidth or cy < 1 or cy > mheight or maze[cy][cx] == 1 then
      return d
    end
    d = d + step
  end
  return maxd
end

-- draw a simple minimap in the upper-left corner.
function draw_minimap()
  local scale = 4
  for y = 1, mheight do
    for x = 1, mwidth do
      local col = maze[y][x] == 1 and 8 or 0
      rectfill((x-1)*scale, (y-1)*scale, x*scale-1, y*scale-1, col)
    end
  end
  -- mark department stops.
  for i, dept in ipairs(dept_positions) do
    local col = (i == current_dept) and 10 or 11
    circfill((dept.x-0.5)*scale, (dept.y-0.5)*scale, 1, col)
  end
  -- mark player position.
  circfill(player.x*scale, player.y*scale, 1, 7)
end

__gfx__
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00700700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00077000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00077000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00700700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
