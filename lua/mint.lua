do
  --
  local PORT = 3001
  local DATA_TIMEOUT_SEC = 1

  package.path = package.path..";.\\LuaSocket\\?.lua"
  package.cpath = package.cpath..";.\\LuaSocket\\?.dll"

  require = mint.require
  local socket = require("socket")
  require = nil

  local function log(msg)
    env.info("MINT (t=" .. timer.getTime() .. "): " .. msg)
  end

  local function getDataMessage()


    local function addUnit(unit)
      local unitPosition = unit:getPosition()
      local lat, lon, alt = coord.LOtoLL(unitPosition.p)
      local unitXYZNorthCorr = coord.LLtoLO(lat + 1, lon)
      local headingNorthCorr = math.atan2(unitXYZNorthCorr.z - unitPosition.p.z, unitXYZNorthCorr.x - unitPosition.p.x)
      local heading = math.atan2(unitPosition.x.z, unitPosition.x.x) + headingNorthCorr
      if heading < 0 then
        heading = heading + 2 * math.pi
      end
      local headingDeg = math.floor(heading / math.pi * 180);

      local velocity = unit:getVelocity()
      local speed = math.sqrt(velocity.x^2 + velocity.z^2)

      local PlayerName = unit:getPlayerName()


      local msg = "{"
      if unit:getCoalition() == 1 then
        msg = msg .. "\"blue\":[],\"red\":["
      end
      if unit:getCoalition() == 2 then
        msg = msg .. "\"red\":[],\"blue\":["
      end
      msg = msg .. "[";
      msg = msg .. tonumber(unit:getID())
      msg = msg .. ",\"" .. unit:getTypeName() .. "\""
      msg = msg .. "," .. lat
      msg = msg .. "," .. lon
      msg = msg .. "," .. alt
      msg = msg .. "," .. headingDeg
      msg = msg .. "," .. speed
      msg = msg .. ",\"" .. unit:getCallsign() .. "\""
      msg = msg .. "," .. unit:getCoalition()
      if PlayerName ~= nil then
        msg = msg .. ",\"" .. PlayerName .. "\""
      else
        msg = msg .. ",\"\""
      end

      msg = msg .. "]";
      msg = msg .. "]}\n"
      _M.sendMessage(msg)
    end

    local function addGroups(groups)
      local addComma = false
      for groupIndex = 1, #groups do
        local group = groups[groupIndex]
        local units = group:getUnits()
        for unitIndex = 1, #units do
          if Unit.isExist(units[unitIndex]) and Unit.isActive(units[unitIndex]) then
            addUnit(units[unitIndex])
          end
        end
      end
    end


    local redGroups = coalition.getGroups(coalition.side.RED)
    addGroups(redGroups)

    local blueGroups = coalition.getGroups(coalition.side.BLUE)
    addGroups(blueGroups)

  end

  local JSON = loadfile("Scripts\\JSON.lua")()
  _M = {}
  _M.connections = {}

  _M.LuaSocketConnection = {
    conn = nil,
    rxbuf = ""
  }

  local function shallowCopy(source, dest)
    dest = dest or {}
    for k, v in pairs(source) do
      dest[k] = v
    end
    return dest
  end

  function _M.LuaSocketConnection:create(args)
    args = args or {}
    local self = shallowCopy(_M.LuaSocketConnection)
    return self
  end
  function _M.LuaSocketConnection:close()
    self.conn:close()
  end

  _M.UDPSender = {}
  function _M.UDPSender:create(args)
    args = args or {}
    local self = _M.LuaSocketConnection:create()
    shallowCopy(_M.UDPSender, self)
    self.port = args.port or 3001
    self.host = args.host or "127.0.0.1"
    return self
  end
  function _M.UDPSender:init()
    self.conn = socket.udp()
    self.conn:settimeout(0)
  end
  function _M.UDPSender:send(msg)
    --env.info('send mesg: '..msg..' to host: '..self.host..' to port '..self.port)
    socket.try(self.conn:sendto(msg, self.host, self.port))
  end

  function _M.init()
    _M.connections = {
      _M.UDPSender:create()
    }
    for _, c in pairs(_M.connections) do
      c:init()
    end
  end

  function _M.sendMessage(msg)
    msgstr = JSON:encode(msg):gsub("\n", "") .. "\n"
    for _, c in pairs(_M.connections) do
      if c.send then c:send(msgstr) end
    end
  end


  local function step()
   getDataMessage()
  end

  timer.scheduleFunction(function(arg, time)
    local success, error = pcall(step)
    if not success then
        log("Error: " .. error)
    end
    return timer.getTime() + DATA_TIMEOUT_SEC
  end, nil, timer.getTime() + DATA_TIMEOUT_SEC)

  _M.init()

end
