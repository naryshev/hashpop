import Fuse from "fuse.js";

/** Canonical listing categories used across header filters and create form. */
const LISTING_CATEGORIES: string[] = [
  // Electronics
  "Smartphones & Phones",
  "Laptops",
  "Tablets",
  "TVs & Monitors",
  "Cameras & Photography",
  "Headphones & Audio",
  "Gaming Consoles & Games",
  "Smart Home Devices",
  "Computer Parts & Accessories",
  "Drones & RC",

  // Vehicles
  "Cars & Trucks",
  "Motorcycles & Scooters",
  "Boats & Watercraft",
  "Bicycles & E-Bikes",
  "Vehicle Parts & Accessories",
  "ATVs & Off-Road",

  // Fashion
  "Men's Clothing",
  "Women's Clothing",
  "Kids' Clothing",
  "Shoes & Sneakers",
  "Watches",
  "Jewelry",
  "Bags & Luggage",
  "Sunglasses & Eyewear",
  "Hats & Headwear",
  "Accessories",

  // Home & Garden
  "Furniture",
  "Kitchen & Dining",
  "Bedding & Bath",
  "Home Décor",
  "Garden & Outdoor",
  "Tools & Hardware",
  "Appliances",
  "Lighting",

  // Collectibles & Hobbies
  "Trading Cards",
  "Coins & Currency",
  "Stamps",
  "Art & Prints",
  "Antiques & Collectibles",
  "Comics & Manga",
  "Sports Memorabilia",
  "Toys & Action Figures",

  // Media
  "Books",
  "Vinyl & Music",
  "Movies & TV",
  "Video Games",
  "Magazines & Paper Media",

  // Sports & Outdoors
  "Exercise Equipment",
  "Outdoor & Camping",
  "Fishing & Hunting",
  "Sports Equipment",
  "Cycling Gear",

  // Health & Beauty
  "Beauty & Skincare",
  "Health & Wellness",
  "Supplements & Vitamins",

  // Food & Beverages
  "Food & Groceries",
  "Beverages",
  "Coffee & Tea",

  // Digital & Software
  "Software",
  "Digital Downloads",
  "Access Codes & Gift Cards",
  "NFTs & Digital Art",

  // Precious & Luxury
  "Gold & Silver",
  "Precious Gems & Metals",
  "Luxury Goods",

  // Other
  "Musical Instruments",
  "Baby & Kids Gear",
  "Pet Supplies",
  "Office Supplies",
  "Industrial & Business",
  "Other",
];

