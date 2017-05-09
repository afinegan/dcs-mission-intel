do
    --
    local PORT = 3001
    local DATA_TIMEOUT_SEC = 1

    package.path = package.path..";.\\LuaSocket\\?.lua"
    package.cpath = package.cpath..";.\\LuaSocket\\?.dll"

    require = mint.require
    local socket = require("socket")
    require = nil

    local JSON = loadfile("Scripts\\JSON.lua")()

    local function log(msg)
        env.info("DynamicDCS (t=" .. timer.getTime() .. "): " .. msg)
    end

    --keep local db, compare each loop iteration, for created units or deleted units, or changed units, send those with action command to server
    local socketCache = {}




end