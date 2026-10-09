--[[
	Portal — «окно в другой мир» на SurfaceGui с параллаксом.

	Идея: на тонкую деталь вешается SurfaceGui, а внутри лежат несколько
	слоёв (фон, звёзды, туманность, лучи сияния). Каждый слой как будто
	находится на своей глубине ЗА поверхностью. Каждый кадр (сразу после
	обновления камеры) мы смотрим, под каким углом камера видит портал, и
	сдвигаем слои: дальние — сильнее, ближние — слабее. Глаз воспринимает
	это как объём внутри плоской детали. Плюс слои медленно «плывут» сами.

	Одна «картина» может быть разбита на много окон (деталей), стоящих рядом,
	— например, на сегменты изогнутой ленты. Координаты у них общие, поэтому
	картинка непрерывна между сегментами.

	Координаты картины: u — вдоль окна (стады, от 0 до length),
	v — вверх от нижнего края (стады, от 0 до height).

	Пример (простой портал-дверь, LocalScript):
		local Portal = require(ReplicatedStorage.AuroraEffect.Portal)
		local door = workspace.PortalDoor -- тонкая деталь, «лицом» по оси Z
		local portal = Portal.new({ length = door.Size.X, height = door.Size.Y })
		portal:addWindow(door, 0, door.Size.X, door.Size.Y)
		RunService:BindToRenderStep("PortalDoor", Enum.RenderPriority.Camera.Value + 1, function()
			portal:update(os.clock())
		end)
]]

local Portal = {}
Portal.__index = Portal

