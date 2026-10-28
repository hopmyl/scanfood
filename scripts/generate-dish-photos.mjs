// Генерация 50 AI-фото блюд для СканРецепт в едином визуальном стиле.
// Использует z-ai-web-dev-sdk (только бэкенд). Результат: public/dishes/<id>.jpg
import ZAI from 'z-ai-web-dev-sdk';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'public/dishes';
const TMP_DIR = 'scripts/photo-tmp';
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// Единый стиль для всей базы — узнаваемая подача «на тёмном слейте»
const STYLE =
  'professional food photography, served on a dark slate plate on a rustic dark wooden table, ' +
  'soft natural side lighting, appetizing, high-end restaurant plating, fresh herbs garnish, ' +
  'shallow depth of field, 45-degree angle, photorealistic, high detail, high quality';

const DISHES = [
  ['cottage-cheese-pancakes', 'Cottage cheese pancakes (syrniki) with sour cream and fresh berries, a stack of small golden pancakes'],
  ['shakshuka', 'Shakshuka: eggs poached in tomato sauce with bell pepper in a cast iron pan, crumbled feta on top'],
  ['avocado-toast', 'Avocado toast on whole grain bread with a poached egg on top, chili flakes'],
  ['oatmeal-bowl', 'Oatmeal porridge bowl topped with sliced banana, apple, walnuts and honey drizzle'],
  ['cheese-ham-omelette', 'Fluffy folded omelette with melted cheese and diced ham, fresh herbs'],
  ['tuna-sandwich', 'Tuna salad sandwich on whole wheat bread, cut in half, lettuce and cucumber visible'],
  ['greek-yogurt-granola', 'Greek yogurt in a glass bowl topped with granola, honey drizzle and berries'],
  ['spinach-cheese-pancake', 'Golden thin cheese pancake (crepe) filled with cooked spinach and melted cheese, folded'],
  ['croissant-salmon', 'Croissant sandwich with salted salmon, cream cheese and cucumber slices'],
  ['smoothie-bowl', 'Berry smoothie bowl topped with chia seeds, oat flakes, banana slices and blueberries'],
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
  ['poke-bowl', 'Poke bowl with raw salmon cubes, rice, avocado, edamame, sesame seeds in sections'],
  ['fried-calamari', 'Fried calamari rings, golden crispy breading, lemon wedges and dipping sauce'],
  ['tuna-steak-sesame', 'Seared tuna steak with sesame seed crust, sliced to show pink center'],
  ['mussels-cream', 'Mussels in creamy white wine sauce in a pan, parsley, bread on side'],
  ['tom-yum', 'Tom yum soup with shrimps, mushrooms, coconut milk swirl, lemongrass, lime'],
  ['fish-and-chips', 'Fish and chips: golden battered fried fish fillet with thick cut fries and tartar sauce'],
  ['crispy-tofu', 'Crispy asian style tofu cubes glazed in soy sauce, sesame seeds, green onion, with rice'],
  ['pumpkin-soup', 'Creamy pumpkin soup in a bowl with pumpkin seeds, cream swirl and herbs'],
  ['greek-salad', 'Greek salad with tomato, cucumber, olives, red onion and a big block of feta cheese'],
  ['margherita-pizza', 'Margherita pizza with melted mozzarella, tomato sauce and fresh basil leaves'],
  ['falafel-wrap', 'Falafel wrap cut in half showing falafel balls, vegetables and tahini sauce'],
  ['mushroom-risotto', 'Creamy mushroom risotto with parmesan and fried mushrooms on top'],
  ['roasted-roots', 'Roasted root vegetables: carrots, beets, parsnips with thyme, caramelized edges'],
  ['caprese-salad', 'Caprese salad: alternating tomato and mozzarella slices with basil leaves, balsamic glaze'],
  ['eggplant-parmesan', 'Eggplant parmesan baked with melted cheese and tomato sauce, golden crust'],
  ['buddha-bowl', 'Buddha bowl with roasted sweet potato, chickpeas, quinoa, avocado and spinach, tahini drizzle'],
  // ==================== v3: +50 новых блюд ====================
  ['cottage-cheese-casserole', 'Cottage cheese casserole (zapekanka) cut into squares with golden crust, raisins, sour cream dollop'],
  ['milk-blini', 'Stack of thin golden milk crepes (blini) folded in triangles with sour cream and berry jam'],
  ['kefir-pancakes', 'Stack of fluffy small thick pancakes (oladi) with sour cream and honey drizzle on rustic plate'],
  ['lazy-vareniki', 'Lazy cottage cheese dumplings (lenivye vareniki) boiled golden diamonds with melted butter and sour cream'],
  ['chicken-plov', 'Chicken plov pilaf with fluffy rice, carrot strips, whole garlic head, served on large platter'],
  ['chicken-cutlets', 'Golden breaded chicken cutlets (kotlety) with mashed potatoes and pickles on plate'],
  ['oven-shashlik', 'Chicken shashlik skewers with charred edges, red onion rings, baked in oven on wire rack, lavash on side'],
  ['chicken-thighs-potato', 'Sheet pan roasted chicken thighs crispy skin with golden potato wedges and garlic'],
  ['beef-goulash', 'Beef goulash chunks in thick tomato gravy with mashed potatoes, paprika dusted'],
  ['lyulya-kebab', 'Lyulya kebab minced lamb skewers on lavash bread with red onion sumac salad and herbs'],
  ['pelmeni', 'Homemade pelmeni dumplings in deep bowl with sour cream, dill, black pepper, butter melting'],
  ['pork-french', 'Pork chops French style baked with melted golden cheese, tomato slices and onion, in baking dish'],
  ['baked-mackerel', 'Whole baked mackerel fish with lemon slices in opened foil, herbs, garlic'],
  ['trout-foil', 'Baked rainbow trout steak with lemon slices and thyme in opened foil packet'],
  ['fish-cutlets', 'Golden fish cutlets from pollock with mashed potatoes and fresh dill on white plate'],
  ['garlic-shrimp', 'Shrimp in garlic butter sauce in cast iron pan with lemon wedges and chopped parsley, bread slices'],
  ['draniki', 'Potato draniki golden crispy pancakes stack with sour cream bowl and fresh herbs'],
  ['julienne', 'Mushroom julienne baked in small copper cocotte with golden melted cheese crust'],
  ['ratatouille', 'Ratatouille vegetables sliced in concentric circles: zucchini, eggplant, tomato with herbs in baking dish'],
  ['vegetable-stew', 'Vegetable stew with zucchini, potato, cabbage and carrot in tomato sauce in deep plate'],
  ['borscht', 'Borscht deep red beet soup in bowl with sour cream swirl, dill, garlic bread and salo on side'],
  ['shchi', 'Fresh cabbage shchi soup in rustic bowl with sour cream, rye bread slice and green onion'],
  ['solyanka', 'Meat solyanka soup with lemon slice, black olives, sour cream in bowl, rich dark broth'],
  ['rassolnik', 'Rassolnik soup with pearl barley, pickled cucumbers and chicken, sour cream and herbs on top'],
  ['mushroom-cream-soup', 'Creamy mushroom soup with croutons, mushroom slices and cream swirl, thyme sprig'],
  ['ukha', 'Russian ukha fish soup with salmon pieces, potato, dill in traditional bowl, lemon wedge'],
  ['pea-soup', 'Yellow split pea soup with smoked pork ribs, croutons, rye bread on wooden board'],
  ['lentil-soup', 'Red lentil soup with carrot, lemon wedge and fresh cilantro in rustic bowl'],
  ['okroshka', 'Okroshka cold soup with kefir, diced vegetables, eggs and sausage in bowl, dill on top'],
  ['cheese-soup', 'Creamy melted cheese soup with chicken pieces, potato and carrot in white bowl'],
  ['olivier', 'Traditional Russian Olivier salad in glass bowl, diced vegetables with mayonnaise, garnished with egg'],
  ['vinaigrette', 'Russian vinaigrette beet salad with diced vegetables in deep plate, dressed with oil'],
  ['herring-shuba', 'Herring under fur coat salad layered with bright beet top layer, cut to show layers, on plate'],
  ['mimosa', 'Mimosa salad with yellow egg yolk snow on top, layered fish salad in glass bowl'],
  ['tuna-egg-salad', 'Light tuna salad with boiled egg quarters, cucumber slices and corn in bowl'],
  ['bruschetta', 'Tomato basil bruschetta on toasted baget slices, garlic, olive oil drizzle, basil leaves'],
  ['zucchini-ikra', 'Zucchini caviar spread (ikra) in small bowl with toasted bread slices, rustic wooden board'],
  ['korean-carrot', 'Korean-style carrot salad (morkovcha) spicy shredded carrots with sesame in bowl'],
  ['crab-corn-salad', 'Crab stick salad with sweet corn, eggs and cucumber in glass bowl'],
  ['spring-cabbage-salad', 'Fresh shredded cabbage and cucumber salad with dill and boiled egg slices'],
  ['apple-charlotte', 'Apple charlotte sponge cake with caramelized apple slices on top, dusted with powdered sugar'],
  ['cabbage-pie', 'Russian cabbage and egg pie (pirog) with golden braided crust, one slice cut showing filling'],
  ['ny-cheesecake', 'New York cheesecake slice with glossy top, berry sauce, mint leaf on white plate'],
  ['brownies', 'Fudgy chocolate brownies stacked with walnuts, crackly top, chocolate chunks'],
  ['oat-cookies', 'Oatmeal raisin cookies golden round on cooling rack with scattered oats and raisins'],
  ['blueberry-muffins', 'Blueberry muffins with domed golden tops, berries bursting, in paper liners'],
  ['banana-bread', 'Banana bread loaf with walnut topping, one slice cut, ripe banana on side'],
  ['pepperoni-pizza', 'Pepperoni pizza with crispy curled pepperoni cups, melted mozzarella, fresh basil'],
  ['adjarian-khachapuri', 'Adjarian khachapuri boat-shaped bread with molten cheese and runny egg yolk in center, butter'],
  ['baked-apples', 'Baked apples filled with honey, walnuts and raisins, cinnamon sticks, warm cozy style'],
];

