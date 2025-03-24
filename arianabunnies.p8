-- Ariana's Jumping Bunnies - Expanded Player Mechanics
local flr = flr
local mget = mget
local all = all
local del = del
local sfx = sfx
local music = music
local print = print
local spr = spr
local map = map

default_jump_force = -3.5
default_speed = 1.5

-- Define the player with size, movement, and physics properties
player = {
    x = 64, -- starting horizontal position
    y = 90, -- starting vertical position (above ground)
    dx = 0,
    dy = 0,
    width = 8,                                 -- sprite width (8 pixels)
    height = 8,                                -- sprite height (8 pixels)
    speed = default_speed,                     -- horizontal movement speed
    jump_force = default_jump_force,           -- initial upward velocity when jumping
    gravity = 0.2,                             -- gravity applied each frame
    on_ground = false,                         -- whether the player is standing on a platform
    lives = 3,                                 -- number of lives
    powerup_timer = 0,                         -- timer for temporary power-up effects
    inventory = { carrots = 0, powerups = 0 }, -- inventory for collected items
}

-- Define solid tile IDs for collision (adjust tile IDs as needed)
solid_tiles = {
    [1] = true, -- ground tile
    [2] = true, -- brick or obstacle tile
    [3] = true, -- additional solid tile
    [4] = true, -- additional solid tile
}

function solid(tile)
    return solid_tiles[tile] or false
end

-- Check collision against the map's solid tiles
function check_map_collision(x, y)
    local w, h = player.width, player.height
    local tile_left = flr(x / 8)
    local tile_right = flr((x + w - 1) / 8)
    local tile_top = flr(y / 8)
    local tile_bottom = flr((y + h - 1) / 8)
    for ty = tile_top, tile_bottom do
        for tx = tile_left, tile_right do
            if solid(mget(tx, ty)) then
                return true
            end
        end
    end
    return false
end

-- Move player and resolve collisions with the map
function move_player()
    -- Horizontal movement
    player.x = player.x + player.dx
    if check_map_collision(player.x, player.y) then
        if player.dx > 0 then
            player.x = flr((player.x + player.width) / 8) * 8 - player.width - 0.01
        elseif player.dx < 0 then
            player.x = (flr(player.x / 8) + 1) * 8 + 0.01
        end
        player.dx = 0
    end

    -- Vertical movement
    player.y = player.y + player.dy
    if check_map_collision(player.x, player.y) then
        if player.dy > 0 then
            player.y = flr((player.y + player.height) / 8) * 8 - player.height - 0.01
            player.on_ground = true
        elseif player.dy < 0 then
            player.y = (flr(player.y / 8) + 1) * 8 + 0.01
        end
        player.dy = 0
    end
end

-- AABB collision detection function
local function check_collision(ax, ay, aw, ah, bx, by, bw, bh)
    return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by
end

-- _init() runs once at the beginning
function _init()
    player.x = 64
    player.y = 90
    player.on_ground = false
    score = 0
    music(0) -- start background music (assumed track 0)
end

-- Define enemy entities with patrol behavior
enemies = {
    {
        x = 40,   -- starting x position
        y = 80,   -- starting y position
        dx = 0.5, -- patrol speed
        width = 8,
        height = 8,
        patrol_min = 40,
        patrol_max = 80
    }
}

function update_enemies()
    for enemy in all(enemies) do
        enemy.x = enemy.x + enemy.dx
        if enemy.x < enemy.patrol_min then
            enemy.x = enemy.patrol_min
            enemy.dx = -enemy.dx
        elseif enemy.x > enemy.patrol_max then
            enemy.x = enemy.patrol_max
            enemy.dx = -enemy.dx
        end
    end
end

function check_enemy_collisions()
    for i = #enemies, 1, -1 do
        local enemy = enemies[i]
        if check_collision(player.x, player.y, player.width, player.height,
                enemy.x, enemy.y, enemy.width, enemy.height) then
            -- If player is falling and collides from above
            if player.dy > 0 and (player.y + player.height - enemy.y) < 4 then
                sfx(3) -- play enemy defeat sound effect
                -- Defeat enemy: remove it and bounce the player upward a bit
                del(enemies, enemy)
                player.dy = player.jump_force / 2
            else
                sfx(4) -- play player hit sound effect
                -- Side collision: player loses a life and resets position
                player.lives = player.lives - 1
                player.x = 64
                player.y = 90
                player.dx = 0
                player.dy = 0
                break
            end
        end
    end
