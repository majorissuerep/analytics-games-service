local centerX = math.floor(sim.XRES / 2)
local centerY = math.floor(sim.YRES / 2)

local materials = {
  core = elem.DEFAULT_PT_LAVA,
  mantle = elem.DEFAULT_PT_STNE,
  crust = elem.DEFAULT_PT_IRON,
  atmosphere = elem.DEFAULT_PT_O2,
}

local function createPlanetCrossSection()
  sim.clearSim()
  sim.paused(true)
  sim.gravityMode(sim.GRAV_RADIAL)

  for y = centerY - 92, centerY + 92 do
    for x = centerX - 92, centerX + 92 do
      local dx = x - centerX
      local dy = y - centerY
      local distanceSquared = dx * dx + dy * dy
      local material = nil

      if distanceSquared <= 28 * 28 then
        material = materials.core
      elseif distanceSquared <= 68 * 68 then
        material = materials.mantle
      elseif distanceSquared <= 78 * 78 then
        material = materials.crust
      elseif distanceSquared <= 90 * 90 then
        material = materials.atmosphere
      end

      if material then
        sim.partCreate(-1, x, y, material)
      end
    end
  end

  tpt.log("Cosmic Forge: loaded Cinder material lab; unpause to evaluate it")
end

createPlanetCrossSection()
