--[[
	AuroraEffect — клиентский эффект «портал северного сияния с ледяными шипами».

	Что происходит:
	  1. Светящийся шар летит по дуге вокруг игрока.
	  2. За ним вырастает лента-ПОРТАЛ: это не просто цвет, а окно в объёмный
	     космос (модуль Portal: SurfaceGui + параллакс). Внутри видны звёзды,
	     туманность, бирюзовая полоса и лучи сияния на разной глубине —
	     когда камера двигается, слои смещаются по-разному и видна глубина.
	  3. По краям — светящийся контур, с краёв летят искры-осколки.
	  4. Потом по краям ленты волной вырастают острые ледяные шипы.
	  5. Эффект переливается несколько секунд и растворяется.

	Никаких мешей и загруженных картинок не нужно — работает «из коробки».
	Свою картинку космоса можно подключить через CONFIG.PORTAL.IMAGE.

	Использование (только на клиенте!):
		local AuroraEffect = require(ReplicatedStorage.AuroraEffect)
		local stop = AuroraEffect.play(rootPart.CFrame, 12345)
		-- stop() — убрать эффект досрочно (необязательно)
]]

local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")

local Portal = require(script:WaitForChild("Portal"))

local AuroraEffect = {}
AuroraEffect.Portal = Portal

type Spike = {
	b1: Vector3,
	b2: Vector3,
	dir: Vector3,
	length: number,
	start: number,
	w1: BasePart,
	w2: BasePart,
	tipAtt: Attachment,
	beams: { Beam },
	progress: number,
}
type Cap = { w1: BasePart, w2: BasePart, col: number, born: number }

local CONFIG = {
	BUILD_TIME = 2.6, -- сколько секунд летит шар и строится лента
	SPIKE_DELAY = 1.0, -- через сколько после появления участка ленты на нём растут шипы
	SPIKE_GROW_TIME = 0.45, -- время роста одного шипа
	HOLD_TIME = 6, -- сколько эффект висит целиком
	FADE_TIME = 1.2, -- время исчезновения

	COLUMNS = 36, -- сегментов ленты, каждый — отдельное окно портала (больше = плавнее, но тяжелее)
	BASE_HEIGHT = 11, -- средняя высота ленты в стадах
	THICKNESS = 0.05, -- толщина ленты

	TOP_SPIKES = 34, -- шипов на верхнем краю
	BOTTOM_SPIKES = 26, -- шипов на нижнем краю
	SPIKE_LENGTH = NumberRange.new(3, 11),
	SPIKE_WIDTH = NumberRange.new(0.6, 1.8),

	EDGE_WIDTH = 0.35, -- толщина светящегося контура
	SHARDS_PER_COLUMN = 2, -- осколков на каждый новый сегмент

	-- Контрольные точки траектории шара (кривая Безье) в локальных координатах
	-- игрока: X — вправо, Y — вверх, -Z — вперёд.
	PATH = {
		Vector3.new(-26, 9, -4),
		Vector3.new(-8, 16, -24),
		Vector3.new(14, 7, -16),
		Vector3.new(22, 3, 12),
	},

	PORTAL = {
		PIXELS_PER_STUD = 24, -- чёткость картинки внутри
		MAX_TILT = 1.2, -- насколько сильно слои сдвигаются при взгляде сбоку
		BRIGHTNESS = 1.6, -- яркость SurfaceGui (больше 1 — светится, ловит Bloom)
		-- Своя картинка внутри портала (космос/туманность): загрузите её в Roblox
		-- и вставьте сюда "rbxassetid://ЧИСЛО". Пусто — только встроенные слои.
		IMAGE = "",
		IMAGE_DEPTH = 9, -- глубина картинки (встроенные слои: 10, 8, 5, 3.5, 1.5)
		IMAGE_TILE = 30, -- размер плитки картинки в стадах
	},

	ADD_BLOOM = true, -- добавить BloomEffect в Lighting, если его нет (сильно усиливает свечение)
	UPDATE_RATE = 30, -- как часто (раз в секунду) пересчитывать переливы цвета краёв
}
AuroraEffect.Config = CONFIG

