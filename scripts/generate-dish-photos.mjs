// Генерация 100 AI-фото блюд для СканРецепт — фотореалистичный стиль v3.
// Использует z-ai-web-dev-sdk (только бэкенд). Результат: public/dishes/<id>.jpg
// Запуск: node scripts/generate-dish-photos.mjs --force (перегенерировать всё)
// Прогресс пишется в scripts/regen-progress.txt — после таймаута просто
// перезапусти ту же команду: готовое не тронется.
import ZAI from 'z-ai-web-dev-sdk';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'public/dishes';
const TMP_DIR = 'scripts/photo-tmp';
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

/**
 * Фотореалистичный «домашний» стиль v3 — против нейронного пластика.
 * Ключи реализма: смартфонный любительский кадр, естественный свет из окна,
 * несовершенства настоящей кухни (крошки, пар, лёгкий беспорядок), явные
 * отрицания CGI/рендера. Никаких «high-end plating» и студийных слов.
 */
const REALISTIC_STYLE =
  'ultra realistic photo taken with a smartphone camera by a regular person, ' +
  'real homemade food on a simple ceramic plate on a lived-in kitchen table, ' +
  'soft natural daylight from a window, slight shadows, gentle steam rising, ' +
  'a few crumbs and natural imperfections on the table, true-to-life textures, ' +
  'colors and proportions, looks like a real snapshot from a home cooking blog, ' +
  'amateur photography, not a render, not CGI, not 3D, not illustration, ' +
  'no text, no watermark';