export type LayerDef = {
	kind: "gradient" | "dots" | "blobs" | "image",
	depth: number, -- глубина в стадах за поверхностью (0 = на самой поверхности)
	drift: Vector2?, -- амплитуда медленного «плавания» слоя в стадах (u, v)
	driftSpeed: number?,
	-- gradient: один большой градиент на всю картину
	color: ColorSequence?,
	transparency: NumberSequence?,
	rotation: number?,
	-- dots / blobs: россыпь звёзд / пятен туманности
	density: number?, -- штук на квадратный стад
	size: NumberRange?,
	colors: { Color3 }?,
	alpha: NumberRange?, -- прозрачность элементов
	-- image: своя картинка (rbxassetid://...), повторяется плиткой.
	-- Для blobs можно тоже указать image — тогда пятна будут этой картинкой.
	image: string?,
	tile: number?, -- размер плитки в стадах
}

-- Слои по умолчанию: фиолетовый космос, звёзды, туманность,
-- бирюзовая диагональная полоса и светлые вертикальные лучи сияния.
-- Всё сделано из Frame + UIGradient, никаких загруженных картинок не нужно.
local function defaultLayers(rng: Random): { LayerDef }
	local rays = {}
	local count = 18 -- у NumberSequence максимум 20 точек
	for i = 0, count do
		local value = if i % 2 == 0 then rng:NextNumber(0.5, 0.72) else rng:NextNumber(0.85, 1)
		table.insert(rays, NumberSequenceKeypoint.new(i / count, value))
	end

	return {
		{
			kind = "gradient",
			depth = 10,
			rotation = 90, -- сверху вниз
			color = ColorSequence.new({
				ColorSequenceKeypoint.new(0, Color3.fromRGB(18, 14, 55)),
				ColorSequenceKeypoint.new(0.45, Color3.fromRGB(65, 45, 150)),
				ColorSequenceKeypoint.new(1, Color3.fromRGB(150, 120, 230)),
			}),
			transparency = NumberSequence.new(0),
		},
		{
			kind = "dots",
			depth = 8,
			density = 0.03,
			size = NumberRange.new(0.08, 0.26),
			colors = { Color3.fromRGB(255, 255, 255), Color3.fromRGB(180, 230, 255), Color3.fromRGB(255, 200, 255) },
			alpha = NumberRange.new(0, 0.4),
			drift = Vector2.new(0.6, 0.3),
			driftSpeed = 0.25,
		},
		{
			kind = "blobs",
			depth = 5,
			density = 0.004,
			size = NumberRange.new(6, 14),
			colors = { Color3.fromRGB(255, 110, 220), Color3.fromRGB(190, 90, 255), Color3.fromRGB(80, 220, 255) },
			alpha = NumberRange.new(0.45, 0.7),
			drift = Vector2.new(1.2, 0.6),
			driftSpeed = 0.35,
		},
		{
			kind = "gradient",
			depth = 3.5,
			rotation = -32,
			color = ColorSequence.new(Color3.fromRGB(150, 255, 210), Color3.fromRGB(40, 255, 170)),
			transparency = NumberSequence.new({
				NumberSequenceKeypoint.new(0, 1),
				NumberSequenceKeypoint.new(0.38, 1),
				NumberSequenceKeypoint.new(0.47, 0.25),
				NumberSequenceKeypoint.new(0.5, 0.05),
				NumberSequenceKeypoint.new(0.55, 0.35),
				NumberSequenceKeypoint.new(0.64, 1),
				NumberSequenceKeypoint.new(1, 1),
			}),
			drift = Vector2.new(1.5, 0.5),
			driftSpeed = 0.5,
		},
		{
			kind = "gradient",
			depth = 1.5,
			rotation = 0, -- полосы идут вертикально
			color = ColorSequence.new(Color3.fromRGB(220, 210, 255), Color3.fromRGB(170, 240, 255)),
			transparency = NumberSequence.new(rays),
			drift = Vector2.new(0.8, 0),
			driftSpeed = 0.7,
		},
	}
end
Portal.defaultLayers = defaultLayers

export type Params = {
	length: number,
	height: number,
	seed: number?,
	pixelsPerStud: number?,
	maxTilt: number?, -- ограничение параллакса при взгляде под острым углом
	brightness: number?,
	layers: { LayerDef }?, -- полностью заменить слои
	extraLayers: { LayerDef }?, -- добавить к слоям по умолчанию (например, свою картинку)
	-- Общая система координат для параллакса. Если задана, все окна сдвигаются
	-- одинаково и картинка не рвётся на стыках (нужно для изогнутой ленты).
	-- Если нет — каждое окно считает параллакс по себе (точнее для одиночного окна).
	frame: CFrame?,
}

function Portal.new(params: Params)
	local self = setmetatable({}, Portal)
	local rng = Random.new(params.seed or 1)
	self.length = params.length
	self.height = params.height
	self.pps = params.pixelsPerStud or 24
	self.maxTilt = params.maxTilt or 1.2
	self.brightness = params.brightness or 1.6
	self.frame = params.frame
	self.windows = {}

	local layers = table.clone(params.layers or defaultLayers(rng))
	if params.extraLayers then
		for _, layer in params.extraLayers do
			table.insert(layers, layer)
		end
	end
	-- дальние слои рисуются первыми (под ближними)
	table.sort(layers, function(a, b)
		return a.depth > b.depth
	end)
	self.layers = {}

	for index, def in layers do
		local drift = def.drift or Vector2.zero
		local layer = {
			def = def,
			index = index,
			depth = def.depth,
			-- насколько слой может сдвинуться — столько картинки нужно иметь «про запас» по краям
			margin = def.depth * self.maxTilt + math.max(drift.X, drift.Y),
			drift = drift,
			driftSpeed = def.driftSpeed or 0.3,
			phase = rng:NextNumber(0, math.pi * 2),
			items = nil :: { any }?,
		}

		-- Звёзды и туманности раскладываем заранее по всей картине,
		-- чтобы соседние окна показывали одни и те же объекты.
		if def.kind == "dots" or def.kind == "blobs" then
			local size = def.size or NumberRange.new(1)
			local colors = def.colors or { Color3.new(1, 1, 1) }
			local alpha = def.alpha or NumberRange.new(0)
			local m = layer.margin + size.Max
			local area = (self.length + 2 * m) * (self.height + 2 * m)
			local items = {}
			for _ = 1, math.floor(area * (def.density or 0.01)) do
				table.insert(items, {
					u = rng:NextNumber(-m, self.length + m),
					v = rng:NextNumber(-m, self.height + m),
					size = rng:NextNumber(size.Min, size.Max),
					stretch = rng:NextNumber(1, 1.8),
					color = colors[rng:NextInteger(1, #colors)],
					alpha = rng:NextNumber(alpha.Min, alpha.Max),
					rotation = rng:NextNumber(0, 180),
				})
			end
			layer.items = items
		end
		table.insert(self.layers, layer)
	end
	return self
end

local function addFade(window, obj: Instance, prop: string, base: number)
	table.insert(window.fades, { obj = obj, prop = prop, base = base })
end

-- Мягкое пятно туманности без картинок: круг, прозрачный к краям
local function makeBlob(item, pps: number): GuiObject
	local blob = Instance.new("Frame")
	blob.BorderSizePixel = 0
	blob.BackgroundColor3 = item.color
	-- Сам кадр не поворачиваем (у ClipsDescendants в Roblox ограничения с поворотом),
	-- вместо этого поворачиваем направление градиента — пятна получаются разными.
	blob.Size = UDim2.fromOffset(item.size * item.stretch * pps, item.size * pps)

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = blob

	local gradient = Instance.new("UIGradient")
	gradient.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 1),
		NumberSequenceKeypoint.new(0.5, 0),
		NumberSequenceKeypoint.new(1, 1),
	})
	gradient.Rotation = item.rotation
	gradient.Parent = blob
	return blob
