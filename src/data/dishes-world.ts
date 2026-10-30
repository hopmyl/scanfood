/**
 * Мировая коллекция: индекс 300+ блюд 9 кухонь.
 * Средиземноморская, тайская, китайская, американская, японская,
 * мексиканская, индийская, итальянская, корейская.
 */
import type { Dish } from './dishes';
import { DISHES_WORLD_MED_A } from './dishes-world-med-a';
import { DISHES_WORLD_MED_B } from './dishes-world-med-b';
import { DISHES_WORLD_THAI_A } from './dishes-world-thai-a';
import { DISHES_WORLD_THAI_B } from './dishes-world-thai-b';
import { DISHES_WORLD_CHN_A } from './dishes-world-chinese-a';
import { DISHES_WORLD_CHN_B } from './dishes-world-chinese-b';
import { DISHES_WORLD_USA_A } from './dishes-world-usa-a';
import { DISHES_WORLD_USA_B } from './dishes-world-usa-b';
import { DISHES_WORLD_JPN_A } from './dishes-world-jpn-a';
import { DISHES_WORLD_JPN_B } from './dishes-world-jpn-b';
import { DISHES_WORLD_MEX_A } from './dishes-world-mex-a';
import { DISHES_WORLD_MEX_B } from './dishes-world-mex-b';
import { DISHES_WORLD_IND_A } from './dishes-world-ind-a';
import { DISHES_WORLD_IND_B } from './dishes-world-ind-b';
import { DISHES_WORLD_ITA_A } from './dishes-world-ita-a';
import { DISHES_WORLD_ITA_B } from './dishes-world-ita-b';
import { DISHES_WORLD_KOR } from './dishes-world-kor';

export const DISHES_WORLD: Dish[] = [
  ...DISHES_WORLD_MED_A,
  ...DISHES_WORLD_MED_B,
  ...DISHES_WORLD_THAI_A,
  ...DISHES_WORLD_THAI_B,
  ...DISHES_WORLD_CHN_A,
  ...DISHES_WORLD_CHN_B,
  ...DISHES_WORLD_USA_A,
  ...DISHES_WORLD_USA_B,
  ...DISHES_WORLD_JPN_A,
  ...DISHES_WORLD_JPN_B,
  ...DISHES_WORLD_MEX_A,
  ...DISHES_WORLD_MEX_B,
  ...DISHES_WORLD_IND_A,
  ...DISHES_WORLD_IND_B,
  ...DISHES_WORLD_ITA_A,
  ...DISHES_WORLD_ITA_B,
  ...DISHES_WORLD_KOR,
];

/** Кухни мира: id новых блюд, попавших в авторскую PRO-коллекцию (~40%) */
export const WORLD_PRO_IDS: readonly string[] = [
  // Средиземноморская
  'greek-moussaka', 'spanakopita', 'paella-seafood', 'chicken-souvlaki',
  'imam-bayildi', 'turkish-pide', 'kibbeh', 'chicken-tagine', 'lahmacun',
  'pissaladiere', 'dolma-grape-leaves', 'baba-ganoush',
  // Тайская
  'pad-thai-shrimp', 'green-curry-chicken', 'tom-kha-gai', 'som-tam',
  'massaman-beef', 'chicken-satay', 'khao-soi', 'pla-neung-manao',
  'yam-nuea', 'tod-mun-pla', 'larb-chicken', 'son-in-law-eggs',
  'moo-yang', 'gaeng-som-veg',
  // Китайская
  'hong-shao-rou', 'mapo-tofu', 'kung-pao-chicken', 'jiaozi-pork',
  'dan-dan-noodles', 'shui-zhu-beef', 'baozi-steamed-buns',
  'yu-xiang-eggplant', 'cumin-lamb', 'qing-zheng-fish', 'char-siu-pork',
  'twice-cooked-pork', 'general-tso-chicken', 'scallion-pancakes',
  // Американская
  'philly-cheesesteak', 'eggs-benedict', 'bbq-pulled-pork',
  'southern-fried-chicken', 'apple-pie', 'clam-chowder', 'jambalaya',
  'chicken-pot-pie', 'key-lime-pie', 'cinnamon-rolls', 'mac-and-cheese',
  'meatloaf', 'chicago-hot-dog', 'carrot-cake',
  // Японская
  'oyakodon', 'katsu-curry', 'yakitori', 'okonomiyaki', 'tempura-shrimp',
  'gyoza-pork', 'tonkatsu', 'chawanmushi', 'nasu-dengaku', 'dashimaki',
  'japanese-cheesecake', 'menchi-katsu',
  // Мексиканская
  'tacos-al-pastor', 'enchiladas-verdes', 'chiles-rellenos', 'birria-tacos',
  'chicken-mole', 'carnitas', 'cochinita-pibil', 'tres-leches-cake',
  'flan', 'churros', 'ceviche-mexicano', 'conchas',
  // Индийская
  'chicken-biryani', 'butter-chicken', 'rogan-josh', 'palak-paneer',
  'malai-kofta', 'paneer-tikka', 'tandoori-chicken', 'gulab-jamun',
  'gajar-halwa', 'aloo-paratha', 'samosa-veg', 'goan-fish-curry',
  // Итальянская
  'lasagna-bolognese', 'saffron-risotto', 'tiramisu', 'cannoli',
  'spaghetti-vongole', 'arancini', 'pizza-quattro-formaggi', 'calzone',
  'carpaccio', 'focaccia-rosemary', 'panna-cotta', 'polpette',
  // Корейская
  'bibimbap', 'galbi-jjim', 'korean-fried-chicken', 'bulgogi-beef',
  'kimchi-jjigae', 'naengmyeon', 'yukgaejang', 'tteokbokki', 'gimbap',
];