-- Градиент сияния снизу (0) вверх (1)
local COLOR_STOPS = {
	{ 0.00, Color3.fromRGB(150, 255, 230) },
	{ 0.22, Color3.fromRGB(40, 255, 175) },
	{ 0.50, Color3.fromRGB(70, 150, 255) },
	{ 0.80, Color3.fromRGB(160, 110, 255) },
	{ 1.00, Color3.fromRGB(235, 125, 255) },
}
local EDGE_COLOR = Color3.fromRGB(200, 250, 255)
local SPIKE_COLOR = Color3.fromRGB(100, 215, 255)
local ORB_COLOR = Color3.fromRGB(215, 245, 255)
local SPARKLE_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds"

local function auroraColor(v: number): Color3
	v = math.clamp(v, 0, 1)
	for i = 1, #COLOR_STOPS - 1 do
		local a, b = COLOR_STOPS[i], COLOR_STOPS[i + 1]
		if v <= b[1] then
			return a[2]:Lerp(b[2], (v - a[1]) / (b[1] - a[1]))
		end
	end
	return COLOR_STOPS[#COLOR_STOPS][2]
end

local function easeOutBack(x: number): number
	local c1 = 1.70158
	local c3 = c1 + 1
	return 1 + c3 * (x - 1) ^ 3 + c1 * (x - 1) ^ 2
end

local function bezier(p: { Vector3 }, t: number): Vector3
	local u = 1 - t
	return p[1] * (u * u * u) + p[2] * (3 * u * u * t) + p[3] * (3 * u * t * t) + p[4] * (t * t * t)
end

local function newPart(className: string, parent: Instance): BasePart
	local part = Instance.new(className) :: BasePart
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Material = Enum.Material.Neon
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Transparency = 1
	part.Parent = parent
	return part
end

-- Рисует треугольник abc двумя клиньями (классический приём EgoMoose).
-- Возвращает false, если треугольник вырожденный (тогда клинья прячутся).
local function drawTriangle(a: Vector3, b: Vector3, c: Vector3, w1: BasePart, w2: BasePart, thickness: number): boolean
	local ab, ac, bc = b - a, c - a, c - b
	local abd, acd, bcd = ab:Dot(ab), ac:Dot(ac), bc:Dot(bc)
	if abd > acd and abd > bcd then
		c, a = a, c
	elseif acd > bcd and acd > abd then
		a, b = b, a
	end
	ab, ac, bc = b - a, c - a, c - b

	local cross = ac:Cross(ab)
	if cross.Magnitude < 1e-4 or bc.Magnitude < 1e-4 then
		return false
	end
	local right = cross.Unit
	local up = bc:Cross(right).Unit
	local back = bc.Unit
	local height = math.abs(ab:Dot(up))

	w1.Size = Vector3.new(thickness, height, math.abs(ab:Dot(back)))
	w1.CFrame = CFrame.fromMatrix((a + b) / 2, right, up, back)
	w2.Size = Vector3.new(thickness, height, math.abs(ac:Dot(back)))
	w2.CFrame = CFrame.fromMatrix((a + c) / 2, -right, up, -back)
	return true
end

local function newAttachment(anchor: BasePart, worldPos: Vector3): Attachment
	local att = Instance.new("Attachment")
	att.Position = worldPos -- anchor стоит в CFrame.identity, так что локальная = мировая
	att.Parent = anchor
	return att
end

local function newBeam(anchor: BasePart, a0: Attachment, a1: Attachment, width: number, color: Color3): Beam
	local beam = Instance.new("Beam")
	beam.Attachment0 = a0
	beam.Attachment1 = a1
	beam.FaceCamera = true
	beam.Width0 = width
	beam.Width1 = width
	beam.Segments = 1
	beam.LightEmission = 1
	beam.LightInfluence = 0
	beam.Brightness = 4
	beam.Color = ColorSequence.new(color)
	beam.Transparency = NumberSequence.new(0)
	beam.Parent = anchor
	return beam
end

local function ensureBloom()
	if CONFIG.ADD_BLOOM and not Lighting:FindFirstChildOfClass("BloomEffect") then
		local bloom = Instance.new("BloomEffect")
		bloom.Name = "AuroraBloom"
		bloom.Intensity = 1.1
		bloom.Size = 32
		bloom.Threshold = 0.85
		bloom.Parent = Lighting
	end
end

local function createOrb(parent: Instance): (BasePart, BasePart, ParticleEmitter)
	local orb = newPart("Part", parent)
	orb.Shape = Enum.PartType.Ball
	orb.Size = Vector3.new(2.4, 2.4, 2.4)
	orb.Color = ORB_COLOR
	orb.Transparency = 0

	local halo = newPart("Part", orb)
	halo.Name = "Halo"
	halo.Shape = Enum.PartType.Ball
	halo.Size = Vector3.new(4.5, 4.5, 4.5)
	halo.Material = Enum.Material.ForceField
	halo.Color = Color3.fromRGB(120, 220, 255)
	halo.Transparency = 0

	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(140, 230, 255)
	light.Range = 22
	light.Brightness = 4
	light.Parent = orb

	local sparkles = Instance.new("ParticleEmitter")
	sparkles.Name = "Sparkles"
	sparkles.Texture = SPARKLE_TEXTURE
	sparkles.Color = ColorSequence.new(Color3.fromRGB(170, 240, 255), Color3.fromRGB(90, 255, 200))
	sparkles.LightEmission = 1
	sparkles.LightInfluence = 0
	sparkles.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.7),
		NumberSequenceKeypoint.new(1, 0),
	})
	sparkles.Transparency = NumberSequence.new(0)
	sparkles.Lifetime = NumberRange.new(0.4, 0.9)
	sparkles.Rate = 90
	sparkles.Speed = NumberRange.new(2, 7)
	sparkles.SpreadAngle = Vector2.new(180, 180)
	sparkles.Rotation = NumberRange.new(0, 360)
	sparkles.RotSpeed = NumberRange.new(-180, 180)
	sparkles.Drag = 2
	sparkles.Parent = orb

	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 0.9, 0)
	a0.Parent = orb
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -0.9, 0)
	a1.Parent = orb
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Lifetime = 0.35
	trail.FaceCamera = true
	trail.LightEmission = 1
	trail.LightInfluence = 0
	trail.Color = ColorSequence.new(Color3.fromRGB(220, 250, 255), Color3.fromRGB(60, 200, 255))
	trail.Transparency = NumberSequence.new(0, 1)
	trail.WidthScale = NumberSequence.new(1, 0)
	trail.Parent = orb

	return orb, halo, sparkles
