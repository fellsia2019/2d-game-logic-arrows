// Original bilingual cards inspired by question topics in John Lloyd and John
// Mitchinson's Book of General Ignorance. Sources verify the actual answers.
import { generalIgnoranceDetails } from './general-ignorance-details';
export const generalIgnoranceCategories = {
  body: { ru: 'Человек и здоровье', en: 'Body and health' },
  food: { ru: 'Еда и привычные вещи', en: 'Food and everyday life' },
  animals: { ru: 'Животные', en: 'Animals' },
  earth: { ru: 'Земля и наука', en: 'Earth and science' },
  space: { ru: 'Космос', en: 'Space' },
  history: { ru: 'История и техника', en: 'History and technology' },
} as const;

export type GeneralIgnoranceCategory = keyof typeof generalIgnoranceCategories;
export type GeneralIgnoranceEntry = {
  id: string;
  category: GeneralIgnoranceCategory;
  ru: { myth: string; fact: string; detail: string };
  en: { myth: string; fact: string; detail: string };
  source: string;
  sourceUrl: string;
};

const sources = {
  nihSenses: ['NIH · Proprioception', 'https://irp.nih.gov/scibites/the-bodys-sixth-sense'],
  brain: ['Society for Neuroscience · BrainFacts', 'https://www.brainfacts.org/thinking-sensing-and-behaving/thinking-and-awareness/2019/debunked-the-10-percent-brain-myth-061719'],
  ulcers: ['NIH · NIDDK', 'https://www.niddk.nih.gov/health-information/digestive-diseases/peptic-ulcers-stomach-ulcers/definition-facts'],
  eyes: ['NIH · National Eye Institute', 'https://www.nei.nih.gov/sites/default/files/2019-06/NEI_Healthy-Vision_booklet_WEB_508%20%281%29.pdf'],
  dogs: ['NIH · Dog aging', 'https://www.nih.gov/news-events/news-releases/nih-researchers-reframe-dog-human-aging-comparisons'],
  pepper: ['New Mexico State University · Chile peppers', 'https://pubs.nmsu.edu/_h/H240/index.html'],
  banana: ['University of Arizona · Banana plant', 'https://apps.cals.arizona.edu/arboretum/taxon.aspx?id=975'],
  lemming: ['Alaska Department of Fish and Game', 'https://www.adfg.alaska.gov/index.cfm?adfg=wildlifenews.view_article&articles_id=56'],
  chameleon: ['Smithsonian National Zoo · Chameleon', 'https://www.nationalzoo.si.edu/animals/mellers-chameleon?qt-learn_more_about_the_animal=1'],
  polar: ['U.S. National Park Service · Polar bear', 'https://www.nps.gov/bela/learn/nature/polar-bear.htm'],
  camel: ['Smithsonian National Zoo · Camel', 'https://nationalzoo.si.edu/global-health-program/news/getting-over-hump-camel-care-kenya'],
  rhino: ['San Diego Zoo · Rhino horn', 'https://sdzwildlifeexplorers.org/activities/crash-course'],
  ostrich: ['Smithsonian · Ostrich', 'https://qrius.si.edu/browse/object/10841840'],
  flamingo: ['Smithsonian National Zoo · Flamingo', 'https://www.nationalzoo.si.edu/animals/news/why-are-flamingos-pink-and-other-flamingo-facts'],
  goldfish: ['Science · Goldfish memory experiment', 'https://pubmed.ncbi.nlm.nih.gov/5409742/'],
  ant: ['NOAA Climate.gov · Antarctica', 'https://www.climate.gov/news-features/features/antarctica-colder-arctic-it%E2%80%99s-still-losing-ice'],
  mountain: ['NASA · Mountains compared', 'https://science.nasa.gov/image-article/apod-2016-february-25-highest-tallest-and-closest-to-the-stars/'],
  quake: ['USGS · Magnitude', 'https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity'],
  drain: ['NOAA · Coriolis and drains', 'https://www.aoml.noaa.gov/hrd/tcfaq/D3.html?print=yes'],
  rain: ['USGS · Raindrop shape', 'https://www.usgs.gov/water-science-school/science/are-raindrops-shaped-teardrops'],
  oxygen: ['NOAA · Ocean oxygen', 'https://oceanservice.noaa.gov/facts/ocean-oxygen.html'],
  diamond: ['GIA · Diamond formation', 'https://www.gia.edu/gems-gemology/winter-2018-how-do-diamonds-form-in-the-deep-earth'],
  water: ['NASA · Ocean color', 'https://science.nasa.gov/earth/earth-observatory/how-to-interpret-a-satellite-image/'],
  glass: ['Corning Museum of Glass · Glass flow', 'https://info.cmog.org/node/631'],
  wall: ['NASA · Space myths', 'https://www.nasa.gov/space-science-and-astrobiology-at-ames/interesting-fact-of-the-month-current/interesting-fact-of-the-month-2020/'],
  planets: ['NASA · Planets', 'https://science.nasa.gov/solar-system/planets/'],
  belt: ['NASA · Dawn FAQ', 'https://science.nasa.gov/mission/dawn/faq/'],
  day: ['NASA · Reference systems', 'https://science.nasa.gov/learn/basics-of-space-flight/chapter2-1/'],
  dinosaurs: ['Natural History Museum · When dinosaurs lived', 'https://www.nhm.ac.uk/discover/when-did-dinosaurs-live.html'],
  bug: ['Computer History Museum · First actual bug', 'https://www.computerhistory.org/tdih/september/9/'],
  round: ['Smithsonian · Columbus and navigation', 'https://americanhistory.si.edu/explore/stories/shortcuts-across-time-and-space'],
  hat: ['Ecuador Travel · Toquilla hat', 'https://ecuador.travel/sombrero-de-paja-toquilla-una-prenda-patrimonial-de-sello-ecuatoriano/'],
} as const;

