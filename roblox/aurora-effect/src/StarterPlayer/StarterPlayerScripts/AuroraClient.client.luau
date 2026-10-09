--[[
	Клиентская часть: по нажатию E (или кнопке на телефоне / X на геймпаде)
	просит сервер запустить эффект и проигрывает его, когда сервер разрешит.
]]

local ContextActionService = game:GetService("ContextActionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local AuroraEffect = require(ReplicatedStorage:WaitForChild("AuroraEffect"))
local remote = ReplicatedStorage:WaitForChild("AuroraCast") :: RemoteEvent

remote.OnClientEvent:Connect(function(origin: CFrame, seed: number)
	AuroraEffect.play(origin, seed)
end)

local function onCast(_actionName: string, state: Enum.UserInputState)
	if state == Enum.UserInputState.Begin then
		remote:FireServer()
	end
	return Enum.ContextActionResult.Sink
end

-- true = создать кнопку на экране для мобильных устройств
ContextActionService:BindAction("AuroraCast", onCast, true, Enum.KeyCode.E, Enum.KeyCode.ButtonX)
ContextActionService:SetTitle("AuroraCast", "Aurora")
