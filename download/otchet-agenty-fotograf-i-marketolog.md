# Агенты «Фотограф» и «Маркетолог» — разбор карточек СканРецепт

*Отчёт по запросу пользователя 2026-11-06; блюд в промптах: 8*

---

## 1. Что бросается в глаза (профессиональный разбор)

Все 8 присланных карточек сняты в одном постановочном ИИ-стиле: тёмный moody-фон, драматичный свет, глянцевые соусы. Каждая карточка по отдельности «нарядная», но серия выглядит синтетически. Главные общие маркеры нейрослопа:

1. **Восковой/пластиковый глянец** — соусы и хлеб блистают как пластик (корень — фраза "glossy natural sauces" в промпте генератора).
2. **«Ковровые» текстуры** — фарш, начинка, панировка как ровный ковёр из одинаковых гранул, без структуры рубленого мяса.
3. **Копии одного элемента** — фалафели: три почти идентичных шара; идеально повторяющиеся ломтики.
4. **Moody-клише** — чёрный фон + драматичные тени + фальшивое боке-«реквизит» на заднем плане.
5. **Несоответствие блюду** — «Пиде — турецкая ЛОДОЧКА» снята как круглый закрытый пирог (auth 2/10) — худшая карточка серии.
6. **Несоответствие составу** — «Синнабоны с глазурью» без глазури; тунцовый салат выглядит как тёртое мясо без соуса.

## 2. Вердикты агента-фотографа

| Блюдо | Вердикт | Средняя | Слоп | Соотв. | Заключение фотографа |
|---|---|---|---|---|---|
| **Сэндвич с тунцом на зерновом хлебе** | REGEN | 5.7/10 | 4/10 | 5/10 | Начинка выглядит как восковой «ковёр» из одинаковых волокон без признаков йогуртового соуса, салат — пластикоподобный, хлеб нечитаем как зерновой. Свет и композиция в целом ок, но  |
| **Классический бургер с говядиной** | REGEN | 4.9/10 | 3/10 | 5/10 | Классическая ИИ-подделка еды: фарш как гладкий пластиковый ковёр, майонез восковой, цвета кислотно перенасыщены. Нет маринованного огурца из состава, а композиция — штампованное «m |
| **Ролл с фалафелем и овощами** | REGEN | 6/10 | 4/10 | 7/10 | Кадр узнаваем как ролл с фалафелем, но фалафели — три почти идеальных копии одного шара с одинаковой ковровой крошкой, соус имеет восковой пластмассовый глянец, а лепёшка с внутрен |
| **Домашние куриные котлеты** | REGEN | 4.7/10 | 3/10 | 4/10 | Панировка выглядит как однородный ИИ-«ковёр» крошки без реальной структуры рубленого фарша, соус имеет восковой пластиковый глянец, а спаржа уложена как идеально повторяющиеся брус |
| **Пиде — турецкая лодочка с фаршем** | REGEN | 5.3/10 | 3/10 | 2/10 | Это не пиде: вместо лодочки с открытыми «бортиками-хвостиками» снят круглый закрытый пирог с ровным ковром фарша, что убивает аутентичность блюда. Текстуры начинки генеративно-одно |
| **Филли чизстейк** | REGEN | 5/10 | 3/10 | 5/10 | Фото выглядит сгенерированным: сыр имеет восковой не плавящийся блеск, говядина — однородная искусственная «волокнистая» текстура, горошки перца выложены подозрительно ровной диаго |
| **Слоппи джо** | REGEN | 4.6/10 | 2/10 | 6/10 | Классический нейрослоп: восковой глянец на соусе, фарш-«ковёр» из одинаковых гранул, парящая булочка и вилка без тени. Блюдо угадывается, но фото выглядит как генерация, а не съёмк |
| **Синнабоны с глазурью** | REGEN | 6.7/10 | 4/10 | 7/10 | Булочка выглядит восковой: глазурь имеет характерный ИИ-глянец без жирных разводов, спираль подозрительно идеально закручена и не соответствует рыхлой боковине. Свет и композиция д |

**Оценочные оси** (0-10): свет, композиция, стайлинг, текстуры, соответствие блюду, аппетитность, чистота от слопа, бренд-стиль. Правила вердикта: соответствие блюду <=4 или слоп <=4 -> REGEN (только перегенерация); 8+ по средним и слопу -> GOOD; иначе RETOUCH.

**Найденные маркеры слопа по блюдам:**