type SourceKey = keyof typeof sources;
type Row = readonly [id: string, category: GeneralIgnoranceCategory, mythRu: string, factRu: string,
  mythEn: string, factEn: string, source: SourceKey];

// Split the original editorial explanation into the game's two-paragraph reading format.
function readingDetail(value: string): string {
  const breaks = [...value.matchAll(/[.!?]\s+(?=[A-ZА-ЯЁ“«])/g)];
  if (!breaks.length) return value;
  const at = breaks.reduce((best, match) => Math.abs(match.index - value.length / 2) < Math.abs(best.index - value.length / 2) ? match : best);
  return `${value.slice(0, at.index + 1).trim()}\n\n${value.slice(at.index + at[0].length).trim()}`;
}

const rows: Row[] = [
  ['senses', 'body', 'У человека всего пять чувств?', 'Есть и чувство положения тела: оно помогает понимать, где находятся руки и ноги, даже с закрытыми глазами.', 'Do humans have only five senses?', 'We also sense body position: it tells us where our limbs are even with our eyes closed.', 'nihSenses'],
  ['brain-ten-percent', 'body', 'Мы используем только 10% мозга?', 'Нет. Разные области выполняют разные задачи, но идея о «спящих» 90% мозга не подтверждается.', 'Do we use only 10% of our brain?', 'No. Different regions do different jobs, but the idea of a dormant 90% is unsupported.', 'brain'],
  ['ulcer', 'body', 'Язва желудка возникает только от стресса?', 'Две частые причины пептической язвы — бактерия H. pylori и приём некоторых противовоспалительных лекарств.', 'Are stomach ulcers caused only by stress?', 'Two common causes of peptic ulcers are H. pylori infection and some anti-inflammatory medicines.', 'ulcers'],
  ['carrots', 'body', 'Морковь позволит видеть в темноте?', 'Витамин A нужен глазам, но дополнительные порции моркови не дают человеку сверхзрения.', 'Will carrots let you see in the dark?', 'Eyes need vitamin A, but extra carrots do not give you superhuman night vision.', 'eyes'],
  ['dog-years', 'body', 'Один собачий год всегда равен семи человеческим?', 'Нет единого множителя: собаки взрослеют особенно быстро в начале жизни, а темп старения меняется с возрастом.', 'Is one dog year always seven human years?', 'There is no fixed multiplier: dogs mature quickly early in life, and their aging rate changes over time.', 'dogs'],

  ['chilli', 'food', 'Самое жгучее в перце — семена?', 'Капсаициноиды образуются главным образом в светлых внутренних перегородках; семена могут покрыться ими при контакте.', 'Are the seeds the hottest part of a chilli?', 'Capsaicinoids are produced mainly in the pale inner tissue; nearby seeds can pick them up.', 'pepper'],
  ['banana', 'food', 'Бананы растут на дереве?', 'Банановое растение — гигантская трава. Его «ствол» составлен из плотно свёрнутых оснований листьев.', 'Do bananas grow on trees?', 'A banana plant is a giant herb. Its trunk-like pseudostem consists of tightly packed leaf bases.', 'banana'],

  ['lemmings', 'animals', 'Лемминги массово бросаются со скал?', 'Нет. Они могут расселяться и переплывать водоёмы; гибель при переправе не означает намеренного самоубийства.', 'Do lemmings leap off cliffs together?', 'No. They may disperse and cross water; drowning during a crossing is not deliberate suicide.', 'lemming'],
  ['chameleons', 'animals', 'Хамелеон меняет цвет только ради маскировки?', 'Например, хамелеон Меллера меняет цвет при стрессе и для общения с другими хамелеонами.', 'Do chameleons change color only to hide?', 'Meller’s chameleons, for example, also change color when stressed or communicating.', 'chameleon'],
  ['polar-skin', 'animals', 'У белого медведя под шерстью белая кожа?', 'Кожа белого медведя чёрная; светлым он выглядит благодаря шерсти.', 'Is a polar bear’s skin white under its fur?', 'A polar bear’s skin is black; its coat makes it look pale.', 'polar'],
  ['camel-hump', 'animals', 'В горбе верблюда хранится вода?', 'Горб верблюда содержит запас жира, который помогает пережить нехватку пищи.', 'Does a camel store water in its hump?', 'A camel’s hump stores fat, which helps it cope when food is scarce.', 'camel'],
  ['rhino-horn', 'animals', 'Рог носорога сделан из кости?', 'Главный материал рога носорога — кератин, тот же белок, из которого состоят волосы и ногти.', 'Is a rhino horn made of bone?', 'A rhino horn is made mainly of keratin, the protein found in hair and nails.', 'rhino'],
  ['ostrich', 'animals', 'Страус прячет голову в песок от опасности?', 'Страусы так не делают. Иногда птица опускает голову к земле, что издалека похоже на этот миф.', 'Does an ostrich bury its head in sand?', 'Ostriches do not do that. A bird resting its head near the ground may create the illusion.', 'ostrich'],
  ['flamingo', 'animals', 'Фламинго рождаются розовыми?', 'Розовый цвет перьев появляется благодаря каротиноидам из пищи, в том числе водорослей и мелких рачков.', 'Are flamingos born pink?', 'Pigments from their food, including algae and small crustaceans, make their feathers pink.', 'flamingo'],
  ['goldfish', 'animals', 'Память золотой рыбки длится три секунды?', 'В эксперименте золотые рыбки сохраняли выученное различение цветов даже при проверке через две недели.', 'Do goldfish remember for only three seconds?', 'In an experiment, goldfish retained a learned color distinction when tested two weeks later.', 'goldfish'],

  ['antarctica', 'earth', 'Самое сухое место непременно жаркая пустыня?', 'Антарктида тоже пустыня: её внутренние районы получают очень мало осадков.', 'Must the driest places be hot deserts?', 'Antarctica is a desert too: its interior receives very little precipitation.', 'ant'],
  ['mauna-kea', 'earth', 'Эверест — самая высокая гора при любом измерении?', 'Над уровнем моря лидирует Эверест; от подводного основания до вершины выше Мауна-Кеа.', 'Is Everest tallest by every measure?', 'Everest has the highest elevation above sea level; Mauna Kea is taller from its underwater base to its summit.', 'mountain'],
  ['richter', 'earth', 'Все землетрясения измеряют по шкале Рихтера?', 'Для крупных землетрясений обычно используют моментную магнитуду: она лучше отражает размер источника.', 'Are all earthquakes measured on the Richter scale?', 'Large earthquakes are usually described by moment magnitude, a better measure of the quake’s source.', 'quake'],
  ['drain', 'earth', 'Вода в раковине всегда закручивается по-разному в двух полушариях?', 'В обычной раковине направление вихря определяют форма слива и начальное движение воды, а не полушарие.', 'Does sink water always spin in opposite directions in the two hemispheres?', 'In an ordinary sink, the drain shape and the water’s initial motion matter more than the hemisphere.', 'drain'],
  ['raindrops', 'earth', 'Дождевые капли имеют форму слезы?', 'Маленькие капли близки к шару, а крупные сплющиваются снизу во время падения.', 'Are raindrops shaped like tears?', 'Small drops are nearly spherical; larger ones flatten underneath as they fall.', 'rain'],
  ['ocean-oxygen', 'earth', 'Большую часть кислорода производят только наземные леса?', 'Около половины производства кислорода на Земле приходится на океанический планктон и другие фотосинтезирующие организмы моря.', 'Do land forests produce nearly all oxygen?', 'Roughly half of Earth’s oxygen production comes from oceanic plankton and other marine photosynthesizers.', 'oxygen'],
  ['diamond-coal', 'earth', 'Природный алмаз — это сжатый уголь?', 'Большинство природных алмазов образуется глубоко в мантии; уголь находится в земной коре.', 'Is a natural diamond compressed coal?', 'Most natural diamonds form deep in the mantle, while coal is found in the crust.', 'diamond'],
  ['water-colour', 'earth', 'Любая вода всегда синяя?', 'Цвет водоёма зависит от глубины, взвеси, водорослей, дна и освещения; вода бывает зелёной или коричневой.', 'Is all water always blue?', 'A body of water can look green or brown depending on depth, sediment, algae, the bottom, and light.', 'water'],
  ['glass-flow', 'earth', 'Старое оконное стекло стекало вниз за века?', 'Стекло при комнатной температуре не течёт заметно; неровная толщина старых окон связана с изготовлением.', 'Did old window glass flow downward over centuries?', 'Window glass does not measurably flow at room temperature; old panes were uneven when made.', 'glass'],

  ['great-wall', 'space', 'Великую Китайскую стену видно с Луны?', 'Великую Китайскую стену нельзя различить с Луны невооружённым глазом; даже с низкой орбиты её трудно заметить.', 'Can you see the Great Wall from the Moon?', 'The Great Wall cannot be picked out by eye from the Moon and is hard to spot even from low Earth orbit.', 'wall'],
  ['eight-planets', 'space', 'В Солнечной системе девять планет?', 'По принятой классификации их восемь; Плутон относится к карликовым планетам.', 'Are there nine planets in the Solar System?', 'The accepted classification has eight planets; Pluto is a dwarf planet.', 'planets'],
  ['asteroid-belt', 'space', 'Пояс астероидов похож на плотную полосу камней?', 'Между крупными астероидами обычно огромные расстояния: пояс в основном состоит из пустого пространства.', 'Is the asteroid belt a dense obstacle course?', 'Large asteroids are usually very far apart: most of the belt is empty space.', 'belt'],
  ['day-length', 'space', 'Один оборот Земли длится ровно 24 часа?', 'Относительно звёзд Земля поворачивается примерно за 23 часа 56 минут; средние солнечные сутки — около 24 часов.', 'Does one Earth rotation take exactly 24 hours?', 'Relative to the stars, Earth rotates in about 23 hours 56 minutes; the mean solar day is about 24 hours.', 'day'],

  ['dinosaurs-and-people', 'history', 'Люди жили рядом с тираннозаврами?', 'Нептичьи динозавры исчезли примерно 66 миллионов лет назад — задолго до появления современных людей.', 'Did people live alongside Tyrannosaurus?', 'Non-bird dinosaurs vanished about 66 million years ago, long before modern humans appeared.', 'dinosaurs'],
  ['computer-bug', 'history', 'Термин «компьютерный баг» родился из-за мотылька?', 'Мотылька действительно нашли в реле компьютера в 1947 году, но слово bug для технических неисправностей существовало раньше.', 'Did a moth invent the term “computer bug”?', 'A moth was found in a computer relay in 1947, but “bug” had already been used for technical faults.', 'bug'],
  ['round-earth', 'history', 'Во времена Колумба все верили в плоскую Землю?', 'Образованные европейцы уже знали о шарообразности Земли. Колумб ошибся прежде всего в оценке расстояния до Азии.', 'Did everyone think Earth was flat in Columbus’s time?', 'Educated Europeans already knew Earth was round. Columbus mainly underestimated the distance to Asia.', 'round'],
  ['panama-hat', 'history', 'Панамы придумали в Панаме?', 'Знаменитую соломенную шляпу из токильи традиционно плетут в Эквадоре.', 'Did Panama hats originate in Panama?', 'The famous toquilla straw hat is traditionally woven in Ecuador.', 'hat'],
];

export const generalIgnoranceEntries: GeneralIgnoranceEntry[] = rows.map(([id, category, mythRu, factRu, mythEn, factEn, source]) => ({
  id, category, ru: { myth: mythRu, fact: factRu, detail: readingDetail(generalIgnoranceDetails[id]?.[0] ?? '') },
  en: { myth: mythEn, fact: factEn, detail: readingDetail(generalIgnoranceDetails[id]?.[1] ?? '') },
  source: sources[source][0], sourceUrl: sources[source][1],
}));
