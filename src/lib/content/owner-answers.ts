// #223: the owner's answers to docs/content/CHECKLIST.md (2026-10-18) as sentence-level text rules, per locale.
// One table for both sides: the committed seed already carries every `new` (owner-answers.test.ts), and
// scripts/seed/owner-answers.ts applies the same rules to the stored documents, so a fresh seed and the dev update agree.
import type { Locale } from '@/i18n/routing'

/**
 * `old` → `new` inside one string (a plain field, a FAQ q/a, or one Lexical text node). A `new` that contains `old`
 * extends it: skipped once `new` is there, so a re-run never appends twice. `whole`: only a string that is exactly
 * `old` (a list item); an emptied Lexical node is dropped with its list item or paragraph.
 */
export type TextRule = { locale: Locale; old: string; new: string; whole?: boolean }

// "We arrange the right specialist and deliver it complete": the owner coordinates fabric/cover, metal and concrete
// work; his own team never welds or pours. Every added sentence says so.
const byLocale = (o: Record<Locale, [string, string]>, whole?: boolean): TextRule[] =>
  (Object.entries(o) as [Locale, [string, string]][]).map(([locale, [old, next]]) => ({ locale, old, new: next, ...(whole ? { whole } : {}) }))
const append = (o: Record<Locale, [string, string]>): Record<Locale, [string, string]> =>
  Object.fromEntries(Object.entries(o).map(([l, [old, add]]) => [l, [old, `${old} ${add}`]])) as Record<Locale, [string, string]>
const remove = (o: Record<Locale, string>): Record<Locale, [string, string]> =>
  Object.fromEntries(Object.entries(o).map(([l, old]) => [l, [old, '']])) as Record<Locale, [string, string]>

