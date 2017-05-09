do
    --
    local PORT = 3001
    local DATA_TIMEOUT_SEC = 1

    package.path = package.path..";.\\LuaSocket\\?.lua"
    package.cpath = package.cpath..";.\\LuaSocket\\?.dll"

    require = mint.require
    local socket = require("socket")
    local JSON = loadfile("Scripts\\JSON.lua")()
    require = nil

    local function log(msg)
        env.info("DynamicDCS (t=" .. timer.getTime() .. "): " .. msg)
    end

    local cacheDB = {}
    local function getDataMessage()
        local payload = {}
        payload.units = {}
        local checkDead = {}
        local function addUnit(unit, unitID, coalition, lat, lon, action)
            local curUnit = {
                action = action,
                unitID = unitID
            }
            if action == "C" or action == "U" then
                cacheDB[unitID] = {}
                cacheDB[unitID].lat = lat
                cacheDB[unitID].lon = lon
                curUnit.lat = lat
                curUnit.lon = lon
                if action == "C" then
                    curUnit.type = unit:getTypeName()
                    curUnit.coalition = coalition
                    local PlayerName = unit:getPlayerName()
                    if PlayerName ~= nil then
                        curUnit.playername = PlayerName
                    else
                        curUnit.playername = ""
                    end
                end
            end
            table.insert(payload.units, curUnit)
        end

        local function addGroups(groups, coalition)
            for groupIndex = 1, #groups do
                local group = groups[groupIndex]
                local units = group:getUnits()
                for unitIndex = 1, #units do
                    local unit = units[unitIndex]
                    local unitID = tonumber(unit:getID())
                    local unitPosition = unit:getPosition()
                    local lat, lon, alt = coord.LOtoLL(unitPosition.p)
                    --check against cache table (keep tabs on if unit is new to table, if table has unit that no longer exists or if unit moved
                     if Unit.isExist(unit) and Unit.isActive(unit) then
                         if cacheDB[unitID] ~= nil then
                             --env.info('cachelat: '..cacheDB[unitID].lat..' reg lat: '..lat..' cachelon: '..cacheDB[unitID].lon..' reg lon: '..lon)
                             if cacheDB[unitID].lat ~= lat or cacheDB[unitID].lon ~= lon then
                                 addUnit(unit, unitID, coalition, lat, lon, "U")
                             end
                         else
                             addUnit(unit, unitID, coalition, lat, lon, "C")
                         end
                         checkDead[unitID] = 1
                    end
                end
            end
        end

        local redGroups = coalition.getGroups(coalition.side.RED)
        addGroups(redGroups, 1)
        local blueGroups = coalition.getGroups(coalition.side.BLUE)
        addGroups(blueGroups, 2)

        --check dead, send delete action to server if dead detected
        local unitCnt = 0
        for k, v in pairs( cacheDB ) do
            if checkDead[k] == nil then
                addUnit(0, k, 0, 0, 0, "D")
            end
            unitCnt = unitCnt + 1
        end
        payload.unitCount = unitCnt
        return _M.sendMessage(payload)
    end

    local _M = {}

    local function shallowCopy(source, dest)
        dest = dest or {}
        for k, v in pairs(source) do
            dest[k] = v
        end
        return dest
    end

    _M = {}
    _M.connections = {}

    _M.LuaSocketConnection = {
        conn = nil,
        rxbuf = ""
    }
    function _M.LuaSocketConnection:create()
        args = {}
        local self = shallowCopy(_M.LuaSocketConnection)
        return self
    end
    function _M.LuaSocketConnection:close()
        self.conn:close()
    end

    _M.TCPServer = {}
    function _M.TCPServer:create()
        env.info('TCP SERVER CREATE')
        args = {}
        local self = _M.LuaSocketConnection:create()
        shallowCopy(_M.TCPServer, self)
        self.host = args.host or "*"
        self.port = args.port or 3001
        return self
    end
    function _M.TCPServer:init()
        env.info('RUNNING TCP INIT')
        self.acceptor = socket.bind(self.host, self.port, 10)
        self.acceptor:settimeout(0)
        self.connections = {}
    end
    function _M.TCPServer:step()
        env.info('RUNNING TCP STEP')
        -- accept new connections
        local newconn = self.acceptor:accept()
        env.info('newconn: '..newconn)
        if newconn then
            newconn:settimeout(0)
            local newconn_info = { conn = newconn, txbuf = "", rxbuf = "" }
            env.info('connection established: '..newconn_info)
            self.connections[#self.connections+1] = newconn_info
        end

        local have_closed_connections = false
        -- receive data
        for _, conninfo in pairs(self.connections) do
            local data, err, partial = conninfo.conn:receive(4096)
            env.info('receiving data: '..data);
            if data then
                conninfo.rxbuf = conninfo.rxbuf .. data
            elseif partial and #partial > 0 then
                conninfo.rxbuf = conninfo.rxbuf .. partial
            elseif err == "closed" then
                conninfo.closed = true
                have_closed_connections = true
            end

            while true do
                local line, rest = conninfo.rxbuf:match("^([^\n]*)\n(.*)")
                env.info('incoming line')
                if line then
                    conninfo.rxbuf = rest
                    _M.processInputLine(line)
                else
                    break
                end
            end
        end

        -- eliminate closed connections
        if have_closed_connections then
            local old_connections = self.connections
            self.connections = {}
            for _, conninfo in pairs(old_connections) do
                if not conninfo.closed then
                    self.connections[#self.connections+1] = conninfo
                end
            end
        end
    end
    function _M.TCPServer:send(msg)
        env.info('tcp server send: '..msg)
        for _, conninfo in pairs(self.connections) do
            socket.try(conninfo.conn:send(msg))
        end
    end
    function _M.TCPServer:close()
        for _, conninfo in pairs(self.connections) do
            socket.try(conninfo.conn:close())
        end
        self.connections = {}
    end

    function _M.processInputLine(line)
        env.info('process input: '..line)
        local success, result = pcall(function() return JSON:decode(line) end)
        if not success then
            return
        end
        env.info('process input line check it out: '..result)
    end

    function _M.init()

        _M.connections = {
            _M.TCPServer:create()
        }

        for _, c in pairs(_M.connections) do
            c:init()
        end
    end

    function _M.stop()

    end

    function _M.step()
        getDataMessage()
        for _, c in pairs(_M.connections) do
            if c.step then c:step() end
        end
    end

    function _M.sendMessage(msg)
        env.info('sending msg: '..msg)
        msgstr = JSON:encode(msg):gsub("\n", "") .. "\n"
        for _, c in pairs(_M.connections) do
            if c.send then c:send(msgstr) end
        end
    end

    _M.init()

    timer.scheduleFunction(function(arg, time)
        local success, error = pcall(_M.step())
        if not success then
            log("Error: " .. error)
        end
        return timer.getTime() + DATA_TIMEOUT_SEC
    end, nil, timer.getTime() + DATA_TIMEOUT_SEC)


end