end

-- Маленький светящийся осколок, который отлетает и гаснет
local function spawnShard(parent: Instance, rng: Random, pos: Vector3, push: Vector3)
	local shard = newPart("Part", parent)
	local s = rng:NextNumber(0.15, 0.45)
	shard.Size = Vector3.new(s, s * rng:NextNumber(1, 2.5), s * 0.3)
	shard.Color = rng:NextNumber() < 0.5 and Color3.fromRGB(120, 230, 255) or Color3.fromRGB(110, 255, 210)
	shard.Transparency = 0
	shard.CFrame = CFrame.new(pos)
		* CFrame.Angles(rng:NextNumber(0, math.pi * 2), rng:NextNumber(0, math.pi * 2), rng:NextNumber(0, math.pi * 2))

	local life = rng:NextNumber(0.7, 1.4)
	local offset = push * rng:NextNumber(1.5, 4) + rng:NextUnitVector() * rng:NextNumber(0.5, 2.5)
	TweenService:Create(shard, TweenInfo.new(life, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		CFrame = shard.CFrame * CFrame.Angles(rng:NextNumber(-3, 3), rng:NextNumber(-3, 3), 0) + offset,
		Transparency = 1,
		Size = shard.Size * 0.3,
	}):Play()
	Debris:AddItem(shard, life + 0.1)
