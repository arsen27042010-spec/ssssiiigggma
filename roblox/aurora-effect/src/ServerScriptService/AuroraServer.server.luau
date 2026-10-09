--[[
	Серверная часть: принимает запрос от игрока, проверяет кулдаун
	и рассылает всем клиентам команду проиграть эффект.
	Сам эффект рисуется на клиентах — так он плавный и не грузит сервер.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local COOLDOWN = 4 -- секунд между использованиями для одного игрока

local remote = ReplicatedStorage:FindFirstChild("AuroraCast")
if not remote then
	remote = Instance.new("RemoteEvent")
	remote.Name = "AuroraCast"
	remote.Parent = ReplicatedStorage
end

local lastCast: { [Player]: number } = {}

remote.OnServerEvent:Connect(function(player: Player)
	local now = os.clock()
	if lastCast[player] and now - lastCast[player] < COOLDOWN then
		return
	end

	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root or not root:IsA("BasePart") then
		return
	end
	lastCast[player] = now

	-- Ровняем по горизонтали, чтобы эффект не заваливался, если игрок прыгает
	local look = root.CFrame.LookVector * Vector3.new(1, 0, 1)
	if look.Magnitude < 1e-3 then
		look = Vector3.new(0, 0, -1)
	end
	local origin = CFrame.lookAt(root.Position, root.Position + look.Unit)

	-- Один и тот же seed у всех клиентов => все видят одинаковый эффект
	remote:FireAllClients(origin, math.random(1, 1000000))
end)

Players.PlayerRemoving:Connect(function(player)
	lastCast[player] = nil
end)