end

-- Define collectibles
collectibles = {
    { x = 20,  y = 70, type = "carrot" }, -- Carrot collectible
    { x = 100, y = 70, type = "powerup" } -- Power-up collectible
}

function check_collectibles()
    for i = #collectibles, 1, -1 do
        local item = collectibles[i]
        if check_collision(player.x, player.y, player.width, player.height,
                item.x, item.y, 8, 8) then
            if item.type == "carrot" then
                score = score + 10 -- Increase score by 10 for each carrot
                player.inventory.carrots = player.inventory.carrots + 1
                sfx(1)             -- play carrot collection sound
            elseif item.type == "powerup" then
                score = score + 10 -- Optionally increase score
                player.inventory.powerups = player.inventory.powerups + 1
                sfx(2)             -- play powerup collection sound
                -- Grant temporary abilities: increased jump height and speed
                player.jump_force = default_jump_force * 1.5
                player.speed = default_speed * 1.5
                player.powerup_timer = 300 -- Duration in frames (e.g., 300 frames ~5 seconds)
            end
            del(collectibles, item)
        end
    end
end

function update_powerup()
    if player.powerup_timer > 0 then
        player.powerup_timer = player.powerup_timer - 1
        if player.powerup_timer <= 0 then
            -- Reset abilities to default values
            player.jump_force = default_jump_force
            player.speed = default_speed
        end
    end
end

function draw_background()
    -- Set transparency: assume color 0 is transparent for sprites
    palt(0, true)

    -- Draw decorative background elements to complement the tile map
    -- Example: draw a cloud (assumed sprite index 5) and a hill (assumed sprite index 6)
    spr(5, 20, 5, 2, 2)  -- Cloud sprite
    spr(6, 80, 20, 2, 2) -- Hill sprite
end

-- _update() handles input, physics, and collision checks each frame
function _update()
    -- Horizontal movement: left (btn 0) and right (btn 1)
    if btn(0) then
        player.dx = -player.speed
    elseif btn(1) then
        player.dx = player.speed
    else
        player.dx = 0
    end

    -- Jump: using button 4 ("O" button) when on a platform
    if btnp(4) and player.on_ground then
        player.dy = player.jump_force
        player.on_ground = false
        sfx(0) -- play jump sound effect
    end

    -- Apply gravity continuously
    player.dy = player.dy + player.gravity

    -- Reset on_ground flag before moving
    player.on_ground = false

    -- Move player with map collision
    move_player()

    -- Update enemy positions
    update_enemies()

    -- Check collisions between player and enemies
    check_enemy_collisions()

    -- Check collisions with collectibles
    check_collectibles()

    -- Update power-up timer and reset abilities if expired
    update_powerup()
end

-- _draw() renders platforms and the player sprite each frame
function _draw()
    cls(12) -- clear the screen with a sky-blue color for a cohesive background
    draw_background()

    -- Draw the level map (assumes map data is set up in the PICO-8 map editor)
    map(0, 0, 0, 0, 16, 16)

    -- Draw the player sprite (assumed sprite index 1)
    spr(1, player.x, player.y, 1, 1)

    -- Draw enemies (assumed sprite index 2 for enemy)
    for enemy in all(enemies) do
        spr(2, enemy.x, enemy.y, 1, 1)
    end

    -- Draw collectibles (sprite index 3 for carrots, 4 for power-ups)
    for item in all(collectibles) do
        if item.type == "carrot" then
            spr(3, item.x, item.y, 1, 1)
        elseif item.type == "powerup" then
            spr(4, item.x, item.y, 1, 1)
        end
    end

    -- Display score on screen
    print("Score: " .. score, 1, 1, 7)
    print("Lives: " .. player.lives, 1, 10, 7)
    print("Carrots: " .. player.inventory.carrots, 1, 18, 7)
    if player.powerup_timer > 0 then
        print("Powerup Active", 1, 26, 7)
    end
end