end


local effectCounter = 0

function AuroraEffect.play(origin: CFrame, seed: number?): () -> ()
	ensureBloom()

	local seedValue = seed or math.random(1, 1000000)
	local rng = Random.new(seedValue)
	-- math.noise возвращает 0 в целых точках, поэтому дробный сдвиг обязателен
	local noiseOffset = (seedValue % 1000) + 0.37

	local N = CONFIG.COLUMNS
	local THICK = CONFIG.THICKNESS

	local folder = Instance.new("Folder")
	folder.Name = "AuroraEffect"
	folder.Parent = workspace

	local anchor = newPart("Part", folder)
	anchor.Name = "Anchor"
	anchor.CFrame = CFrame.identity
	anchor.Size = Vector3.one

	------------------------------------------------------------------
	-- 1. Геометрия ленты: нижний край, направление «вверх», высота
	------------------------------------------------------------------
	local controlPoints = {}
	for i, p in CONFIG.PATH do
		controlPoints[i] = origin:PointToWorldSpace(p)
	end

	local bottom: { Vector3 } = {}
	for i = 0, N do
		local t = i / N
		local wobble = Vector3.new(0, math.noise(t * 3, noiseOffset) * 2.5, 0)
		bottom[i] = bezier(controlPoints, t) + wobble
	end

	local tangents: { Vector3 } = {}
	local ups: { Vector3 } = {}
	local heights: { number } = {}
	local arc: { number } = { [0] = 0 } -- длина ленты от начала до точки i (координата u портала)
	local maxHeight = 0
	for i = 0, N do
		local t = i / N
		local tangent = (bottom[math.min(i + 1, N)] - bottom[math.max(i - 1, 0)]).Unit
		local side = tangent:Cross(Vector3.yAxis)
		if side.Magnitude > 1e-3 then
			side = side.Unit
		end
		tangents[i] = tangent
		ups[i] = (Vector3.yAxis + side * 0.3).Unit -- лента слегка наклонена

		local n = math.noise(t * 4.5, noiseOffset, 1.3) + 0.5 * math.noise(t * 11, noiseOffset, 7.7)
		local h = CONFIG.BASE_HEIGHT * (0.8 + 0.9 * n) + rng:NextNumber(-0.8, 0.8)
		local taperStart = math.clamp(t / 0.22, 0, 1) ^ 1.5 -- острый «хвост» в начале
		local taperEnd = 0.6 + 0.4 * math.clamp((1 - t) / 0.15, 0, 1)
		heights[i] = math.max(h, 2) * taperStart * taperEnd + 0.05
		maxHeight = math.max(maxHeight, heights[i])

		if i > 0 then
			arc[i] = arc[i - 1] + (bottom[i] - bottom[i - 1]).Magnitude
		end
	end

	local function topPoint(i: number): Vector3
		return bottom[i] + ups[i] * heights[i]
	end

	-- Точка на краю для дробного индекса s (0..N); edge = 0 — низ, 1 — верх
	local function sampleEdge(s: number, edge: number): (Vector3, Vector3, Vector3)
		local i0 = math.clamp(math.floor(s), 0, N - 1)
		local f = s - i0
		local p0 = bottom[i0] + ups[i0] * heights[i0] * edge
		local p1 = bottom[i0 + 1] + ups[i0 + 1] * heights[i0 + 1] * edge
		return p0:Lerp(p1, f), tangents[i0]:Lerp(tangents[i0 + 1], f).Unit, ups[i0]:Lerp(ups[i0 + 1], f).Unit
	end

	local function revealTime(s: number): number
		return (s / N) * CONFIG.BUILD_TIME
	end

	------------------------------------------------------------------
	-- 2. Портал: общая «картина» на всю ленту
	------------------------------------------------------------------
	local chord = bottom[N] - bottom[0]
	local portalX = if chord.Magnitude > 1e-3 then chord.Unit else tangents[0]
	local upSum, centerSum = Vector3.zero, Vector3.zero
	for i = 0, N do
		upSum += ups[i]
		centerSum += bottom[i] + ups[i] * (heights[i] / 2)
	end
	local portalY = (upSum - portalX * upSum:Dot(portalX)).Unit

	local extraLayers = nil
	if CONFIG.PORTAL.IMAGE ~= "" then
		extraLayers = {
			{
				kind = "image",
				depth = CONFIG.PORTAL.IMAGE_DEPTH,
				image = CONFIG.PORTAL.IMAGE,
				tile = CONFIG.PORTAL.IMAGE_TILE,
			},
		}
	end

	local portal = Portal.new({
		length = arc[N],
		height = maxHeight,
		seed = seedValue,
		pixelsPerStud = CONFIG.PORTAL.PIXELS_PER_STUD,
		maxTilt = CONFIG.PORTAL.MAX_TILT,
		brightness = CONFIG.PORTAL.BRIGHTNESS,
		extraLayers = extraLayers,
		-- общая плоскость ленты: параллакс одинаковый для всех сегментов, без швов
		frame = CFrame.fromMatrix(centerSum / (N + 1), portalX, portalY),
	})

	------------------------------------------------------------------
	-- 3. Шипы (заранее рассчитываем, создаём части сразу, прячем)
	------------------------------------------------------------------
	local spikes: { Spike } = {}

	local function addSpike(edge: number)
		local s = rng:NextNumber(N * 0.12, N - 0.01)
		local pos, tangent, up = sampleEdge(s, edge)
		local normal = tangent:Cross(up)
		local outward = if edge == 1 then up else -up
		local dir = (outward + tangent * rng:NextNumber(-0.6, 0.6) + normal * rng:NextNumber(-0.25, 0.25)).Unit
		local width = rng:NextNumber(CONFIG.SPIKE_WIDTH.Min, CONFIG.SPIKE_WIDTH.Max)
		local length = rng:NextNumber(CONFIG.SPIKE_LENGTH.Min, CONFIG.SPIKE_LENGTH.Max)
		if edge == 0 then
			length *= 0.75
		end

		local b1 = pos - tangent * (width / 2)
		local b2 = pos + tangent * (width / 2)
		local w1 = newPart("WedgePart", folder)
		local w2 = newPart("WedgePart", folder)
		w1.Color = SPIKE_COLOR
		w2.Color = SPIKE_COLOR

		local a1 = newAttachment(anchor, b1)
		local a2 = newAttachment(anchor, b2)
		local tipAtt = newAttachment(anchor, pos)
		local beamA = newBeam(anchor, a1, tipAtt, CONFIG.EDGE_WIDTH * 0.7, EDGE_COLOR)
		local beamB = newBeam(anchor, a2, tipAtt, CONFIG.EDGE_WIDTH * 0.7, EDGE_COLOR)
		beamA.Enabled = false
		beamB.Enabled = false

		table.insert(spikes, {
			b1 = b1,
			b2 = b2,
			dir = dir,
			length = length,
			start = revealTime(s) + CONFIG.SPIKE_DELAY + rng:NextNumber(0, 0.25),
			w1 = w1,
			w2 = w2,
			tipAtt = tipAtt,
			beams = { beamA, beamB },
			progress = -1,
		})
	end
	for _ = 1, CONFIG.TOP_SPIKES do
		addSpike(1)
	end
	for _ = 1, CONFIG.BOTTOM_SPIKES do
		addSpike(0)
	end

	------------------------------------------------------------------
	-- 4. Построение ленты по мере полёта шара
	------------------------------------------------------------------
	local windows: { { window: any, born: number } } = {}
	local caps: { Cap } = {}
	local edgeBeams: { Beam } = {}
	local bottomAtts: { Attachment } = {}
	local topAtts: { Attachment } = {}

	-- «Шапка»: светящаяся полоска между прямоугольным окном и рваным верхним краем
	local function addCap(a: Vector3, b: Vector3, c: Vector3, col: number, born: number)
		local w1 = newPart("WedgePart", folder)
		local w2 = newPart("WedgePart", folder)
		if drawTriangle(a, b, c, w1, w2, THICK) then
			table.insert(caps, { w1 = w1, w2 = w2, col = col, born = born })
		else
			w1:Destroy()
			w2:Destroy()
		end
	end

	local function buildColumn(i: number, now: number)
		bottomAtts[i] = newAttachment(anchor, bottom[i])
		topAtts[i] = newAttachment(anchor, topPoint(i))
		if i == 0 then
			return
		end

		local b0, b1 = bottom[i - 1], bottom[i]
		local seg = b1 - b0
		local len = seg.Magnitude
		if len > 1e-3 then
			-- Окно портала — прямоугольная пластина вдоль сегмента
			local xAxis = seg / len
			local upAvg = ups[i - 1] + ups[i]
			local yAxis = (upAvg - xAxis * upAvg:Dot(xAxis)).Unit
			local h = math.min(heights[i - 1] * ups[i - 1]:Dot(yAxis), heights[i] * ups[i]:Dot(yAxis))
			if h > 0.25 then
				local overlap = len * 0.02 -- чуть внахлёст, чтобы не было щелей
				local part = newPart("Part", folder)
				part.Name = "PortalWindow" .. i
				part.Material = Enum.Material.SmoothPlastic
				part.Size = Vector3.new(len + 2 * overlap, h, THICK)
				part.CFrame = CFrame.fromMatrix((b0 + b1) / 2 + yAxis * (h / 2), xAxis, yAxis)
				local window = portal:addWindow(part, arc[i - 1] - overlap, arc[i] + overlap, h)
				window.alpha = 0
				table.insert(windows, { window = window, born = now })
			else
				h = 0 -- в тонком «хвосте» окна нет, только светящаяся шапка
			end

			local r0, r1 = b0 + yAxis * h, b1 + yAxis * h
			addCap(r0, r1, topPoint(i), i, now)
			addCap(r0, topPoint(i), topPoint(i - 1), i, now)
		end

		table.insert(edgeBeams, newBeam(anchor, bottomAtts[i - 1], bottomAtts[i], CONFIG.EDGE_WIDTH, EDGE_COLOR))
		table.insert(edgeBeams, newBeam(anchor, topAtts[i - 1], topAtts[i], CONFIG.EDGE_WIDTH * 0.8, EDGE_COLOR))

		for _ = 1, CONFIG.SHARDS_PER_COLUMN do
			local top = rng:NextNumber() < 0.6
			local base = if top then topAtts[i].Position else bottomAtts[i].Position
			spawnShard(folder, rng, base, if top then ups[i] else -ups[i])
		end
	end

	------------------------------------------------------------------
	-- 5. Главный цикл. Привязан к рендеру сразу ПОСЛЕ камеры, чтобы
	--    параллакс в портале не отставал от поворота камеры.
	------------------------------------------------------------------
	local orbPart, halo, sparkles = createOrb(folder)
	local orb: BasePart? = orbPart
	local orbDir = tangents[N]
	local builtUpTo = -1

	local fadeStart = CONFIG.BUILD_TIME + CONFIG.SPIKE_DELAY + 0.25 + CONFIG.SPIKE_GROW_TIME + CONFIG.HOLD_TIME
	local total = fadeStart + CONFIG.FADE_TIME
	local startClock = os.clock()
	local lastShimmer = -math.huge
	local edgeFadeApplied = 1

	effectCounter += 1
	local bindName = "AuroraEffect" .. effectCounter
	local finished = false

	local function stop()
		if finished then
			return
		end
		finished = true
		RunService:UnbindFromRenderStep(bindName)
		portal:destroy()
		folder:Destroy()
	end

	RunService:BindToRenderStep(bindName, Enum.RenderPriority.Camera.Value + 1, function()
		local t = os.clock() - startClock
		local fade = 1 - math.clamp((t - fadeStart) / CONFIG.FADE_TIME, 0, 1)

		-- шар
		local build = math.clamp(t / CONFIG.BUILD_TIME, 0, 1)
		if orb then
			if build < 1 then
				local pos = sampleEdge(build * N, 0)
				orb.CFrame = CFrame.new(pos)
				halo.CFrame = orb.CFrame
			else
				-- долетает дальше по касательной и гаснет
				local k = math.clamp((t - CONFIG.BUILD_TIME) / 0.6, 0, 1)
				local pos = bottom[N] + orbDir * (k * 12)
				orb.CFrame = CFrame.new(pos)
				halo.CFrame = orb.CFrame
				orb.Size = Vector3.one * (2.4 * (1 - k) + 0.01)
				halo.Size = Vector3.one * (4.5 * (1 - k) + 0.01)
				sparkles.Enabled = false
				if k >= 1 then
					orb:Destroy()
					orb = nil
				end
			end
		end

		-- новые сегменты ленты
		local target = math.floor(build * N)
		while builtUpTo < target do
			builtUpTo += 1
			buildColumn(builtUpTo, t)
		end

		-- портал: проявление окон и параллакс
		for _, entry in windows do
			entry.window.alpha = math.clamp((t - entry.born) / 0.35, 0, 1) * fade
		end
		portal:update(t)

		-- шипы (каждый кадр, чтобы рост был плавным)
		for _, spike in spikes do
			local grow = math.clamp((t - spike.start) / CONFIG.SPIKE_GROW_TIME, 0, 1)
			local p = math.min(if grow > 0 then easeOutBack(grow) else 0, fade)
			if p ~= spike.progress then
				local first = spike.progress <= 0 and p > 0
				spike.progress = p
				if p <= 0.02 then
					spike.w1.Transparency = 1
					spike.w2.Transparency = 1
					spike.beams[1].Enabled = false
					spike.beams[2].Enabled = false
				else
					local mid = (spike.b1 + spike.b2) / 2
					local widthScale = math.min(1, p * 2)
					local b1 = mid:Lerp(spike.b1, widthScale)
					local b2 = mid:Lerp(spike.b2, widthScale)
					local tip = mid + spike.dir * (spike.length * p)
					local ok = drawTriangle(b1, b2, tip, spike.w1, spike.w2, THICK * 2)
					local transparency = if ok then 0.1 + 0.9 * (1 - fade) else 1
					spike.w1.Transparency = transparency
					spike.w2.Transparency = transparency
					spike.tipAtt.Position = tip
					spike.beams[1].Enabled = ok
					spike.beams[2].Enabled = ok
					if first then
						spawnShard(folder, rng, tip, spike.dir)
					end
				end
			end
		end

		-- переливы светящихся «шапок» и исчезновение контура (не каждый кадр)
		if t - lastShimmer >= 1 / CONFIG.UPDATE_RATE then
			lastShimmer = t
			for _, cap in caps do
				local fadeIn = math.clamp((t - cap.born) / 0.35, 0, 1)
				local wave = math.sin(t * 2.2 + cap.col * 0.35) * 0.12
				local color = auroraColor(0.82 + wave):Lerp(Color3.new(1, 1, 1), 0.35)
				local rays = 0.5 + 0.5 * math.sin(cap.col * 1.9 + t * 1.5)
				local base = 0.25 + rays * 0.2
				local transparency = 1 - (1 - base) * fadeIn * fade
				cap.w1.Color = color
				cap.w2.Color = color
				cap.w1.Transparency = transparency
				cap.w2.Transparency = transparency
			end

			if fade < 1 and math.abs(edgeFadeApplied - fade) > 0.02 then
				edgeFadeApplied = fade
				local seq = NumberSequence.new(1 - fade)
				for _, beam in edgeBeams do
					beam.Transparency = seq
				end
				for _, spike in spikes do
					spike.beams[1].Transparency = seq
					spike.beams[2].Transparency = seq
				end
			end
		end

		if t >= total then
			stop()
		end
	end)

	return stop
end

return AuroraEffect
