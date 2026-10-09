# Aurora Portal — эффект для Roblox

Повтор эффекта из видео «scripted effect i made on roblox»:

1. Светящийся шар с искрами летит дугой вокруг игрока.
2. За ним вырастает лента-**портал**. Внутри не плоская картинка, а «окно в космос»:
   звёзды, розовая туманность, бирюзовая полоса и лучи сияния лежат на разной глубине.
   Когда камера двигается, слои сдвигаются по-разному (параллакс), поэтому видна глубина.
   Ещё слои медленно «плывут» сами.
3. По краям идёт светящийся контур, отлетают осколки.
4. По краям ленты волной вырастают острые ледяные шипы.
5. Эффект держится ~6 секунд и растворяется.

Нажмите **E** (на телефоне есть кнопка на экране, на геймпаде **X**), и эффект увидят все игроки на сервере.

Никаких мешей и загруженных картинок не нужно: всё собрано из стандартных деталей, Beam и SurfaceGui.

## Файлы

```
src/
  ReplicatedStorage/
    AuroraEffect/          ModuleScript «AuroraEffect» (init.luau) — сам эффект
      Portal.luau          ModuleScript «Portal» внутри него — окно с параллаксом
  ServerScriptService/
    AuroraServer.server.luau   Script — кулдаун и рассылка эффекта всем
  StarterPlayer/StarterPlayerScripts/
    AuroraClient.client.luau   LocalScript — клавиша E и проигрывание эффекта
default.project.json       для Rojo (необязательно)
```

## Установка в Roblox Studio (вручную, без Rojo)

1. **ReplicatedStorage** → вставьте **ModuleScript**, переименуйте в `AuroraEffect`,
   вставьте в него код из `src/ReplicatedStorage/AuroraEffect/init.luau`.
2. **Внутрь** `AuroraEffect` вставьте ещё один **ModuleScript**, назовите `Portal`,
   вставьте код из `src/ReplicatedStorage/AuroraEffect/Portal.luau`.
   Должно получиться: `ReplicatedStorage > AuroraEffect > Portal`.
3. **ServerScriptService** → вставьте **Script** `AuroraServer`, код из `AuroraServer.server.luau`.
4. **StarterPlayer > StarterPlayerScripts** → вставьте **LocalScript** `AuroraClient`,
   код из `AuroraClient.client.luau`.
5. Нажмите Play и затем E.

Через Rojo: `rojo serve` в этой папке и подключитесь плагином.

## Чтобы выглядело как в видео

Эффект сам добавляет `BloomEffect`, если его нет. Для тёмной сцены как в ролике
выставьте в **Lighting**:

| Свойство | Значение |
|---|---|
| `ClockTime` | `0` (ночь) |
| `Brightness` | `0.5` |
| `Ambient` / `OutdoorAmbient` | тёмно-синий, например `20, 25, 60` |
| `EnvironmentDiffuseScale` / `EnvironmentSpecularScale` | `0` |
| Bloom: `Intensity` / `Size` / `Threshold` | `1.1` / `32` / `0.85` |

Можно добавить `ColorCorrectionEffect` с `TintColor` в синеву и `Contrast ≈ 0.15`.
На низком качестве графики свечение Neon и Bloom заметно слабее, поэтому
смотрите на высоком (в Studio: File → Studio Settings → Rendering → Quality Level).

## Как работает портал (SurfaceGui + параллакс)

- Лента разбита на 36 сегментов. Каждый сегмент — невидимая тонкая деталь с
  `SurfaceGui`, это «окно».
- Внутри окна несколько слоёв. У каждого слоя своя **глубина** за поверхностью:
  фон 10, звёзды 8, туманность 5, бирюзовая полоса 3.5, лучи 1.5 стада.
- Каждый кадр (сразу после обновления камеры, через `BindToRenderStep`) скрипт
  считает, откуда смотрит камера, и сдвигает каждый слой на
  `позиция_камеры × глубина / (расстояние + глубина)`. Так выглядела бы настоящая
  глубина за стеклом. Дальние слои сдвигаются сильнее ближних, и плоская деталь
  кажется объёмной.