end

-- Деталь part должна быть тонкой прямоугольной пластиной: её локальная ось X
-- идёт вдоль u (от u0 к u1), ось Y — вверх, нижний край детали — это v = 0,
-- высота детали h. Окно видно с обеих сторон.
function Portal:addWindow(part: BasePart, u0: number, u1: number, h: number)
	local pps = self.pps

	local gui = Instance.new("SurfaceGui")
	gui.Name = "PortalWindow"
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = pps
	gui.LightInfluence = 0
	gui.Brightness = self.brightness
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.Face = Enum.NormalId.Back

	local root = Instance.new("Frame")
	root.Name = "Clip"
	root.Size = UDim2.fromScale(1, 1)
	root.BackgroundTransparency = 1
	root.ClipsDescendants = true
	root.Parent = gui

	local window = {
		part = part,
		gui = gui,
		u0 = u0,
		u1 = u1,
		h = h,
		front = nil :: boolean?,
		canvases = {},
		items = {},
		tiles = {},
		fades = {},
		alpha = 1,
		appliedAlpha = -1,
	}

	for _, layer in self.layers do
		local def = layer.def
		local m = layer.margin

		-- canvas — точка (u = 0, v = 0) картины для этого слоя. Двигая её,
		-- двигаем весь слой целиком.
		local canvas = Instance.new("Frame")
		canvas.Name = "Layer" .. layer.index
		canvas.Size = UDim2.fromOffset(0, 0)
		canvas.BackgroundTransparency = 1
		canvas.ZIndex = layer.index
		canvas.Parent = root
		table.insert(window.canvases, { frame = canvas, layer = layer })

		if def.kind == "gradient" then
			-- Один градиент на всю картину (+ запас), симметрично по u,
			-- поэтому одинаково стыкуется и при зеркальном виде сзади.
			local frame = Instance.new("Frame")
			frame.BorderSizePixel = 0
			frame.BackgroundColor3 = Color3.new(1, 1, 1)
			frame.Position = UDim2.fromOffset(-m * pps, -(self.height + m) * pps)
			frame.Size = UDim2.fromOffset((self.length + 2 * m) * pps, (self.height + 2 * m) * pps)
			frame.Parent = canvas
			local gradient = Instance.new("UIGradient")
			gradient.Color = def.color or ColorSequence.new(Color3.new(1, 1, 1))
			gradient.Transparency = def.transparency or NumberSequence.new(0)
			gradient.Rotation = def.rotation or 0
			gradient.Parent = frame
			addFade(window, frame, "BackgroundTransparency", 0)
		elseif def.kind == "image" then
			-- Плитки привязаны к общей сетке, поэтому соседние окна стыкуются.
			local tile = def.tile or 30
			local startU = math.floor((u0 - m) / tile) * tile
			local endU = math.ceil((u1 + m) / tile) * tile
			local topV = math.ceil((self.height + m) / tile) * tile
			local bottomV = math.floor(-m / tile) * tile
			local image = Instance.new("ImageLabel")
			image.BackgroundTransparency = 1
			image.Image = def.image or ""
			image.ScaleType = Enum.ScaleType.Tile
			image.TileSize = UDim2.fromOffset(tile * pps, tile * pps)
			image.Size = UDim2.fromOffset((endU - startU) * pps, (topV - bottomV) * pps)
			image.Parent = canvas
			table.insert(window.tiles, { obj = image, startU = startU, endU = endU, topV = topV })
			addFade(window, image, "ImageTransparency", 0)
		elseif layer.items then
			local pad = m + (def.size and def.size.Max or 1) * 1.8
			for _, item in layer.items do
				if item.u >= u0 - pad and item.u <= u1 + pad and item.v >= -pad and item.v <= h + pad then
					local obj: GuiObject
					if def.kind == "dots" then
						obj = Instance.new("Frame")
						obj.BorderSizePixel = 0
						obj.BackgroundColor3 = item.color
						obj.Size = UDim2.fromOffset(item.size * pps, item.size * pps)
						addFade(window, obj, "BackgroundTransparency", item.alpha)
					elseif def.image then
						local image = Instance.new("ImageLabel")
						image.BackgroundTransparency = 1
						image.Image = def.image
						image.ImageColor3 = item.color
						image.Size = UDim2.fromOffset(item.size * item.stretch * pps, item.size * pps)
						addFade(window, image, "ImageTransparency", item.alpha)
						obj = image
					else
						obj = makeBlob(item, pps)
						addFade(window, obj, "BackgroundTransparency", item.alpha)
					end
					obj.AnchorPoint = Vector2.new(0.5, 0.5)
					obj.Parent = canvas
					table.insert(window.items, { obj = obj, u = item.u, v = item.v })
				end
			end
		end
	end

	gui.Parent = part
	table.insert(self.windows, window)
	return window