async function main() {
  // Параллельная генерация: node generate-dish-photos.mjs <shard> <total>
  // Каждый воркер обрабатывает свою долю списка (шард), файлы скипаются по наличию
  const shard = Number(process.argv[2] ?? 0);
  const total = Number(process.argv[3] ?? 1);
  const zai = await ZAI.create();
  const failed = [];

  const mySlice = DISHES.filter((_, i) => i % total === shard);

    for (let i = 0; i < mySlice.length; i++) {
    const [id, subject] = mySlice[i];
    const outPath = path.join(OUT_DIR, `${id}.jpg`);

    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 20000) {
      console.log(`[шард${shard} ${i + 1}/${mySlice.length}] SKIP ${id} (уже есть)`);
      continue; // без паузы — не тратим 4с на каждый пропуск
    }

    const prompt = `${subject}, ${STYLE}`;
    let ok = false;

    for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
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
        ok = true;
        console.log(`[шард${shard} ${i + 1}/${mySlice.length}] OK ${id}`);
      } catch (err) {
        const isRateLimit = String(err?.message).includes('429');
        console.error(`[шард${shard}] попытка ${attempt} failed ${id}: ${err.message}`);
        // При 429 ждём дольше — даём API остыть
        const backoff = isRateLimit ? 20000 * attempt : 3000 * attempt;
        if (attempt < 5) await new Promise((r) => setTimeout(r, backoff));
      }
    }

    if (!ok) failed.push(id);
    // Пауза между изображениями — бережём rate limit
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log('=== ИТОГ ===');
  console.log(`Успешно: ${DISHES.length - failed.length} / ${DISHES.length}`);
  if (failed.length) console.log('Провалы:', failed.join(', '));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