export const OWNER_ANSWER_RULES: TextRule[] = [
  // 5: TR display name "Separatör"; the slug kapi-dolap-ve-seperator and the tag slug `seperator` stay (no ö: never matched).
  { locale: 'tr', old: 'Seperatör', new: 'Separatör' },
  { locale: 'tr', old: 'seperatör', new: 'separatör' },

  // 2: not offered. Merdivenler FAQ, anti-slip treads.
  ...byLocale(
    remove({
      tr: ' İstenirse basamak yüzeyine kaydırmaz detaylar eklenebilir.',
      en: ' Anti-slip details can be added to the treads if wanted.',
      ru: ' По желанию на поверхность ступеней можно добавить противоскользящие элементы.',
      de: ' Auf Wunsch lassen sich rutschhemmende Details auf den Stufen anbringen.',
      ar: ' ويمكن عند الطلب إضافة تفاصيل مانعة للانزلاق على سطح الدرجات.',
    }),
  ),
  // 2: not offered. Mobilya ve Cila list item.
  ...byLocale(
    remove({
      tr: 'Toplantı masaları ve yönetici ofisi mobilyaları',
      en: 'Meeting tables and executive office furniture',
      ru: 'Столы для переговорных и мебель для кабинетов руководителей',
      de: 'Konferenztische und Möbel für Chefbüros',
      ar: 'طاولات اجتماعات وأثاث مكاتب الإدارة',
    }),
    true,
  ),

  // 3: deck boards, both fixings depending on the job (Ahşap deck bakımı guide).
  ...byLocale({
    tr: [
      'Deck tahtaları vidayla ya da gizli klipsle tutturulduğu için kötü tahtalar tek tek sökülüp yenisiyle değiştirilebilir; bütün zemini sökmek gerekmez.',
      'Deck tahtaları vidayla ya da gizli klipsle tutturulur; biz işe göre ikisini de kullanıyoruz. İki durumda da kötü tahtalar tek tek sökülüp yenisiyle değiştirilebilir; bütün zemini sökmek gerekmez.',
    ],
    en: [
      'Deck boards are fixed with screws or hidden clips, so bad boards can be taken out and replaced one by one; there is no need to lift the whole deck.',
      'Deck boards are fixed with screws or hidden clips; we use both, depending on the job. Either way, bad boards can be taken out and replaced one by one; there is no need to lift the whole deck.',
    ],
    ru: [
      'Террасные доски крепятся саморезами или скрытыми клипсами, поэтому плохие доски можно снимать по одной и заменять новыми; разбирать весь настил не нужно.',
      'Террасные доски крепятся саморезами или скрытыми клипсами; мы используем оба способа, в зависимости от работы. В обоих случаях плохие доски можно снимать по одной и заменять новыми; разбирать весь настил не нужно.',
    ],
    de: [
      'Da Terrassendielen verschraubt oder mit verdeckten Clips befestigt sind, lassen sich schlechte Dielen einzeln ausbauen und durch neue ersetzen; der ganze Boden muss nicht abgebaut werden.',
      'Terrassendielen werden verschraubt oder mit verdeckten Clips befestigt; wir nutzen je nach Auftrag beides. In beiden Fällen lassen sich schlechte Dielen einzeln ausbauen und durch neue ersetzen; der ganze Boden muss nicht abgebaut werden.',
    ],
    ar: [
      'ولأن ألواح الديكينغ مثبتة بالبراغي أو بمشابك مخفية، يمكن فك الألواح التالفة واحدًا واحدًا واستبدالها بأخرى جديدة؛ ولا حاجة إلى فك الأرضية كلها.',
      'تُثبَّت ألواح الديكينغ بالبراغي أو بمشابك مخفية، ونستخدم الطريقتين بحسب طبيعة العمل. وفي الحالتين يمكن فك الألواح التالفة واحدًا واحدًا واستبدالها بأخرى جديدة؛ ولا حاجة إلى فك الأرضية كلها.',
    ],
  }),

  // 1: tente / clear cover / gutter on pergolas (Pergola mı kamelya mı? guide).
  ...byLocale({
    tr: [
      'Tente ya da şeffaf örtü gibi ahşap dışı parçalar ayrı malzeme ve uygulama gerektirir.',
      'Tente, şeffaf örtü ve oluk gibi ahşap dışı parçalar için uygun ustayı biz ayarlıyor, pergolayı anahtar teslim bitiriyoruz.',
    ],
    en: [
      'Non-timber parts such as awnings or clear covers need separate materials and installation.',
      'For non-timber parts such as awnings, clear covers and gutters, we bring in the right specialist and hand the pergola over complete.',
    ],
    ru: [
      'Недеревянные элементы, например тент или прозрачное покрытие, требуют отдельных материалов и монтажа.',
      'Для недеревянных элементов, например тента, прозрачного покрытия или водостока, мы сами привлекаем нужного мастера и сдаём перголу под ключ.',
    ],
    de: [
      'Teile, die nicht aus Holz sind, etwa Markise oder lichtdurchlässige Abdeckung, erfordern eigenes Material und eigene Montage.',
      'Für Teile, die nicht aus Holz sind, etwa Markise, lichtdurchlässige Abdeckung oder Regenrinne, holen wir den passenden Fachbetrieb dazu und übergeben die Pergola schlüsselfertig.',
    ],
    ar: [
      'والأجزاء غير الخشبية مثل المظلة القماشية أو الغطاء الشفاف تحتاج إلى مواد وتنفيذ منفصلين.',
      'وللأجزاء غير الخشبية مثل المظلة القماشية أو الغطاء الشفاف أو المزراب نتولى نحن ترتيب الحِرَفي المناسب ونسلّم البرجولا جاهزة بالكامل.',
    ],
  }),
  // 1: kamelya roof covering (same guide).
  ...byLocale(
    append({
      tr: ['Kamelyanın çatısı çoğu zaman ahşap kaplama üzerine örtüyle yapılır.', 'Shingle gibi çatı örtüsü için uygun ustayı biz ayarlıyor, kamelyayı anahtar teslim bitiriyoruz.'],
      en: ['a gazebo roof is often timber boarding with a covering on top.', 'We arrange the right specialist for the roof covering, such as shingles, and hand the gazebo over complete.'],
      ru: ['крышу беседки чаще всего делают из деревянного настила с покрытием.', 'Для кровельного покрытия, например гибкой черепицы, мы сами привлекаем нужного мастера и сдаём беседку под ключ.'],
      de: ['Das Dach eines Pavillons besteht meist aus einer Holzschalung mit Deckung.', 'Für die Dachdeckung, etwa mit Schindeln, holen wir den passenden Fachbetrieb dazu und übergeben den Pavillon schlüsselfertig.'],
      ar: ['يُصنع سقف الكشك في الغالب بكسوة فوق تكسية خشبية.', 'ونتولى نحن ترتيب الحِرَفي المناسب لكسوة السقف، مثل الشينغل، ونسلّم الكشك جاهزًا بالكامل.'],
    }),
  ),
  // 1: the same parts in the price guide (Pergola fiyatını ne belirler?); "priced on top" stays.
  ...byLocale(
    append({
      tr: ['Tente, şeffaf örtü ve oluk gibi ahşap dışı parçalar ayrı malzeme ve uygulama gerektirir; fiyata ayrıca eklenir.', 'Bu işler için uygun ustayı biz ayarlıyor, pergolayı anahtar teslim bitiriyoruz.'],
      en: ['Non-timber parts such as awnings, clear roofing and gutters need separate materials and installation and are priced on top.', 'We bring in the right specialist for this work and hand the pergola over complete.'],
      ru: ['Недеревянные элементы — тент, прозрачное покрытие, водосток — требуют отдельных материалов и монтажа и добавляются к цене отдельно.', 'Для этих работ мы сами привлекаем нужного мастера и сдаём перголу под ключ.'],
      de: [
        'Teile, die nicht aus Holz sind, etwa Markise, lichtdurchlässige Abdeckung und Regenrinne, erfordern eigenes Material und eigene Montage; sie kommen zum Preis hinzu.',
        'Für diese Arbeiten holen wir den passenden Fachbetrieb dazu und übergeben die Pergola schlüsselfertig.',
      ],
      ar: ['الأجزاء غير الخشبية مثل المظلة القماشية والغطاء الشفاف والمزراب تحتاج إلى مواد وتنفيذ منفصلين؛ وتُضاف إلى السعر بشكل منفصل.', 'ونتولى نحن ترتيب الحِرَفي المناسب لهذه الأعمال ونسلّم البرجولا جاهزة بالكامل.'],
    }),
  ),
  // 1: metal and mixed railings (Korkuluk: ahşap mı metal mi? guide).
  ...byLocale(
    append({
      tr: ['bu yüzden bağlantıda paslanmaz ya da galvanizli vida ve cıvata tercih edilir.', 'Metal ve karma korkuluk işlerini de üstleniyoruz: metal kısım için uygun ustayı biz ayarlıyor, korkuluğu anahtar teslim bitiriyoruz.'],
      en: ['so stainless or galvanised screws and bolts are preferred for the fixings.', 'We also take on metal and mixed railings: we bring in the right specialist for the metalwork and hand the railing over complete.'],
      ru: ['поэтому для соединений выбирают нержавеющие или оцинкованные саморезы и болты.', 'Мы берёмся и за металлические и комбинированные ограждения: для металлической части сами привлекаем нужного мастера и сдаём ограждение под ключ.'],
      de: [
        'deshalb werden für die Verbindung Schrauben und Bolzen aus Edelstahl oder verzinktem Stahl bevorzugt.',
        'Wir übernehmen auch Geländer aus Metall und gemischte Geländer: Für den Metallteil holen wir den passenden Fachbetrieb dazu und übergeben das Geländer schlüsselfertig.',
      ],
      ar: ['لذلك تُفضَّل في الوصل البراغي والمسامير الملولبة المقاومة للصدأ أو المجلفنة.', 'ونتولى أيضًا الدرابزين المعدني والمختلط: نرتّب نحن الحِرَفي المناسب للجزء المعدني ونسلّم الدرابزين جاهزًا بالكامل.'],
    }),
  ),
  // 1: thermowood (Thermowood nedir? guide: one sentence before the closing line).
  ...byLocale({
    tr: ['Alanınıza hangi ahşabın uyduğunu keşifte yeri görerek birlikte konuşuruz.', 'Thermowood ile de çalışıyoruz. Alanınıza hangi ahşabın uyduğunu keşifte yeri görerek birlikte konuşuruz.'],
    en: ['We are happy to look at your site and talk through which wood suits it.', 'We work with thermowood too. We are happy to look at your site and talk through which wood suits it.'],
    ru: [
      'Какая древесина подойдёт для вашей площадки, мы обсудим вместе на выезде, когда увидим место.',
      'Мы работаем и с термодеревом. Какая древесина подойдёт для вашей площадки, мы обсудим вместе на выезде, когда увидим место.',
    ],
    de: ['Welches Holz zu Ihrer Fläche passt, besprechen wir gemeinsam beim Vor-Ort-Termin.', 'Wir arbeiten auch mit Thermoholz. Welches Holz zu Ihrer Fläche passt, besprechen wir gemeinsam beim Vor-Ort-Termin.'],
    ar: ['ونتحدث معكم أثناء المعاينة، بعد رؤية المكان، عن الخشب الذي يناسب مساحتكم.', 'ونعمل أيضًا بالخشب المعالج حرارياً. ونتحدث معكم أثناء المعاينة، بعد رؤية المكان، عن الخشب الذي يناسب مساحتكم.'],
  }),
  // 1: thermowood (Deck ve Zeminler category, after "which wood").
  ...byLocale(
    append({
      tr: ['Hangisinin size uygun olduğunu bütçenize, alanın güneş ve su alma durumuna göre keşifte birlikte seçeriz.', 'Isıl işlem görmüş thermowood tahtalarla da çalışıyoruz.'],
      en: ['We choose together during the site visit, based on your budget and how much sun and water the area gets.', 'We also work with thermally modified (thermowood) boards.'],
      ru: ['Какой вариант подойдёт вам, мы выберем вместе на выезде — с учётом бюджета и того, сколько солнца и воды получает площадка.', 'Мы работаем и с досками из термодерева.'],
      de: ['Welches Holz zu Ihnen passt, entscheiden wir gemeinsam beim Vor-Ort-Termin, abhängig von Ihrem Budget und davon, wie viel Sonne und Wasser die Fläche abbekommt.', 'Wir arbeiten auch mit Dielen aus Thermoholz.'],
      ar: ['ونختار معكم أثناء المعاينة ما يناسبكم منهما حسب ميزانيتكم ومدى تعرض المساحة للشمس والماء.', 'ونعمل أيضًا بألواح الخشب المعالج حرارياً.'],
    }),
  ),
  // 1: garage doors (Kapı, Dolap ve Separatör, where gates are discussed).
  ...byLocale(
    append({
      tr: ['Geniş kapı kanatlarında ahşabı metal bir kasayla taşımak, kanadın zamanla sarkmasını önler.', 'Garaj kapısı da yapıyoruz; metal işçilik gereken kısımlar için uygun ustayı biz ayarlıyor, kapıyı anahtar teslim bitiriyoruz.'],
      en: ['On wide gate leaves, carrying the timber on a metal frame keeps the leaf from sagging over time.', 'We also make garage doors; for any metalwork we bring in the right specialist and hand the door over complete.'],
      ru: ['Если широкую створку ворот держит металлическая рама, со временем она не провисает.', 'Делаем и гаражные ворота: для металлической части сами привлекаем нужного мастера и сдаём ворота под ключ.'],
      de: ['Bei breiten Torflügeln verhindert ein tragender Metallrahmen, dass der Flügel mit der Zeit absackt.', 'Wir bauen auch Garagentore; für Metallarbeiten holen wir den passenden Fachbetrieb dazu und übergeben das Tor schlüsselfertig.'],
      ar: ['وفي مصاريع الأبواب العريضة يمنع حملُ الخشب على إطار معدني ترهّلَ المصراع مع الوقت.', 'ونصنع أيضًا أبواب المرائب، ونتولى ترتيب الحِرَفي المناسب للأعمال المعدنية ونسلّم الباب جاهزًا بالكامل.'],
    }),
  ),
  // 1: concrete foundation (Ahşap Ev ve Bungalov, the base step; the old open question in CHECKLIST).
  ...byLocale(
    append({
      tr: ['Ev, zemine göre hazırlanan bir temel ya da kaide üzerine oturur.', 'Beton temel için uygun ustayı biz ayarlıyoruz.'],
      en: ['The house sits on a foundation or base prepared to suit the ground.', 'We arrange the right specialist for a concrete foundation.'],
      ru: ['Дом ставится на фундамент или цоколь, подготовленный под грунт.', 'Для бетонного фундамента мы сами привлекаем нужного мастера.'],
      de: ['Das Haus steht auf einem dem Boden entsprechend vorbereiteten Fundament oder Sockel.', 'Für ein Betonfundament holen wir den passenden Fachbetrieb dazu.'],
      ar: ['يقوم البيت على أساس أو قاعدة تُجهَّز بحسب الأرض.', 'ونتولى نحن ترتيب الحِرَفي المناسب للأساس الخرساني.'],
    }),
  ),
]

