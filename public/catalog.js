export const RESOURCES = {
  money: { name: 'Казна', icon: '₽', value: 0 }, food: { name: 'Продовольствие', icon: '◒', value: 2 },
  materials: { name: 'Материалы', icon: '▰', value: 3 }, metal: { name: 'Металл', icon: '⬡', value: 5 },
  fuel: { name: 'Топливо', icon: '◈', value: 4 }, weapons: { name: 'Оружие', icon: '⌁', value: 10 },
  tanks: { name: 'Техника', icon: '▣', value: 40 }, ammo: { name: 'Боеприпасы', icon: '⁙', value: 3 },
};
export const BUILDINGS = {
  power: { name: 'Электростанция', icon: 'ϟ', cost: { money: 140, materials: 25 }, seconds: 25, workers: 8, energy: 0, input: { fuel: .5 }, output: {}, power: 12, description: '+12 энергии, расходует топливо' },
  mine: { name: 'Рудник', icon: '⬡', cost: { money: 120, materials: 20 }, seconds: 20, workers: 12, energy: 2, input: {}, output: { metal: 3 }, terrain: ['mountain'], description: '3 металла за цикл. Только в горах' },
  refinery: { name: 'Нефтепромысел', icon: '◈', cost: { money: 160, materials: 25 }, seconds: 25, workers: 10, energy: 2, input: {}, output: { fuel: 3 }, description: '3 топлива за цикл' },
  arms: { name: 'Оружейный завод', icon: '⌁', cost: { money: 180, materials: 30, metal: 10 }, seconds: 30, workers: 15, energy: 3, input: { metal: 2 }, output: { weapons: 2, ammo: 4 }, description: '2 металла → 2 оружия и 4 боеприпаса' },
  armor: { name: 'Танковый завод', icon: '▣', cost: { money: 260, materials: 40, metal: 20 }, seconds: 40, workers: 20, energy: 4, input: { metal: 3, fuel: 1 }, output: { tanks: 1 }, description: '3 металла + 1 топлива → 1 единица техники' },
  warehouse: { name: 'Военный склад', icon: '▤', cost: { money: 80, materials: 20 }, seconds: 15, workers: 0, energy: 0, input: {}, output: {}, description: 'Точка снабжения войск' },
  fort: { name: 'Укрепление', icon: '♜', cost: { money: 100, materials: 30 }, seconds: 20, workers: 0, energy: 0, input: {}, output: {}, description: '+60% к обороне области' },
};
export const UNIT_TYPES = {
  infantry: { name: 'Пехота', icon: '⚑', cost: { money: 60, weapons: 5 }, people: 8, attack: 12, upkeep: 1, seconds: 8 },
  tank: { name: 'Танковый отряд', icon: '▣', cost: { money: 100, tanks: 1 }, people: 4, attack: 28, upkeep: 2, seconds: 10 },
  artillery: { name: 'Артиллерия', icon: '✣', cost: { money: 80, weapons: 8, metal: 5 }, people: 5, attack: 19, upkeep: 1.5, seconds: 12 },
  scout: { name: 'Разведотряд', icon: '⌖', cost: { money: 35, weapons: 1 }, people: 3, attack: 3, upkeep: .5, seconds: 5 },
};
export const PRIORITIES = { balanced: 'Сбалансированное', agriculture: 'Сельское хозяйство', industry: 'Промышленность', trade: 'Торговля' };
export const TERRAINS = { plain: 'Равнина', forest: 'Лес', mountain: 'Горы', coast: 'Побережье' };
export const COLORS = ['#3e8990', '#c07b50', '#7581b4', '#a29b4b', '#b7728b', '#5f9471'];