const DISHES = [
  ['cottage-cheese-pancakes', 'Russian syrniki: five small thick fried cottage cheese pancakes with golden crust and visible curd texture, dollop of sour cream on top, powdered sugar, fresh raspberries aside'],
  ['shakshuka', 'Shakshuka: eggs poached in tomato sauce with bell pepper in a cast iron pan, crumbled feta on top'],
  ['avocado-toast', 'Avocado toast on whole grain bread with a poached egg on top, chili flakes'],
  ['oatmeal-bowl', 'Oatmeal porridge bowl topped with sliced banana, apple, walnuts and honey drizzle'],
  ['cheese-ham-omelette', 'Fluffy folded omelette with melted cheese and diced ham, fresh herbs'],
  ['tuna-sandwich', 'Tuna salad sandwich on whole wheat bread cut in half: creamy yellow tuna salad filling with lettuce and cucumber visible between slices'],
  ['greek-yogurt-granola', 'Greek yogurt in a glass bowl topped with granola, honey drizzle and berries'],
  ['spinach-cheese-pancake', 'Golden thin cheese pancake (crepe) filled with cooked spinach and melted cheese, folded'],
  ['croissant-salmon', 'Croissant sandwich with salted salmon, cream cheese and cucumber slices'],
  ['smoothie-bowl', 'Thick berry smoothie bowl topped with oat flakes, banana slices, blueberries and chia seeds in neat rows, ceramic bowl'],
  ['chicken-teriyaki', 'Chicken teriyaki glazed with shiny teriyaki sauce, sesame seeds, served with white rice'],
  ['caesar-salad', 'Caesar salad with sliced grilled chicken breast, parmesan shavings and croutons'],
  ['sweet-sour-chicken', 'Sweet and sour chicken pieces with bell peppers and pineapple in glossy sauce'],
  ['chicken-mushroom-pasta', 'Creamy pasta with chicken pieces and mushrooms in white cream sauce, parmesan'],
  ['bbq-chicken-wings', 'Baked chicken wings glazed with BBQ sauce, glossy and caramelized, sesame garnish'],
  ['chicken-noodle-soup', 'Chicken noodle soup in a bowl with carrot, herbs and shredded chicken'],
  ['grilled-chicken-broccoli', 'Grilled chicken breast with grill marks served with steamed broccoli and lemon'],
  ['chicken-tikka-masala', 'Chicken tikka masala: creamy orange curry sauce with chicken pieces, cilantro, with basmati rice'],
  ['chicken-fajitas', 'Chicken fajitas: sizzling strips of chicken with bell peppers and onions, tortillas on the side'],
  ['chicken-stir-fry', 'Chicken and vegetable stir fry in a wok: colorful vegetables, sesame seeds, glossy soy glaze'],
  ['pasta-carbonara', 'Spaghetti carbonara with crispy bacon pieces, egg yolk sauce and black pepper, parmesan'],
  ['beef-steak', 'Juicy beef ribeye steak medium rare with rosemary, garlic cloves and butter, sliced to show pink center'],
  ['soba-beef', 'Soba noodles with beef slices and vegetables, sesame seeds, chopsticks'],
  ['beef-burger', 'Classic beef burger with melted cheddar cheese, lettuce, tomato in a brioche bun'],
  ['spaghetti-bolognese', 'Spaghetti bolognese with rich meat sauce and grated parmesan, basil leaves'],
  ['bbq-pork-ribs', 'Pork ribs with glossy BBQ glaze, caramelized edges, sesame garnish'],
  ['beef-stroganoff', 'Beef stroganoff: beef strips in creamy mushroom sauce served with mashed potatoes'],
  ['pork-chops', 'Roasted pork chops with golden potato wedges and rosemary'],
  ['meatballs-tomato', 'Meatballs in rich tomato sauce in a pan, fresh basil and parsley'],
  ['beef-tacos', 'Beef tacos in corn tortillas with fresh salsa, red onion, cilantro and lime wedges'],
  ['baked-salmon-quinoa', 'Baked salmon fillet with quinoa, asparagus and lemon slice'],
  ['baked-dorado', 'Whole baked dorado fish with lemon slices, thyme and rosemary herbs'],
  ['shrimp-pasta', 'Shrimp pasta in garlic butter cream sauce with parsley and lemon zest'],
  ['sushi-set', 'Sushi rolls set assortment on dark slate board with chopsticks, soy sauce, ginger and wasabi'],
  ['poke-bowl', 'Poke bowl with cubes of fresh raw salmon over white rice, sliced avocado, edamame, sesame seeds, arranged in sections in a ceramic bowl'],
  ['fried-calamari', 'Fried calamari rings, golden crispy breading, lemon wedges and dipping sauce'],
  ['tuna-steak-sesame', 'Seared tuna steak with sesame seed crust, sliced to show pink center'],
  ['mussels-cream', 'Steamed mussels in opened dark shells in creamy white wine sauce with parsley, in a wide cooking pan, bread slices on the side'],
  ['tom-yum', 'Tom yum soup with clear reddish-orange spicy broth, large whole shrimps, mushroom halves, lemongrass stalks, lime wedge, in a deep bowl'],
  ['fish-and-chips', 'Fish and chips: golden battered fried fish fillet with thick cut fries and tartar sauce'],
  ['crispy-tofu', 'Crispy golden fried tofu cubes glazed in soy sauce with sesame seeds and green onion, served on steamed white rice in a bowl'],
  ['pumpkin-soup', 'Creamy pumpkin soup in a bowl with pumpkin seeds, cream swirl and herbs'],
  ['greek-salad', 'Greek salad with tomato, cucumber, olives, red onion and a big block of feta cheese'],
  ['margherita-pizza', 'Margherita pizza with melted mozzarella, tomato sauce and fresh basil leaves'],
  ['falafel-wrap', 'Falafel wrap in thin flatbread cut in half: crispy brown fried chickpea falafel balls with tomato, cucumber, lettuce and white tahini sauce inside'],
  ['mushroom-risotto', 'Creamy mushroom risotto with parmesan and fried mushrooms on top'],
  ['roasted-roots', 'Roasted root vegetables: carrots, beets, parsnips with thyme, caramelized edges'],
  ['caprese-salad', 'Caprese salad: alternating tomato and mozzarella slices with basil leaves, balsamic glaze'],
  ['eggplant-parmesan', 'Eggplant parmesan baked with melted cheese and tomato sauce, golden crust'],
  ['buddha-bowl', 'Buddha bowl with roasted sweet potato, chickpeas, quinoa, avocado and spinach, tahini drizzle'],
  // ==================== v3: +50 новых блюд ====================
  ['cottage-cheese-casserole', 'Cottage cheese casserole (zapekanka) cut into squares with golden crust, raisins, sour cream dollop'],
  ['milk-blini', 'Stack of thin golden Russian blini crepes rolled into triangles with lacy edges, small bowl of sour cream and berry jam aside'],
  ['kefir-pancakes', 'Russian oladi pancakes: small thick fluffy pancakes with golden brown crust and uneven rough edges, dollop of sour cream and honey drizzle on top'],
  ['lazy-vareniki', 'Lazy vareniki: boiled diamond-shaped cottage cheese dough pieces with visible curd texture in a deep bowl, melted butter, sour cream and dill on top'],
  ['chicken-plov', 'Chicken plov pilaf with fluffy rice, carrot strips, whole garlic head, served on large platter'],
  ['chicken-cutlets', 'Golden breaded chicken cutlets (kotlety) with mashed potatoes and pickles on plate'],
  ['oven-shashlik', 'Chicken shashlik skewers with charred edges, red onion rings, baked in oven on wire rack, lavash on side'],
  ['chicken-thighs-potato', 'Sheet pan roasted chicken thighs crispy skin with golden potato wedges and garlic'],
  ['beef-goulash', 'Beef goulash chunks in thick tomato gravy with mashed potatoes, paprika dusted'],
  ['lyulya-kebab', 'Lyulya kebab: two oblong minced lamb kebabs with charred crust served on flat lavash bread with sliced red onion and fresh herbs'],
  ['pelmeni', 'Homemade pelmeni dumplings in a deep ceramic bowl with dollop of sour cream, dill and melting butter piece, natural glossy broth'],
  ['pork-french', 'Pork baked French style under golden melted cheese layer with tomato slices and onion rings in a baking dish, one piece cut showing layers'],
  ['baked-mackerel', 'Whole baked mackerel fish with lemon slices in opened foil, herbs, garlic'],
  ['trout-foil', 'Baked rainbow trout steak with lemon slices and thyme in opened foil packet'],
  ['fish-cutlets', 'Fish cutlets from minced white fish: oval breaded fried cutlets with golden crust served with mashed potatoes and fresh dill'],
  ['garlic-shrimp', 'Shrimp in garlic butter sauce in cast iron pan with lemon wedges and chopped parsley, bread slices'],
  ['draniki', 'Potato draniki golden crispy pancakes stack with sour cream bowl and fresh herbs'],
  ['julienne', 'Mushroom julienne baked in small copper cocotte with golden melted cheese crust'],
  ['ratatouille', 'Ratatouille vegetables sliced in concentric circles: zucchini, eggplant, tomato with herbs in baking dish'],
  ['vegetable-stew', 'Vegetable stew with zucchini, potato, cabbage and carrot in tomato sauce in deep plate'],
  ['borscht', 'Borscht deep red beet soup in bowl with sour cream swirl, dill, garlic bread and salo on side'],
  ['shchi', 'Russian shchi cabbage soup: light golden broth with pieces of cabbage, potato, carrot and beef, swirl of sour cream and dill on top'],
  ['solyanka', 'Russian meat solyanka soup: rich dark brown broth with sliced salami and beef pieces, black olive rings, lemon slice, sour cream in a bowl'],
  ['rassolnik', 'Russian rassolnik soup: opaque pale yellowish broth with pearl barley, diced pickled cucumbers, potato cubes, chicken pieces, sour cream and dill'],
  ['mushroom-cream-soup', 'Creamy mushroom soup with croutons, mushroom slices and cream swirl, thyme sprig'],
  ['ukha', 'Russian ukha fish soup: clear light broth with chunks of salmon, potato wedges, carrot rounds, fresh dill sprig, in a traditional bowl'],
  ['pea-soup', 'Russian pea soup: thick pale yellow split pea soup with smoked pork ribs, golden croutons on top, rye bread slice on wooden board'],
  ['lentil-soup', 'Red lentil soup with carrot, lemon wedge and fresh cilantro in rustic bowl'],
  ['okroshka', 'Okroshka cold soup: pale kefir base with diced cucumber, radish, boiled egg, sausage cubes and dill in a bowl, no text'],
  ['cheese-soup', 'Creamy melted cheese soup with chicken pieces, potato and carrot in white bowl'],
  ['olivier', 'Traditional Russian Olivier salad: diced potato, carrot, pickles, green peas, egg and ham mixed with mayonnaise in a glass bowl, garnished with dill'],
  ['vinaigrette', 'Russian vinaigrette beet salad with diced vegetables in deep plate, dressed with oil'],
  ['herring-shuba', 'Herring under fur coat salad: layered salad cut in a clean square slice showing distinct layers of herring, potato, carrot and bright beet top'],
  ['mimosa', 'Mimosa salad with yellow egg yolk snow on top, layered fish salad in glass bowl'],
  ['tuna-egg-salad', 'Light tuna salad with boiled egg quarters, cucumber slices and corn in bowl'],
  ['bruschetta', 'Tomato basil bruschetta on toasted baget slices, garlic, olive oil drizzle, basil leaves'],
  ['zucchini-ikra', 'Zucchini caviar spread: pale orange-brown smooth roasted zucchini spread in a small bowl, toasted bread slices beside, sprig of dill'],
  ['korean-carrot', 'Korean-style carrot salad (morkovcha) spicy shredded carrots with sesame in bowl'],
  ['crab-corn-salad', 'Crab stick salad with sweet corn, eggs and cucumber in glass bowl'],
  ['spring-cabbage-salad', 'Fresh shredded cabbage and cucumber salad with dill and boiled egg slices'],
  ['apple-charlotte', 'Apple charlotte sponge cake with caramelized apple slices on top, dusted with powdered sugar'],
  ['cabbage-pie', 'Russian cabbage pie with golden braided crust, one slice cut showing white stewed cabbage and boiled egg filling'],
  ['ny-cheesecake', 'New York cheesecake slice with glossy top, berry sauce, mint leaf on white plate'],
  ['brownies', 'Fudgy chocolate brownies stacked with walnuts, crackly top, chocolate chunks'],
  ['oat-cookies', 'Oatmeal raisin cookies golden round on cooling rack with scattered oats and raisins'],
  ['blueberry-muffins', 'Blueberry muffins with domed golden tops, berries bursting, in paper liners'],
  ['banana-bread', 'Banana bread loaf with walnut topping, one slice cut, ripe banana on side'],
  ['pepperoni-pizza', 'Pepperoni pizza with crispy curled pepperoni cups, melted mozzarella, fresh basil'],
  ['adjarian-khachapuri', 'Adjarian khachapuri boat-shaped bread with molten cheese and runny egg yolk in center, butter'],
  ['baked-apples', 'Baked apples filled with honey, walnuts and raisins, cinnamon sticks, warm cozy style'],
];

