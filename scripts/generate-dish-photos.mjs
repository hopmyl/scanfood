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
      continue;
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