- **Сэндвич с тунцом на зерновом хлебе**: восковой/пластиковый глянец на хлебе, фарш как ровный ковёр, слишком правильные повторяющиеся элементы, бессмысленное боке на фоне, несоответствие составу (крупные салатные листья и обилие начинки для тунца с йогуртом), пластиковая текстура салата
- **Классический бургер с говядиной**: пластиковый/восковой глянец поверхностей и соусов (майонез как глянцевая паста), перенасыщенные «кислотные» цвета (неоновая зелень салата, кислотно-оранжевый чеддер), «ковровые» текстуры (фарш как однородный ровный ковёр без волокон и неровностей), слишком правильные повторяющиеся элементы (французские волны салата как гребни, идеальная волна соуса), постановочное драматичное освещение-клише (moody dark + тёплые блики), фальшивый реквизит и фон (размытые миски и томат-декорация)
- **Ролл с фалафелем и овощами**: восковой глянец на тахини-соусе, повторяющиеся одинаковые шары фалафеля, однородная ковровая текстура корки фалафеля, постановочный moody-свет с клише-бликами
- **Домашние куриные котлеты**: ковровая текстура панировки — однородный «ковёр» крошки без неровностей и реальной структуры фарша, восковой глянец соуса — подливка блестит как карамельный пластик, растеклась неестественно плоским краем, слишком правильные повторяющиеся элементы — стебли спаржи уложены как одинаковые параллельные бруски, драматичное moody-освещение-клише — тёмный фон, боке-свечи, точечные тёплые блики, фальшивый фон — бессмысленное тёплое боке с свечами и солью/перцем, не связанные с кадром, физически сомнительная конструкция — верхняя котлета нависает краем без опоры, положение неустойчивое
- **Пиде — турецкая лодочка с фаршем**: фарш как ровная «ковровая» текстура без объёма и отдельных кусочков, несоответствие блюду: заявлена лодочка пиде, на фото круглый пирог/пицца, с过于 гладкая, «восковая» поверхность борта без реальных неровностей муки/швов, клише moody dark с тёплым боке-фоном
- **Филли чизстейк**: восковой/пластиковый глянец сыра, повторяющиеся одинаковые элементы (горошки перца как выстроенный узор), перенасыщенные цвета, отсутствующие ингредиенты: нет лука и майонеза, куски говядины с неестественной «ковровой» волокнистой текстурой
- **Слоппи джо**: пластиковый/восковой глянец соуса — кетчуповые потёки выглядят как лак, «ковровая» текстура фарша — однородная мелкая крошка без структуры волокон и крупных кусочков, физически сомнительная конструкция — фарш нависает идеально шатром и не падает, верхняя булочка парит без опоры, повторяющиеся одинаковые «шарики» фарша на тарелке, постановочный moody-свет с клише-боком справа, фальшивый реквизит — вилка лежит нефизично, без тени, будто вклеена
- **Синнабоны с глазурью**: пластиковый/восковой глянец глазури, слишком правильная геометрия спирали

---

## 3. Анти-слоп устав агента-маркетолога

1. Тёплый естественный дневной свет из окна (soft window daylight), лёгкие тени — НЕ студийная драма и НЕ moody-чёрный фон.
2. Матовые, реальные текстуры: видны крошка, неровная корочка, неровные края, капли соуса матовые, а не зеркальные.
3. Сдержанная, «съедобная» палитра: никаких кислотных перенасыщенных цветов.
4. Реальные несовершенства — именно они продают «домашность»: крошки на столе, неровно намазанный соус, чуть съехавший лист салата.
5. Посуда и фон в стиле серии: тёмный камень/тёмное дерево допустимы, но свет мягкий и тёплый; без фальшивого боке-реквизита.
6. Запрещённые слова в промптах: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement.

## 4. Новые промпты маркетолога (по блюдам)

Готовы к использованию в генераторе при разморозке. Каждый промпт обязан показать ключевой признак блюда (ключевой признак — focusRu).

### Сэндвич с тунцом на зерновом хлебе — REGEN

**Ключевой признак:** На фото должен быть виден разрез сэндвича, где начинка выглядит естественно, с кусочками тунца и неровной текстурой йогурта.

```
PROMPT: A tuna salad sandwich on whole wheat bread, cut diagonally to show a textured filling with visible chunks of tuna mixed with Greek yogurt, a few stray cucumber slices, and a loose leaf of lettuce resting on top. On a dark stone surface, soft window light, warm and natural, casting gentle shadows. Honest textures: rough bread crumbs, uneven edges, matte ingredients.

NEGATIVE: glossy, plastic, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, uniform carpet-like filling, fake bokeh, smooth sauce, pristine leaves, even browning
```

### Классический бургер с говядиной — REGEN

**Ключевой признак:** на фото должны быть видны кольца маринованного огурца

```
PROMPT: A classic beef burger on a brioche bun, viewed from a 30-degree angle, with a slightly uneven beef patty, melted cheddar, visible tomato slices, pickled rings, and a smear of sauce on the side. Warm natural window light casts soft shadows on a dark wood table with crumbs. Matte textures, honest colors, and a slightly messy, homemade feel.

NEGATIVE: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, plastic sheen, even patty surface, neon colors, repetitive sauce wave, fake bokeh props, wax-like sauce
```

### Ролл с фалафелем и овощами — REGEN

**Ключевой признак:** на фото обязан быть виден срез ролла с неровными слоями начинки и крошащимся фалафелем.

```
PROMPT: A falafel wrap cut in half, revealing uneven layers of falafel balls with crumbly, irregularly browned crusts, fresh tomato and cucumber slices, and crisp lettuce leaves, all drizzled with matte tahini sauce, on a dark wood table in warm natural window light with soft shadows.

NEGATIVE: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, identical falafel balls, seamless wrap interior, waxy sauce sheen, fake bokeh
```