- Все окна рисуют одну общую «картину» в общих координатах, поэтому звёзды и
  полосы не рвутся на стыках сегментов.
- `SurfaceGui` виден только с одной стороны. Поэтому окно само переключается на ту
  грань, которая смотрит на камеру, и зеркалит картину.
- Рваный верхний край ленты дорисован светящимися треугольниками, а контур сделан из Beam.

### Портал отдельно (например, дверь)

Модуль `Portal` можно использовать сам по себе. Возьмите тонкую деталь
(например, `4 × 7 × 0.2`), «лицом» по оси Z:

```lua
-- LocalScript
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Portal = require(ReplicatedStorage.AuroraEffect.Portal)

local door = workspace:WaitForChild("PortalDoor")
door.Transparency = 1 -- SurfaceGui видно и на прозрачной детали
local portal = Portal.new({ length = door.Size.X, height = door.Size.Y })
portal:addWindow(door, 0, door.Size.X, door.Size.Y)

RunService:BindToRenderStep("PortalDoor", Enum.RenderPriority.Camera.Value + 1, function()
	portal:update(os.clock())
end)
```

## Своя картинка внутри портала

1. Загрузите картинку космоса или туманности: Creator Hub или Asset Manager в Studio → Import.
   Если берёте Decal из Toolbox, нужен ID именно **картинки** (Image), а не Decal.
2. В `AuroraEffect` (init) найдите `CONFIG.PORTAL.IMAGE` и вставьте `"rbxassetid://ВАШ_ID"`.
3. `IMAGE_DEPTH` — глубина слоя, `IMAGE_TILE` — размер плитки в стадах (картинка повторяется).

Для своих слоёв есть `Portal.new({ layers = {...} })` или `extraLayers`. Виды слоёв:
`gradient`, `dots` (звёзды), `blobs` (пятна, можно с `image`), `image` (плитка).

## Основные настройки (`CONFIG` в init.luau)

| Параметр | Что меняет |
|---|---|
| `BUILD_TIME`, `HOLD_TIME`, `FADE_TIME` | скорость полёта шара, сколько висит, как быстро гаснет |
| `PATH` | траектория шара (4 точки кривой Безье относительно игрока) |
| `BASE_HEIGHT` | высота ленты |
| `COLUMNS` | число сегментов ленты (меньше = легче) |
| `TOP_SPIKES`, `BOTTOM_SPIKES`, `SPIKE_LENGTH` | шипы |
| `PORTAL.MAX_TILT` | сила параллакса |
| `PORTAL.PIXELS_PER_STUD` | чёткость картинки в портале |
| `PORTAL.BRIGHTNESS` | яркость свечения портала |

Кулдаун на использование задаётся в `AuroraServer` (`COOLDOWN`, по умолчанию 4 с).

## Производительность

Эффект рисуется **только на клиентах**, сервер лишь передаёт позицию и seed
(одинаковый seed = одинаковый эффект у всех). Один эффект в пике создаёт около
3500 объектов, в основном мелкие GUI-рамки звёзд внутри порталов. Через ~11 секунд
всё удаляется. Если лагает на слабых устройствах:

- уменьшите `COLUMNS` (например, до 24);
- уменьшите `density` у слоёв `dots`/`blobs` в `Portal.defaultLayers`;
- уменьшите `PORTAL.PIXELS_PER_STUD` до 16.

## Что проверено

Код проверен компилятором Luau. Весь таймлайн эффекта прогнан в Luau на
заглушке Roblox API с камерой, летающей вокруг (5 разных seed). Нет ошибок,
NaN и неудалённых объектов. Отдельно численно проверено, что параллакс
совпадает с «настоящей» глубиной за стеклом с обеих сторон окна (погрешность
около 5%). В самом Roblox Studio не запускалось, так что после первого запуска
может понадобиться подстроить цвета, яркость и `PATH` под вашу сцену.