/** Claims the owner said the firm does not offer (2), per locale; no stored or seeded text may contain them. */
export const REMOVED_CLAIMS: Record<Locale, RegExp[]> = {
  tr: [/kaydırmaz/i, /toplantı masa/i, /yönetici ofisi mobilya/i],
  en: [/anti-slip/i, /meeting tables/i, /executive office furniture/i],
  ru: [/противоскольз/i, /переговорн/i],
  // Project story 17 clads the walls of a "Chefbüro": real work, not the removed furniture claim.
  de: [/rutschhemm/i, /Konferenztisch/i, /Möbel für Chefbüros/i],
  ar: [/مانعة للانزلاق/, /طاولات اجتماعات/],
}

type Lexical = { type?: unknown; text?: unknown; children?: unknown }
const isEmptied = (n: unknown): boolean => {
  if (!n || typeof n !== 'object') return false
  const node = n as Lexical
  if (node.type === 'text') return node.text === ''
  return Array.isArray(node.children) && node.children.length === 0
}

/** Applies `rules` to every string in `value` (any JSON: a field, a FAQ array, a Lexical state). Pure; `hits` are rule indexes. */
export function applyTextRules<T>(value: T, rules: readonly TextRule[]): { value: T; hits: Set<number> } {
  const hits = new Set<number>()
  const str = (s: string): string =>
    rules.reduce((acc, r, i) => {
      if (r.whole ? acc !== r.old : !acc.includes(r.old)) return acc
      if (r.new.includes(r.old) && acc.includes(r.new)) return acc
      hits.add(i)
      return r.whole ? r.new : acc.split(r.old).join(r.new)
    }, s)
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return str(v)
    if (Array.isArray(v)) {
      // A node that this pass emptied (a removed list item) goes; one that was already empty stays.
      const out = v.flatMap((item) => {
        const next = walk(item)
        return next !== item && isEmptied(next) && !isEmptied(item) ? [] : [next]
      })
      return out.length === v.length && out.every((x, i) => x === v[i]) ? v : out
    }
    if (v && typeof v === 'object') {
      let changed = false
      const out = Object.fromEntries(
        Object.entries(v).map(([k, x]) => {
          const next = walk(x)
          if (next !== x) changed = true
          return [k, next]
        }),
      )
      return changed ? out : v
    }
    return v
  }
  return { value: walk(value) as T, hits }
}

/** The Lexical text of a value, node texts concatenated: finds an `old` split across formatting nodes (to fix by hand). */
export function joinedText(value: unknown): string {
  if (Array.isArray(value)) return value.map(joinedText).join('')
  if (value && typeof value === 'object') {
    const node = value as Lexical
    if (node.type === 'text' && typeof node.text === 'string') return node.text
    return Object.values(value).map(joinedText).join('\n')
  }
  return typeof value === 'string' ? `${value}\n` : ''
}
