/**
 * Scale catalogue — shared by the server (round generation) and the client
 * (rendering). `key` is the stable identifier kept in room state, so labels
 * can be reworded later without orphaning played rounds.
 *
 * Ported from the latest upstream game (Bezushchak/consensus-radar):
 * 26 scales across the `general` and `analytics` categories.
 */

export type Category = 'general' | 'analytics'
export type Lang = 'uk' | 'en'

export interface Scale {
  key: string
  category: Category
  l: Record<Lang, string>
  r: Record<Lang, string>
}

export const SCALES: Scale[] = [
  // ---------------- General & fun ----------------
  { key: 'risky_safe',        category: 'general', l: { uk: 'Ризиковано', en: 'Risky' },               r: { uk: 'Безпечно', en: 'Safe' } },
  { key: 'funny_cringe',      category: 'general', l: { uk: 'Смішно', en: 'Funny' },                   r: { uk: 'Крінжово', en: 'Cringe' } },
  { key: 'urgent_canwait',    category: 'general', l: { uk: 'Терміново', en: 'Urgent' },               r: { uk: 'Може почекати', en: 'Can wait' } },
  { key: 'genius_nonsense',   category: 'general', l: { uk: 'Геніально', en: 'Genius' },               r: { uk: 'Повна дурня', en: 'Total nonsense' } },
  { key: 'expensive_cheap',   category: 'general', l: { uk: 'Дуже дорого', en: 'Very expensive' },     r: { uk: 'Дуже дешево', en: 'Very cheap' } },
  { key: 'useful_useless',    category: 'general', l: { uk: 'Корисно', en: 'Useful' },                 r: { uk: 'Марно', en: 'Useless' } },
  { key: 'over_underrated',   category: 'general', l: { uk: 'Переоцінено', en: 'Overrated' },          r: { uk: 'Недооцінено', en: 'Underrated' } },
  { key: 'hot_cold',          category: 'general', l: { uk: 'Гаряче', en: 'Hot' },                     r: { uk: 'Холодне', en: 'Cold' } },
  { key: 'normal_weird',      category: 'general', l: { uk: 'Звичайне', en: 'Normal' },                r: { uk: 'Дивне', en: 'Weird' } },
  { key: 'hard_easy',         category: 'general', l: { uk: 'Складно', en: 'Hard' },                   r: { uk: 'Легко', en: 'Easy' } },
  { key: 'intro_extrovert',   category: 'general', l: { uk: 'Інтроверт', en: 'Introvert' },            r: { uk: 'Екстраверт', en: 'Extrovert' } },
  { key: 'movie_under_hyped', category: 'general', l: { uk: 'Недооцінений фільм', en: 'Underrated movie' }, r: { uk: 'Хайповий фільм', en: 'Hyped movie' } },

  // ---------------- Analytics team ----------------
  { key: 'significant_noise', category: 'analytics', l: { uk: 'Статистично значуще', en: 'Statistically significant' }, r: { uk: 'Просто шум', en: 'Just noise' } },
  { key: 'dashboard_export',  category: 'analytics', l: { uk: 'Дашборд', en: 'Dashboard' },            r: { uk: 'Ручний експорт', en: 'Manual export' } },
  { key: 'signal_noise',      category: 'analytics', l: { uk: 'Сигнал', en: 'Signal' },                r: { uk: 'Шум', en: 'Noise' } },
  { key: 'corr_causation',    category: 'analytics', l: { uk: 'Кореляція', en: 'Correlation' },        r: { uk: 'Причинність', en: 'Causation' } },
  { key: 'clean_dirty_data',  category: 'analytics', l: { uk: 'Чисті дані', en: 'Clean data' },        r: { uk: 'Брудні дані', en: 'Dirty data' } },
  { key: 'ab_test_obvious',   category: 'analytics', l: { uk: 'Варто A/B-тестити', en: 'Worth A/B testing' }, r: { uk: 'І так очевидно', en: 'Obvious already' } },
  { key: 'p005_p05',          category: 'analytics', l: { uk: 'p < 0.05', en: 'p < 0.05' },            r: { uk: 'p = 0.5', en: 'p = 0.5' } },
  { key: 'datadriven_gut',    category: 'analytics', l: { uk: 'Data-driven', en: 'Data-driven' },      r: { uk: 'На відчуттях', en: 'Gut feeling' } },
  { key: 'more_enough_data',  category: 'analytics', l: { uk: 'Треба ще даних', en: 'Need more data' }, r: { uk: 'Даних достатньо', en: 'Enough data' } },
  { key: 'real_vanity',       category: 'analytics', l: { uk: 'Справжня метрика', en: 'Real metric' }, r: { uk: 'Vanity-метрика', en: 'Vanity metric' } },
  { key: 'realtime_quarter',  category: 'analytics', l: { uk: 'Реал-тайм', en: 'Real-time' },          r: { uk: 'Раз на квартал', en: 'Once a quarter' } },
  { key: 'automate_manual',   category: 'analytics', l: { uk: 'Автоматизувати', en: 'Automate' },      r: { uk: 'Зробити руками', en: 'Do it manually' } },
  { key: 'funnel_leak_ok',    category: 'analytics', l: { uk: 'Витік у воронці', en: 'Funnel leak' },  r: { uk: 'Здорова воронка', en: 'Healthy funnel' } },
  { key: 'outlier_typical',   category: 'analytics', l: { uk: 'Викид (outlier)', en: 'Outlier' },      r: { uk: 'Типове значення', en: 'Typical value' } },
]

const BY_KEY = new Map(SCALES.map((scale) => [scale.key, scale]))

export function scaleByKey(key: string): Scale | undefined {
  return BY_KEY.get(key)
}

export function scalesForCategories(categories: readonly string[]): Scale[] {
  const wanted = new Set(categories)
  const pool = SCALES.filter((scale) => wanted.has(scale.category))
  return pool.length > 0 ? pool : SCALES
}