### Домашние куриные котлеты — REGEN

**Ключевой признак:** Неровная панировка с крошками и рваные края котлет

```
PROMPT: Homemade chicken cutlets on a dark wood table, 30-degree angle, warm window light casting soft shadows, visible uneven breading with crumbs, irregular edges, matte sauce with a spoon smear, a few stray crumbs nearby, authentic textures

NEGATIVE: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, uniform breading, wax sauce sheen, repetitive asparagus, dark background, fake bokeh props
```

### Пиде — турецкая лодочка с фаршем — REGEN

**Ключевой признак:** на фото обязательно должна быть форма лодочки с открытой серединой и защипами по краям

```
PROMPT: Turkish pide boat-shaped flatbread with an open center filled with minced beef, diced onion, bell peppers, and a cracked egg on top, resting on a dark wood table, warm window light, soft shadows, matte textures, visible crumb and uneven browning, 30 degree angle

NEGATIVE: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, round pizza, flat meat texture, smooth surface, dark moody bokeh background
```

### Филли чизстейк — REGEN

**Ключевой признак:** На фото виден разрез бутерброда, демонстрирующий слои говядины, сыра, перца и карамелизированного лука.

```
PROMPT: A Philly cheesesteak sandwich on a toasted bun, cut diagonally to reveal layers of thinly sliced beef, melted provolone cheese, sautéed bell peppers, and caramelized onions, resting on a dark wood table, warm natural window light, soft shadows, crumbs on the table, sauce smeared on the wrapper.

NEGATIVE: waxy cheese, plastic sheen, repetitive pepper pattern, carpet-like beef texture, oversaturated colors, no onion, no mayonnaise, glossy, perfect, flawless, hyper-detailed, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement
```

### Слоппи джо — REGEN

**Ключевой признак:** Наверх сдвинутая булочка, открывающая фарш с крупными крошками и видимыми кусочками лука.

```
PROMPT: A messy Sloppy Joe sandwich on a dark wood table, top bun pushed aside revealing ground beef with visible onion pieces and uneven texture, sauce dripping naturally, warm window light casting soft shadows, 30-degree angle, crumbs on the tablecloth.

NEGATIVE: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, plastic sheen, uniform meat granules, floating bun, fork without shadow, repetitive meatballs, fake bokeh
```

### Синнабоны с глазурью — REGEN

**Ключевой признак:** спираль с неровными витками и подтёками глазури

```
PROMPT: Homemade cinnamon rolls on a dark stone surface, spiral shape with uneven layers and a slightly flattened edge, matte cream cheese frosting with drips and cinnamon specks, visible crumbs, warm window light, soft shadows, 30° angle.

NEGATIVE: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement, plastic sheen on glaze, perfectly uniform spiral, wax-like texture
```

## 5. Предложение новых констант стиля генератора (на утверждение)

Сейчас в generate-dish-photos.mjs зашито "dark slate plate on rustic dark wooden table" + "glossy natural sauces" — источник moody-клише и пластикового глянца. Предлагаемая замена (в код НЕ вносилась — заморозка промптов, нужно ваше одобрение):

```
STYLE_A_NEW = "editorial food photography, served on a dark slate plate on a rustic dark wooden table, warm soft daylight, natural shadows, matte textures, clean and sophisticated composition, inspired by high-end culinary magazines, inviting and authentic feel, no dramatic moody lighting."

STYLE_B_NEW = "authentic food photography, real food textures: visible grains and crumb, uneven browning, natural imperfect shapes, sauces with a natural sheen, not a plastic gloss, rustic and honest presentation, focus on the ingredient's true character."

NEGATIVE_GLOBAL = "plastic sheen, artificial gloss, oversharpened, hyperrealistic, 3d render, cgi, fake, synthetic, overly perfect, clinical, sterile, moody dark lighting, dramatic shadows."
```

**Обоснование маркетолога:** Новые стили заменяют клишированный 'moody' стиль на тёплый редакционный вид и убирают 'пластиковый' глянец соусов. Глобальный negative-промпт блокирует ключевые триггеры нейрослопа, гарантируя более аутентичный и аппетитный результат.

---

## 6. Как внедрять

1. **Согласовать стиль** — одобрить (или поправить) константы из раздела 5.
2. **Разморозка промптов** — после одобрения константы вносятся в scripts/generate-dish-photos.mjs (сейчас трогать запрещено условием заморозки).
3. **Перегенерация 8 блюд** — по промптам из раздела 4 (приоритет: turkish-pide — «не то блюдо», sloppy-joes и beef-burger — сильнейший слоп).
4. **Массовый контроль** — агент фотографа прогнать по всей базе: node scripts/agents/food-photographer.mjs --all --limit=40 (докатится за несколько прогонов, отчёт накапливается в scripts/agents/photographer-report.json).
5. Худшие по слопу попадут в очередь перегенерации — тем же конвейером NATURAL v7, что уже вычистил 260 фото.
