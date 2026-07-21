export interface Scale {
  l: { uk: string; en: string }
  r: { uk: string; en: string }
  category: string
}

export const SCALES: Scale[] = [
  // ── ORIGINALS (polished) ──────────────────────────────────────────────────
  { category: 'classic', l: { uk: 'геніальна ідея', en: 'brilliant idea' }, r: { uk: 'повна дурня', en: 'total nonsense' } },
  { category: 'classic', l: { uk: 'ризиковано', en: 'dangerously risky' }, r: { uk: 'нудно безпечно', en: 'boringly safe' } },
  { category: 'classic', l: { uk: 'смішно до сліз', en: 'cry-laugh funny' }, r: { uk: 'secondhand cringe', en: 'secondhand cringe' } },
  { category: 'classic', l: { uk: 'треба зараз', en: 'need it right now' }, r: { uk: 'може почекати вічно', en: 'can wait forever' } },
  { category: 'classic', l: { uk: 'переоцінено', en: 'criminally overrated' }, r: { uk: 'недооцінено', en: 'criminally underrated' } },
  { category: 'classic', l: { uk: 'я б їв це щодня', en: "I'd eat this daily" }, r: { uk: 'ніколи в житті', en: 'never in my life' } },
  { category: 'classic', l: { uk: 'data-driven рішення', en: 'data-driven decision' }, r: { uk: 'вирішили по вайбу', en: 'decided purely on vibes' } },
  { category: 'classic', l: { uk: 'релізити на 100%', en: 'ship to 100%' }, r: { uk: 'вбити фічу назавжди', en: 'kill the feature dead' } },
  { category: 'classic', l: { uk: 'топ-тір мем', en: 'top-tier meme' }, r: { uk: 'інтернет-сміття з 2012', en: 'internet trash from 2012' } },
  { category: 'classic', l: { uk: 'корпоратив мрії', en: 'dream company party' }, r: { uk: 'краще б залишився вдома', en: 'I wish I stayed home' } },

  // ── WORK & CORPORATE CHAOS ────────────────────────────────────────────────
  { category: 'work', l: { uk: 'культ хастлу', en: 'hustle-culture gospel' }, r: { uk: 'quiet quitting з посмішкою', en: 'quiet quitting with a smile' } },
  { category: 'work', l: { uk: 'LGTM за 30 секунд', en: 'LGTM in 30 seconds' }, r: { uk: '6-годинний code review', en: '6-hour code review nitpick war' } },
  { category: 'work', l: { uk: 'шип у п\'ятницю о 18:00', en: 'ship on Friday at 6pm' }, r: { uk: 'revert у понеділок о 9:01', en: 'revert Monday at 9:01am' } },
  { category: 'work', l: { uk: '10x engineer', en: '10x engineer ego' }, r: { uk: 'PM без жодного плану', en: 'PM with zero actual plan' } },
  { category: 'work', l: { uk: 'зустріч, яка могла бути Slack', en: 'meeting that couldve been a Slack' }, r: { uk: 'Slack, що міг бути зустріччю', en: 'Slack that needed to be a meeting' } },
  { category: 'work', l: { uk: 'yolo-merge у main', en: 'yolo-merge to main' }, r: { uk: 'feature flag пекло', en: 'feature flag hell, 400 conditions' } },
  { category: 'work', l: { uk: 'переписати на Rust', en: 'rewrite it in Rust' }, r: { uk: 'додати jQuery щоб пофіксити', en: 'add jQuery to patch it' } },
  { category: 'work', l: { uk: 'підвищили до tech lead', en: 'promoted to tech lead' }, r: { uk: 'gracefully managed out', en: 'gracefully managed out' } },
  { category: 'work', l: { uk: 'спринт-планінг на 3 години', en: '3-hour sprint planning' }, r: { uk: 'весь спринт за 1 день', en: 'entire sprint done in 1 day' } },
  { category: 'work', l: { uk: 'один легендарний PR на 3000 рядків', en: 'one legendary 3000-line PR' }, r: { uk: 'commit кожні 5 хвилин', en: 'micro-commit every 5 minutes' } },

  // ── RELATIONSHIPS & SOCIAL ─────────────────────────────────────────────────
  { category: 'social', l: { uk: 'голосове повідомлення без попередження', en: 'voice message out of nowhere' }, r: { uk: 'ghosting після 3 побачень', en: 'ghosting after 3 dates' } },
  { category: 'social', l: { uk: 'love bombing з першого дня', en: 'love bombing from day one' }, r: { uk: 'stonewalling на тижні', en: 'stonewalling for weeks' } },
  { category: 'social', l: { uk: 'відповідати миттєво', en: 'reply instantly every time' }, r: { uk: 'read без відповіді 3 дні', en: 'left on read for 3 days' } },
  { category: 'social', l: { uk: 'пропозиція на першому побаченні', en: 'propose on the first date' }, r: { uk: "все ще 'ми просто спілкуємось'", en: "still just talking, no labels ever" } },
  { category: 'social', l: { uk: 'прийти без попередження з їжею', en: 'show up unannounced with food' }, r: { uk: 'скасувати за 5 хв по SMS', en: 'cancel via text 5 mins before' } },
  { category: 'social', l: { uk: 'виливатись незнайомцям у LinkedIn', en: 'overshare trauma on LinkedIn' }, r: { uk: 'офлайн і гордий цим', en: 'offline and proud of it' } },
  { category: 'social', l: { uk: 'читати повідомлення партнера', en: "reading your partners messages" }, r: { uk: 'повна цифрова приватність', en: 'radical digital privacy between partners' } },

  // ── HOT TAKES & CULTURE ────────────────────────────────────────────────────
  { category: 'hottakes', l: { uk: 'ананас на піці — норм', en: 'pineapple on pizza is fine' }, r: { uk: 'пряма сирна, завжди', en: 'plain cheese pizza only, forever' } },
  { category: 'hottakes', l: { uk: 'мільярдери мають право існувати', en: 'billionaires deserve to exist' }, r: { uk: 'їжте багатих', en: 'eat the rich, no exceptions' } },
  { category: 'hottakes', l: { uk: 'AI забере всі роботи', en: 'AI will take literally every job' }, r: { uk: 'AI — просто автокорект', en: 'AI is just spicy autocomplete' } },
  { category: 'hottakes', l: { uk: 'ранкова людина', en: '5am club, no exceptions' }, r: { uk: 'функціоную лише після 2 ночі', en: 'functional only after 2am' } },
  { category: 'hottakes', l: { uk: 'remote work назавжди', en: 'remote work forever' }, r: { uk: 'тільки офіс, або нічого', en: 'in-office or I quit' } },
  { category: 'hottakes', l: { uk: 'скіп intro кожного разу', en: 'skip every intro, always' }, r: { uk: 'дивлюсь credits до кінця', en: 'watch every credit religiously' } },
  { category: 'hottakes', l: { uk: 'NFTs були геніальні', en: 'NFTs were a stroke of genius' }, r: { uk: 'NFTs — це злочин', en: 'NFTs were a crime against humanity' } },
  { category: 'hottakes', l: { uk: 'соцмережі зруйнували суспільство', en: 'social media destroyed society' }, r: { uk: 'соцмережі врятували мені життя', en: 'social media genuinely saved my life' } },
  { category: 'hottakes', l: { uk: 'карма реальна', en: 'karma is absolutely real' }, r: { uk: 'карма — дитячі казки', en: 'karma is cope for powerless people' } },
  { category: 'hottakes', l: { uk: 'тверин мати заборонено', en: 'keeping pets is wrong' }, r: { uk: 'pets > більшість людей', en: 'pets are better than most humans' } },

  // ── STARTUP & PRODUCT ──────────────────────────────────────────────────────
  { category: 'startup', l: { uk: 'рухайся швидко і ламай', en: 'move fast and break things' }, r: { uk: 'міряй двічі, ріж раз', en: 'measure twice, cut once' } },
  { category: 'startup', l: { uk: '$50M Series A без доходів', en: '$50M Series A with zero revenue' }, r: { uk: 'прибутковий з дня 1, bootstrap', en: 'profitable day one, bootstrapped' } },
  { category: 'startup', l: { uk: 'pivot в AI зараз', en: 'pivot to AI right now' }, r: { uk: 'залишайся нудним і перемагай', en: 'stay boring, keep winning' } },
  { category: 'startup', l: { uk: 'launch на Product Hunt', en: 'launch on Product Hunt' }, r: { uk: 'нікому не кажи і ітеруй', en: 'launch to nobody, iterate silently' } },
  { category: 'startup', l: { uk: 'dark patterns, що конвертують', en: 'dark patterns that convert well' }, r: { uk: 'UX настільки чіткий, що боляче', en: 'UX so clear it physically hurts' } },
  { category: 'startup', l: { uk: 'growth hack все', en: 'growth-hack absolutely everything' }, r: { uk: 'тільки сарафанне радіо', en: 'word of mouth only, no shortcuts' } },
  { category: 'startup', l: { uk: 'валідувати потім', en: 'build first, validate never' }, r: { uk: '100 розмов до першого рядка коду', en: '100 customer calls before writing code' } },

  // ── LIFESTYLE & OPINIONS ───────────────────────────────────────────────────
  { category: 'lifestyle', l: { uk: '5am клуб', en: '5am wake-up no excuses' }, r: { uk: 'сон — це особистість', en: 'sleeping in is a personality' } },
  { category: 'lifestyle', l: { uk: 'марафон без підготовки', en: 'marathon with zero training' }, r: { uk: 'місяці підготовки до 5km', en: 'months of prep for a 5k' } },
  { category: 'lifestyle', l: { uk: 'кинути все і летіти в один бік', en: 'drop everything for a one-way flight' }, r: { uk: 'тур заплановано за 18 місяців', en: 'trip planned 18 months in advance' } },
  { category: 'lifestyle', l: { uk: 'крипта замість пенсії', en: 'crypto as retirement plan' }, r: { uk: 'index funds і тиша', en: 'index funds and chill forever' } },
  { category: 'lifestyle', l: { uk: 'веган до того, як це стало мейнстрімом', en: 'vegan before it was cool' }, r: { uk: 'стейк на кожен прийом їжі', en: 'steak for every single meal' } },
  { category: 'lifestyle', l: { uk: 'терапія для всіх', en: 'therapy should be mandatory for all' }, r: { uk: 'просто ходи у спортзал', en: 'just go to the gym, stop overthinking' } },
  { category: 'lifestyle', l: { uk: 'жити тільки в місті', en: 'cities only, suburbs are death' }, r: { uk: 'тільки природа, подалі від людей', en: 'nature only, away from all people' } },

  // ── TECH & DEV ─────────────────────────────────────────────────────────────
  { category: 'tech', l: { uk: 'тёмний режим — право людини', en: 'dark mode is a human right' }, r: { uk: 'світлий режим, я не боюсь', en: 'light mode all day, I fear nothing' } },
  { category: 'tech', l: { uk: 'tabs', en: 'tabs, obviously' }, r: { uk: 'spaces', en: 'spaces, clearly' } },
  { category: 'tech', l: { uk: 'vim для всього', en: 'vim for literally everything' }, r: { uk: 'VSCode з 47 розширеннями', en: 'VSCode with 47 extensions installed' } },
  { category: 'tech', l: { uk: 'мікросервіси вирішать', en: 'microservices solve everything' }, r: { uk: 'моноліт був нормальний', en: 'the monolith was perfectly fine' } },
  { category: 'tech', l: { uk: 'TypeScript або нічого', en: 'TypeScript or I quit' }, r: { uk: 'any.ts — норм, шипуй', en: 'any.ts is fine, just ship it' } },
  { category: 'tech', l: { uk: 'пиши тести першим', en: 'write tests first, always' }, r: { uk: 'тести для тих, хто не довіряє собі', en: 'tests are for people who doubt themselves' } },
  { category: 'tech', l: { uk: 'pair programming весь день', en: 'pair programming all day long' }, r: { uk: 'навушники, не говори до мене', en: 'headphones on, do not speak to me' } },
  { category: 'tech', l: { uk: 'No-code майбутнє', en: 'no-code is the future' }, r: { uk: 'no-code — іграшки для дітей', en: 'no-code is toys for non-engineers' } },

  // ── FOOD & PERSONALITY ─────────────────────────────────────────────────────
  { category: 'food', l: { uk: 'замовити найдивнішу страву в меню', en: 'order the weirdest thing on the menu' }, r: { uk: 'та сама страва, кожен ресторан', en: 'same meal, every restaurant, forever' } },
  { category: 'food', l: { uk: 'готувати з нуля опівночі', en: 'cook from scratch at midnight' }, r: { uk: 'UberEats 3 рази на день', en: 'UberEats 3 times every single day' } },
  { category: 'food', l: { uk: 'їжа — це паливо', en: 'food is just fuel, nothing more' }, r: { uk: 'їжа — це релігія', en: 'food is sacred religion' } },
  { category: 'food', l: { uk: 'пити каву без цукру — мазохізм', en: 'black coffee is masochism' }, r: { uk: 'все інше — це не кава', en: 'anything else is not coffee' } },

  // ── ANALYTICS FLAVORED ────────────────────────────────────────────────────
  { category: 'analytics', l: { uk: 'стат. значущо', en: 'statistically significant' }, r: { uk: 'просто шум', en: 'pure statistical noise' } },
  { category: 'analytics', l: { uk: 'треба дашборд', en: 'needs a full dashboard' }, r: { uk: 'одне число — достатньо', en: 'one number is enough' } },
  { category: 'analytics', l: { uk: 'красивий графік', en: 'beautiful, insightful chart' }, r: { uk: 'pie chart з 9 секторів', en: '9-slice pie chart, labels everywhere' } },
  { category: 'analytics', l: { uk: 'роль мрії назавжди', en: 'dream job for life' }, r: { uk: 'звільнився б завтра', en: 'would quit tomorrow if I could' } },

  // ── MORALITY & POWER ──────────────────────────────────────────────────────
  { category: 'hottakes', l: { uk: 'правила існують щоб їх ламати', en: 'rules exist to be broken' }, r: { uk: 'правила рятують дурнів від себе', en: 'rules protect fools from themselves' } },
  { category: 'hottakes', l: { uk: 'непокора — це доброчесність', en: 'disobedience is a virtue' }, r: { uk: 'слухняність це мудрість', en: 'obedience is wisdom' } },
  { category: 'hottakes', l: { uk: 'публічно соромити людей — ок', en: 'public shaming is justified' }, r: { uk: 'cancel culture — це цензура', en: 'cancel culture is just censorship' } },
  { category: 'hottakes', l: { uk: 'анонімність в інтернеті — право', en: 'online anonymity is a right' }, r: { uk: 'анонімність породжує монстрів', en: 'anonymity breeds monsters online' } },
  { category: 'social',   l: { uk: 'сказати правду в обличчя', en: 'brutal honesty to their face' }, r: { uk: 'мила брехня, щоб не образити', en: 'kind lie to spare their feelings' } },
  { category: 'social',   l: { uk: 'дружба після розриву — можлива', en: 'staying friends after a breakup works' }, r: { uk: 'блокувати і забути', en: 'block, delete, never speak again' } },
  { category: 'work',     l: { uk: 'сказати боссу що він неправий', en: 'tell your boss they are wrong publicly' }, r: { uk: 'мовчати і саботувати тихо', en: 'stay quiet and silently undermine' } },
  { category: 'work',     l: { uk: 'вийти без попередження', en: 'quit with zero notice' }, r: { uk: 'відпрацювати рік зайвий зі страху', en: 'stay an extra year out of fear' } },

  // ── EXISTENCE ─────────────────────────────────────────────────────────────
  { category: 'hottakes', l: { uk: 'симуляція — ми в ній', en: 'we are definitely in a simulation' }, r: { uk: 'реальність — це все що є', en: 'reality is all there is, period' } },
  { category: 'hottakes', l: { uk: 'безсмертя — мрія', en: 'immortality would be a gift' }, r: { uk: 'безсмертя — це жах', en: 'immortality would be a curse' } },
  { category: 'hottakes', l: { uk: 'людство — помилка природи', en: 'humanity is nature\'s mistake' }, r: { uk: 'людство — вершина еволюції', en: 'humanity is evolution\'s masterpiece' } },

  // ── SELF-SABOTAGE ─────────────────────────────────────────────────────────
  { category: 'lifestyle', l: { uk: 'прокрастинація — це форма геніальності', en: 'procrastination is a form of genius' }, r: { uk: 'прокрастинація — це самознищення', en: 'procrastination is pure self-destruction' } },
  { category: 'lifestyle', l: { uk: 'overdress для будь-якої нагоди', en: 'overdress for every occasion, always' }, r: { uk: 'піжама 24/7, без вибачень', en: 'pajamas 24/7, no apologies' } },
  { category: 'lifestyle', l: { uk: 'розповідати незнайомцям свої проблеми', en: 'tell strangers your deepest problems' }, r: { uk: 'тримати все в собі роками', en: 'suppress everything for years' } },
  { category: 'social',   l: { uk: 'сваритись публічно в соцмережах', en: 'fight publicly on social media' }, r: { uk: 'мовчати і дати нагнітись', en: 'go quiet and let it fester' } },
  { category: 'social',   l: { uk: 'ніколи не вибачатись першим', en: 'never apologize first, ever' }, r: { uk: 'вибачатись навіть коли правий', en: 'apologize even when you\'re right' } },
]
