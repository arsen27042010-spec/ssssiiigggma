const NAMES = ['Ветроград','Берёзовка','Озёрный край','Каменск','Сосновый бор','Заречье','Приморье','Белый мыс','Долина','Лесогорск','Высокогорье','Светлый берег','Равнины','Горный ключ','Нагорье','Тихая бухта','Дубрава','Янтарный край','Перевал','Зелёные поля','Рудные холмы','Лесной край','Скалы','Морские ворота','Западный берег','Три реки','Центральная долина','Старый тракт','Солнечный край','Верховье','Кедровый лес','Мыс Надежды','Южный берег','Нижние поля','Каменный брод','Речная долина','Степной край','Медные горы','Южные холмы','Портовый край','Лазурный берег','Тёплые поля','Старый лес','Золотой луг','Северная гавань','Новый берег','Устье','Дальний мыс'];
export const STARTS = [[0,1,8],[4,5,12],[6,7,15],[32,40,41],[36,44,45],[38,39,47]];
export function createWorld() {
  return NAMES.map((name, id) => {
    const q = id % 8, r = Math.floor(id / 8);
    const terrain = (q === 0 || q === 7 || r === 0 || r === 5) ? 'coast' : ((q + r * 2) % 5 === 0 ? 'mountain' : (q + r) % 3 === 0 ? 'forest' : 'plain');
    const neighbors = [[q-1,r],[q+1,r],[q,r-1],[q,r+1],[q+(r%2?1:-1),r-1],[q+(r%2?1:-1),r+1]].filter(([x,y])=>x>=0&&x<8&&y>=0&&y<6).map(([x,y])=>y*8+x);
    return { id, name, q, r, terrain, neighbors, owner: null, population: 0, development: 1, priority: 'balanced', specialization: { agriculture: 0, industry: 0, trade: 0 }, buildings: [], construction: null, recovery: 0, happiness: 75 };
  });
}
export function route(m, from, to, allowed = () => true) {
  if (!m.regions[from] || !m.regions[to]) return null;
  const queue = [[from]], seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift(), id = path.at(-1);
    if (id === to) return path;
    for (const n of m.regions[id].neighbors) if (!seen.has(n) && allowed(m.regions[n])) { seen.add(n); queue.push([...path,n]); }
  }
  return null;
}
export const ownRegions = (m, id) => m.regions.filter(r => r.owner === id);
export const country = (m, id) => m.countries.find(c => c.id === id);
export function tradeRoute(m,sellerId,buyerId) {
  const seller=country(m,sellerId),buyer=country(m,buyerId);
  const source=ownRegions(m,sellerId).find(r=>r.id===seller.capital)??ownRegions(m,sellerId)[0];
  const destination=ownRegions(m,buyerId).find(r=>r.id===buyer.capital)??ownRegions(m,buyerId)[0];
  const path=source&&destination?route(m,source.id,destination.id):null;
  return path?{path,eta:(path.length-1)*8+8}:null;
}
export function addEvent(m, owner, text, kind = 'info') {
  m.events.push({ id: ++m.sequence, time: m.time, owner, text, kind });
  if (m.events.length > 400) m.events.shift();
}