const CATEGORY_ALIASES: Record<string, string> = {
  // Smartphones & Phones
  phone: "Smartphones & Phones",
  phones: "Smartphones & Phones",
  smartphone: "Smartphones & Phones",
  smartphones: "Smartphones & Phones",
  iphone: "Smartphones & Phones",
  android: "Smartphones & Phones",
  mobile: "Smartphones & Phones",

  // Laptops
  laptop: "Laptops",
  laptops: "Laptops",
  notebook: "Laptops",
  macbook: "Laptops",
  computer: "Laptops",
  computers: "Laptops",
  pc: "Laptops",

  // Tablets
  tablet: "Tablets",
  tablets: "Tablets",
  ipad: "Tablets",

  // TVs & Monitors
  tv: "TVs & Monitors",
  tvs: "TVs & Monitors",
  television: "TVs & Monitors",
  monitor: "TVs & Monitors",
  monitors: "TVs & Monitors",
  display: "TVs & Monitors",

  // Cameras
  camera: "Cameras & Photography",
  cameras: "Cameras & Photography",
  photography: "Cameras & Photography",

  // Headphones & Audio
  headphone: "Headphones & Audio",
  headphones: "Headphones & Audio",
  earbuds: "Headphones & Audio",
  speaker: "Headphones & Audio",
  speakers: "Headphones & Audio",
  audio: "Headphones & Audio",

  // Gaming
  gaming: "Gaming Consoles & Games",
  console: "Gaming Consoles & Games",
  consoles: "Gaming Consoles & Games",
  playstation: "Gaming Consoles & Games",
  xbox: "Gaming Consoles & Games",
  nintendo: "Gaming Consoles & Games",

  // Smart Home
  "smart home": "Smart Home Devices",
  smarthome: "Smart Home Devices",

  // Drones
  drone: "Drones & RC",
  drones: "Drones & RC",
  rc: "Drones & RC",

  // Cars & Trucks
  car: "Cars & Trucks",
  cars: "Cars & Trucks",
  truck: "Cars & Trucks",
  trucks: "Cars & Trucks",
  vehicle: "Cars & Trucks",
  vehicles: "Cars & Trucks",
  auto: "Cars & Trucks",
  automobile: "Cars & Trucks",
  suv: "Cars & Trucks",
  sedan: "Cars & Trucks",
  coupe: "Cars & Trucks",
  tesla: "Cars & Trucks",

  // Motorcycles
  motorcycle: "Motorcycles & Scooters",
  motorcycles: "Motorcycles & Scooters",
  scooter: "Motorcycles & Scooters",
  moped: "Motorcycles & Scooters",

  // Boats
  boat: "Boats & Watercraft",
  boats: "Boats & Watercraft",

  // Bicycles
  bicycle: "Bicycles & E-Bikes",
  bicycles: "Bicycles & E-Bikes",
  bike: "Bicycles & E-Bikes",
  bikes: "Bicycles & E-Bikes",
  ebike: "Bicycles & E-Bikes",
  "e-bike": "Bicycles & E-Bikes",

  // ATVs
  atv: "ATVs & Off-Road",
  offroad: "ATVs & Off-Road",

  // Clothing
  "men's clothing": "Men's Clothing",
  "mens clothing": "Men's Clothing",
  menswear: "Men's Clothing",
  "women's clothing": "Women's Clothing",
  "womens clothing": "Women's Clothing",
  womenswear: "Women's Clothing",
  "kids clothing": "Kids' Clothing",
  "children's clothing": "Kids' Clothing",
  clothes: "Men's Clothing",
  clothing: "Men's Clothing",
  shirt: "Men's Clothing",
  pants: "Men's Clothing",
  dress: "Women's Clothing",

  // Shoes
  shoe: "Shoes & Sneakers",
  shoes: "Shoes & Sneakers",
  sneaker: "Shoes & Sneakers",
  sneakers: "Shoes & Sneakers",
  boots: "Shoes & Sneakers",
  footwear: "Shoes & Sneakers",

  // Watches
  watch: "Watches",
  watches: "Watches",
  timepiece: "Watches",

  // Jewelry
  jewelry: "Jewelry",
  jewellery: "Jewelry",
  necklace: "Jewelry",
  ring: "Jewelry",
  bracelet: "Jewelry",

  // Bags
  bag: "Bags & Luggage",
  bags: "Bags & Luggage",
  purse: "Bags & Luggage",
  backpack: "Bags & Luggage",
  luggage: "Bags & Luggage",

  // Eyewear
  sunglasses: "Sunglasses & Eyewear",
  glasses: "Sunglasses & Eyewear",
  eyewear: "Sunglasses & Eyewear",

  // Hats
  hat: "Hats & Headwear",
  hats: "Hats & Headwear",
  cap: "Hats & Headwear",

  // Accessories
  accessory: "Accessories",
  accessories: "Accessories",

  // Furniture
  furniture: "Furniture",
  couch: "Furniture",
  sofa: "Furniture",
  desk: "Furniture",
  chair: "Furniture",

  // Kitchen
  kitchen: "Kitchen & Dining",
  dining: "Kitchen & Dining",
  cookware: "Kitchen & Dining",

  // Bedding
  bedding: "Bedding & Bath",
  mattress: "Bedding & Bath",

  // Home Décor
  decor: "Home Décor",
  "home decor": "Home Décor",

  // Garden
  garden: "Garden & Outdoor",

  // Tools
  tools: "Tools & Hardware",
  hardware: "Tools & Hardware",

  // Appliances
  appliance: "Appliances",
  appliances: "Appliances",
  refrigerator: "Appliances",
  washer: "Appliances",

  // Lighting
  lighting: "Lighting",
  lamp: "Lighting",

  // Trading Cards
  "trading card": "Trading Cards",
  "trading cards": "Trading Cards",
  pokemon: "Trading Cards",
  "magic the gathering": "Trading Cards",
  "sports card": "Trading Cards",

  // Coins
  coin: "Coins & Currency",
  coins: "Coins & Currency",
  currency: "Coins & Currency",

  // Stamps
  stamp: "Stamps",
  stamps: "Stamps",

  // Art
  art: "Art & Prints",
  print: "Art & Prints",
  prints: "Art & Prints",
  painting: "Art & Prints",

  // Antiques
  antique: "Antiques & Collectibles",
  antiques: "Antiques & Collectibles",
  collectible: "Antiques & Collectibles",
  collectibles: "Antiques & Collectibles",

  // Comics
  comic: "Comics & Manga",
  comics: "Comics & Manga",
  manga: "Comics & Manga",

  // Sports Memorabilia
  "sports memorabilia": "Sports Memorabilia",
  memorabilia: "Sports Memorabilia",
  jersey: "Sports Memorabilia",

  // Toys
  toy: "Toys & Action Figures",
  toys: "Toys & Action Figures",
  "action figure": "Toys & Action Figures",
  lego: "Toys & Action Figures",

  // Books
  book: "Books",
  books: "Books",
  textbook: "Books",

  // Music
  vinyl: "Vinyl & Music",
  record: "Vinyl & Music",
  records: "Vinyl & Music",
  cd: "Vinyl & Music",
  music: "Vinyl & Music",

  // Movies
  movie: "Movies & TV",
  movies: "Movies & TV",
  dvd: "Movies & TV",
  "blu-ray": "Movies & TV",
  bluray: "Movies & TV",

  // Video Games
  "video game": "Video Games",
  "video games": "Video Games",
  games: "Video Games",

  // Paper Media
  magazine: "Magazines & Paper Media",
  "paper media": "Magazines & Paper Media",

  // Exercise
  "exercise equipment": "Exercise Equipment",
  gym: "Exercise Equipment",
  treadmill: "Exercise Equipment",
  weights: "Exercise Equipment",

  // Camping
  camping: "Outdoor & Camping",
  hiking: "Outdoor & Camping",
  outdoor: "Outdoor & Camping",

  // Fishing
  fishing: "Fishing & Hunting",
  hunting: "Fishing & Hunting",

  // Sports
  "sports equipment": "Sports Equipment",
  cycling: "Cycling Gear",

  // Health & Beauty
  beauty: "Beauty & Skincare",
  skincare: "Beauty & Skincare",
  makeup: "Beauty & Skincare",
  cosmetics: "Beauty & Skincare",
  health: "Health & Wellness",
  wellness: "Health & Wellness",
  supplement: "Supplements & Vitamins",
  supplements: "Supplements & Vitamins",
  vitamins: "Supplements & Vitamins",

  // Food
  food: "Food & Groceries",
  groceries: "Food & Groceries",
  "food products": "Food & Groceries",
  "food product": "Food & Groceries",
  beverage: "Beverages",
  beverages: "Beverages",
  drinks: "Beverages",
  coffee: "Coffee & Tea",
  tea: "Coffee & Tea",

  // Software & Digital
  software: "Software",
  app: "Software",
  digital: "Digital Downloads",
  "digital goods": "Digital Downloads",
  "digital good": "Digital Downloads",
  download: "Digital Downloads",
  "access code": "Access Codes & Gift Cards",
  "access codes": "Access Codes & Gift Cards",
  "gift card": "Access Codes & Gift Cards",
  "gift cards": "Access Codes & Gift Cards",
  nft: "NFTs & Digital Art",
  nfts: "NFTs & Digital Art",
  "digital art": "NFTs & Digital Art",
  crypto: "NFTs & Digital Art",

  // Precious
  gold: "Gold & Silver",
  silver: "Gold & Silver",
  "precious metal": "Precious Gems & Metals",
  "precious metals": "Precious Gems & Metals",
  gem: "Precious Gems & Metals",
  gems: "Precious Gems & Metals",
  diamond: "Precious Gems & Metals",
  luxury: "Luxury Goods",

  // Other
  instrument: "Musical Instruments",
  instruments: "Musical Instruments",
  guitar: "Musical Instruments",
  piano: "Musical Instruments",
  baby: "Baby & Kids Gear",
  infant: "Baby & Kids Gear",
  pet: "Pet Supplies",
  pets: "Pet Supplies",
  dog: "Pet Supplies",
  cat: "Pet Supplies",
  office: "Office Supplies",
  industrial: "Industrial & Business",
  other: "Other",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function canonicalizeCategory(input: string | null | undefined): string {
  if (!input) return "";
  const key = normalizeKey(input);
  return CATEGORY_ALIASES[key] ?? input.trim();
}

/** Fuzzy filter categories by query (case-insensitive). */
export function searchCategories(query: string, limit = 50): string[] {
  const q = query.trim();
  if (!q) return LISTING_CATEGORIES.slice(0, limit);
  const direct = LISTING_CATEGORIES.filter((cat) => cat.toLowerCase().includes(q.toLowerCase()));
  const fuse = new Fuse(LISTING_CATEGORIES, { threshold: 0.3, ignoreLocation: true });
  const fuzzy = fuse.search(q).map((r) => r.item);
  return Array.from(new Set([...direct, ...fuzzy])).slice(0, limit);
}