const PROGRESS_FILE = 'scripts/regen-progress.txt';

/** Сгенерировать одно фото с ретраями; прогресс — в файл, чтобы докачивать после таймаута */
async function genOne(zai, id, subject) {
  const outPath = path.join(OUT_DIR, `${id}.jpg`);
  const prompt = `${subject}, ${REALISTIC_STYLE}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await zai.images.generations.create({
        prompt,
        size: '1024x1024',
      });
      const base64 = response?.data?.[0]?.base64;
      if (!base64) throw new Error('пустой ответ API');

      const tmpPath = path.join(TMP_DIR, `${id}.png`);
      fs.writeFileSync(tmpPath, Buffer.from(base64, 'base64'));
      // Конвертация в JPG q82 — вес фото ~100-200 КБ вместо 1-2 МБ PNG
      await sharp(tmpPath).jpeg({ quality: 82, mozjpeg: true }).toFile(outPath);
      fs.unlinkSync(tmpPath);
      fs.appendFileSync(PROGRESS_FILE, `${id}\n`);
      return true;
    } catch (err) {
      const isRateLimit = String(err?.message).includes('429');
      console.error(`  попытка ${attempt} failed ${id}: ${err.message}`);
      // При 429 ждём дольше — даём API остыть
      if (attempt < 5) {
        await new Promise((r) => setTimeout(r, (isRateLimit ? 20000 : 3000) * attempt));
      }
    }
  }
  return false;
}

async function main() {
  // --force — перегенерировать все блюда (независимо от наличия файлов).
  // Без --force генерируются только отсутствующие/битые фото.
  const force = process.argv.includes('--force');
  const doneIds = new Set(
    fs.existsSync(PROGRESS_FILE)
      ? fs
          .readFileSync(PROGRESS_FILE, 'utf8')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

  const targets = DISHES.filter(([id]) => {
    if (doneIds.has(id)) return false; // уже сделано в этой серии
    const p = path.join(OUT_DIR, `${id}.jpg`);
    return force || !(fs.existsSync(p) && fs.statSync(p).size > 20000);
  });

  const jobs = Number(process.env.GEN_JOBS ?? 3);
  let index = 0;
  let okCount = 0;
  const failed = [];
  const zai = await ZAI.create();

  async function worker(wid) {
    for (;;) {
      const i = index++;
      if (i >= targets.length) break;
      const [id, subject] = targets[i];
      const ok = await genOne(zai, id, subject);
      if (ok) okCount++;
      else failed.push(id);
      console.log(`[w${wid}] ${i + 1}/${targets.length} ${ok ? 'OK' : 'FAIL'} ${id}`);
      // Пауза между изображениями — бережём rate limit
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`Целей: ${targets.length}, параллельных воркеров: ${jobs}`);
  await Promise.all(Array.from({ length: Math.min(jobs, Math.max(targets.length, 1)) }, (_, w) => worker(w)));

  console.log('=== ИТОГ ===');
  console.log(`Успешно: ${okCount} / ${targets.length}`);
  if (failed.length) {
    console.log('Провалы:', failed.join(', '));
    process.exitCode = 2; // перезапуск докачает провалы
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
