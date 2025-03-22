pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- severance maze 3d
-- (pico-8 0.2.1+)

function _init()
    srand(stat(7))
    w=32 h=32
    maze={}
    depts={"optics","mammalians","wellness","choreo"}
    visited={}
    mdr_pos={}
    generate_maze()
    place_depts()
    player={
        x=1.5,
        y=1.5,
        dir=0,
        speed=0.1,
        found={}
    }
end

function generate_maze()
    for y=0,h-1 do
        for x=0,w-1 do
            maze[y*128+x]=x%2+y%2>0 and 1 or 0
        end
    end
    
    stk={{x=2,y=2}}
    while #stk>0 do
        local cell=stk[#stk]
        local neighbors={}
        for d=0,3 do
            local nx=cell.x+(d==0 and 2 or d==1 and -2 or 0)
            local ny=cell.y+(d==2 and 2 or d==3 and -2 or 0)
            if nx>=2 and nx<w and ny>=2 and ny<h and maze[ny*128+nx]==0 then
                add(neighbors,{x=nx,y=ny,d=d})
            end
        end
        
        if #neighbors>0 then
            local next=neighbors[flr(rnd(#neighbors))+1]
            local wx=cell.x+(next.x-cell.x)/2
            local wy=cell.y+(next.y-cell.y)/2
            maze[cell.y*128+cell.x]=1
            maze[wy*128+wx]=1
            maze[next.y*128+next.x]=1
            add(stk,next)
        else
            del(stk,cell)
        end
    end
end

function place_depts()
    -- place department markers
    for i=1,#depts do
        local x,y
        repeat
            x = flr(rnd(w-4))+2
            y = flr(rnd(h-4))+2
        until maze[y*128+x] == 1
        maze[y*128+x] = 2
    end
    
    -- place mdr
    local mx,my
    repeat
        mx = flr(rnd(w-4))+2
        my = flr(rnd(h-4))+2
    until maze[my*128+mx] == 1
    maze[my*128+mx] = 3
    mdr_pos = {x=mx, y=my}
end

function _update()
    -- rotation controls
    local left = btn(0) and 1 or 0
    local right = btn(1) and 1 or 0
    local move = right - left  -- now valid arithmetic
    player.dir += move * 0.05
    
    -- movement vectors
    local dx = player.speed * cos(player.dir)
    local dy = player.speed * sin(player.dir)
    
    -- movement controls
    if btn(2) then  -- up
        if maze[flr(player.y + dy)*128 + flr(player.x + dx)] ~= 0 then
            player.x += dx
            player.y += dy
        end
    elseif btn(3) then  -- down
        if maze[flr(player.y - dy)*128 + flr(player.x - dx)] ~= 0 then
            player.x -= dx
            player.y -= dy
        end
    end
    
    -- department collection check
    local cell = maze[flr(player.y)*128 + flr(player.x)]
    if cell == 2 then
        local d = depts[1]
        del(depts, d)
        add(player.found, d)
        maze[flr(player.y)*128 + flr(player.x)] = 1
    elseif cell == 3 and #player.found >= 4 then
        print("escape achieved!")
        stop()
    end
end

function _draw()
    rectfill(0,0,127,63,0)
    
    -- 3d view
    for x=0,127 do
        local angle=(x/128-0.5)+player.dir
        local dist=0
        local hit=false
        local tx=player.x
        local ty=player.y
        
        while not hit and dist<20 do
            tx+=cos(angle)*0.1
            ty+=sin(angle)*0.1
            dist+=0.1
            
            if maze[flr(ty)*128+flr(tx)]!=1 then
                hit=true
                local height=64/(dist+0.1)
                local col=7
                if maze[flr(ty)*128+flr(tx)]==2 then col=12
                elseif maze[flr(ty)*128+flr(tx)]==3 then col=8
                end
                line(x,64-height,x,64+height,col)
            end
        end
    end
    
    -- map
    map(0,0,0,0,16,16)
    circ(player.x*4,player.y*4,1,9)
    
    -- hud
    print("departments:",2,2,7)
    for i,d in ipairs(player.found) do
        print(d,2,8+i*6,12)
    end
    if #player.found>=4 then
        print("go to mdr!",90,2,8)
    end
end
__gfx__
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00700700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00077000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00077000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00700700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