end

-- Расставить элементы с учётом того, с какой стороны смотрит камера.
-- SurfaceGui с обратной стороны детали показывает картину зеркально
-- (u идёт справа налево), поэтому там используем u' = length - u.
local function layoutItems(self, window)
	local pps = self.pps
	local L = self.length
	for _, item in window.items do
		local u = if window.front then L - item.u else item.u
		item.obj.Position = UDim2.fromOffset(u * pps, -item.v * pps)
	end
	for _, tile in window.tiles do
		local left = if window.front then L - tile.endU else tile.startU
		tile.obj.Position = UDim2.fromOffset(left * pps, -tile.topV * pps)
	end
end

local function applyAlpha(window)
	local alpha = window.alpha
	-- мелкие изменения пропускаем, но 0 и 1 всегда доводим точно
	if alpha == window.appliedAlpha or (math.abs(window.appliedAlpha - alpha) < 0.01 and alpha > 0 and alpha < 1) then
		return
	end
	window.appliedAlpha = window.alpha
	window.gui.Enabled = window.alpha > 0
	for _, fade in window.fades do
		fade.obj[fade.prop] = 1 - (1 - fade.base) * window.alpha
	end
end

-- Позиция камеры относительно окна: (x, y) вдоль окна и расстояние до
-- плоскости z. Под очень острым углом z ограничиваем снизу, чтобы слои не
-- улетали.
local function viewPoint(c: Vector3): (number, number, number)
	return c.X, c.Y, math.max(math.abs(c.Z), 0.3 * c.Magnitude, 0.05)
end

-- Вызывать каждый кадр на клиенте, лучше через
-- RunService:BindToRenderStep(..., Enum.RenderPriority.Camera.Value + 1, ...),
-- чтобы слои двигались точно вместе с камерой, без отставания на кадр.
function Portal:update(t: number, camera: Camera?)
	local cam = camera or workspace.CurrentCamera
	if not cam then
		return
	end
	local camPos = cam.CFrame.Position
	local pps = self.pps
	local L = self.length

	local maxTilt = self.maxTilt
	local sharedX, sharedY, sharedZ
	if self.frame then
		sharedX, sharedY, sharedZ = viewPoint(self.frame:PointToObjectSpace(camPos))
	end

	-- медленное плавание слоёв (в координатах картины, поэтому без швов)
	for _, layer in self.layers do
		local speed = layer.driftSpeed
		layer.du = math.sin(t * speed + layer.phase) * layer.drift.X
		layer.dv = math.cos(t * speed * 0.7 + layer.phase) * layer.drift.Y
	end

	for _, window in self.windows do
		applyAlpha(window)
		if not window.gui.Enabled then
			continue
		end

		local c = window.part.CFrame:PointToObjectSpace(camPos)
		local front = c.Z < 0
		if front ~= window.front then
			window.front = front
			window.gui.Face = if front then Enum.NormalId.Front else Enum.NormalId.Back
			layoutItems(self, window)
		end

		local cx, cy, cz = sharedX, sharedY, sharedZ
		if not cx then
			cx, cy, cz = viewPoint(c)
		end

		-- Где на экране окна находится точка (u = 0, v = 0) картины
		local baseX = if front then -(L - window.u1) * pps else -window.u0 * pps
		local baseY = window.h * pps
		local sign = if front then -1 else 1 -- сзади картина зеркальна

		for _, entry in window.canvases do
			local layer = entry.layer
			-- Луч от камеры к точке слоя на глубине d пересекает окно со сдвигом
			-- c * d / (z + d) — так выглядела бы настоящая глубина за стеклом.
			local d = layer.depth
			local limit = maxTilt * d
			local du = math.clamp(cx * d / (cz + d), -limit, limit) + layer.du
			local dv = math.clamp(cy * d / (cz + d), -limit, limit) + layer.dv
			entry.frame.Position = UDim2.fromOffset(baseX + sign * du * pps, baseY - dv * pps)
		end
	end
end

function Portal:destroy()
	for _, window in self.windows do
		window.gui:Destroy()
	end
	table.clear(self.windows)
end

return Portal
