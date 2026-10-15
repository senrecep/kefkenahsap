import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { slugify } from './slug'

const value = (input: string, max?: number) => {
  const r = slugify(input, max)
  if (!Result.isSuccess(r)) throw new Error(`expected success for "${input}"`)
  return r.value
}

describe('slugify', () => {
  it('transliterates Turkish letters, including dotted/dotless i', () => {
    // Expected values written by hand from the Turkish alphabet, not from the implementation.
    expect(value('Çiçeklik ve Oturma Grubu')).toBe('ciceklik-ve-oturma-grubu')
    expect(value('Köprü ve İskele')).toBe('kopru-ve-iskele')
    expect(value('IŞIK ağaç ÜSTÜ')).toBe('isik-agac-ustu')
    expect(value('Boya, Tamir ve Bakım')).toBe('boya-tamir-ve-bakim')
  })

  it('transliterates Russian (Cyrillic) and German ß, so ru/de titles give Latin slugs', () => {
    // Hand-written from the BGN/PCGN-style table (ж zh, х kh, ц ts, щ shch, я ya; ъ/ь dropped).
    expect(value('Деревянные конструкции')).toBe('derevyannye-konstruktsii')
    expect(value('Щётка и Объём')).toBe('shchetka-i-obem')
    expect(value('Große Terrasse')).toBe('grosse-terrasse')
  })

  it('German umlauts in a de title follow German spelling (ä→ae, ö→oe, ü→ue); other locales keep ö→o', () => {
    const slug = (t: string, locale: string) => { const r = slugify(t, 80, locale); return Result.isSuccess(r) ? r.value : null }
    const de = (t: string) => slug(t, 'de')
    expect(de('Über uns')).toBe('ueber-uns')
    expect(de('Größe der Terrasse')).toBe('groesse-der-terrasse')
    expect(de('Gartenhäuser')).toBe('gartenhaeuser')
    expect(value('Köprü ve İskele')).toBe('kopru-ve-iskele')
    expect(slug('Über uns', 'en')).toBe('uber-uns')
  })

  it('transliterates Arabic letters to Latin consonants (#156), so an ar title alone still gives a live slug', () => {
    // Hand-written letter by letter (ا a, ر r, ض d, ي y, ت t, خ kh, ش sh, ب b, ة a; أ → a; short vowels are unwritten).
    expect(value('أرضيات خشبية')).toBe('ardyat-khshbya')
    // ح h, د d, ق q, ل l, ع dropped, ذ dh, ظ z, غ gh; harakat and tatweel vanish; Arabic-Indic digits become ASCII.
    expect(value('حديقة عامّة ذات ظلّ غـابة ٢٠١٤')).toBe('hdyqa-ama-dhat-zl-ghaba-2014')
    // Persian-style kaf and yeh (ک U+06A9, ی U+06CC), common in typed Arabic text: k and y, not dropped.
    expect(value('کرسی')).toBe('krsy')
  })

  it('every real ar project title gives a distinct, non-numeric Latin slug (#156: they were empty or a bare year)', () => {
    const titles = [
      'ديكينغ لشرفة وطابق الحديقة',
      'منصات ديكينغ صغيرة مرتفعة في حديقة',
      'ديكينغ حديقة صغير عند باب',
      'تراسات خشبية ودرابزين ومظلات 2014',
      'سور خشبي على طول حدود حديقة',
      'ممر مشي خشبي على حافة الماء',
      'سلم خشبي خارجي بدرابزين ذي حشوة متقاطعة 2016',
      'خزائن خشبية خارجية',
      'برغولا تراس وجدار بشرائح ومطبخ خارجي',
      'مقعد خشبي نصف دائري',
      'طاولة طعام ومقعد خشبيان',
      'خزائن مطبخ بيضاء',
      'بار مطبخ بسطح خشبي',
      'خزانة خشبية بأبواب ذات حشوات',
      'مكتب استقبال ومنطقة عمل في مكتب',
      'خزانة عرض وبوفيه بلون كريمي منقوشان',
      'مكتب بتكسية جدران من الشرائح الخشبية',
    ]
    const slugs = titles.map((t) => value(t))
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z0-9-]+$/)
      expect(s.length).toBeLessThanOrEqual(80)
      expect(s).not.toMatch(/^[0-9-]+$/)
    }
    expect(new Set(slugs).size).toBe(titles.length)
  })

  it('keeps the existing WordPress category slugs stable', () => {
    expect(value('Deck ve Zeminler')).toBe('deck-ve-zeminler')
    expect(value('Kapı, Dolap ve Seperatör')).toBe('kapi-dolap-ve-seperator')
    expect(value('Pergola ve Kamelyalar')).toBe('pergola-ve-kamelyalar')
  })

  it('collapses punctuation and whitespace and trims dashes', () => {
    expect(value('  Iroko -- Teak!!  (2019) ')).toBe('iroko-teak-2019')
  })

  it('cuts at a word boundary within the max length', () => {
    const s = value('iroko havuz kenari deck bahcesehir villa projesi', 30)
    expect(s).toBe('iroko-havuz-kenari-deck')
    expect(s.length).toBeLessThanOrEqual(30)
  })

  it('fails with Slug.Empty when nothing usable remains', () => {
    const r = slugify('  !!! ... ')
    expect(Result.isFailure(r)).toBe(true)
    if (Result.isFailure(r)) expect(r.errors[0]?.code).toBe('Slug.Empty')
  })
})
