// Draft cookie policy used until a published `pages` doc (slug cerez-politikasi/cookies) exists. Lists what the site really sets.
import { Link } from '@/i18n/navigation'

export function CookiesDraft({ locale, name }: { locale: string; name: string }) {
  if (locale === 'tr')
    return (
      <>
        <p>{name} web sitesi yalnızca aşağıdaki çerezleri ve benzeri teknolojileri kullanır.</p>
        <h2>Zorunlu çerezler</h2>
        <ul>
          <li><strong>kh_consent</strong> — çerez tercihinizi (kabul/ret) 6 ay saklar.</li>
          <li><strong>NEXT_LOCALE</strong> — seçtiğiniz site dilini hatırlar.</li>
          <li>Teklif formunda Cloudflare Turnstile güvenlik doğrulaması çalışır; formu kötüye kullanıma karşı korur.</li>
        </ul>
        <h2>Ölçüm çerezleri (yalnızca onayınızla)</h2>
        <p>
          &quot;Kabul et&quot; derseniz Google Analytics 4 yüklenir ve <strong>_ga</strong>, <strong>_ga_*</strong> çerezleriyle ziyaretler ölçülür
          (en fazla 2 yıl). &quot;Reddet&quot; derseniz Google Analytics hiç yüklenmez.
        </p>
        <h2>Çerezsiz ölçüm</h2>
        <p>Umami ile sayfa görüntülemeleri çerez kullanmadan ve kişiyi tanımlamadan sayılır.</p>
        <h2>Tercihinizi değiştirmek</h2>
        <p>
          Sayfanın altındaki &quot;Çerez tercihleri&quot; bağlantısından seçiminizi istediğiniz zaman değiştirebilirsiniz. Kişisel verileriniz hakkında
          ayrıntılar <Link href="/kvkk">KVKK aydınlatma metninde</Link>.
        </p>
      </>
    )
  return (
    <>
      <p>The {name} website uses only the cookies and similar technologies listed below.</p>
      <h2>Necessary</h2>
      <ul>
        <li><strong>kh_consent</strong> — stores your cookie choice (accept/reject) for 6 months.</li>
        <li><strong>NEXT_LOCALE</strong> — remembers the site language you chose.</li>
        <li>The quote form runs a Cloudflare Turnstile check to protect it against abuse.</li>
      </ul>
      <h2>Measurement (only with your consent)</h2>
      <p>
        If you click &quot;Accept&quot;, Google Analytics 4 loads and measures visits with the <strong>_ga</strong> and <strong>_ga_*</strong> cookies (up
        to 2 years). If you click &quot;Reject&quot;, Google Analytics is never loaded.
      </p>
      <h2>Cookieless measurement</h2>
      <p>Umami counts page views without cookies and without identifying you.</p>
      <h2>Changing your choice</h2>
      <p>
        Use the &quot;Cookie preferences&quot; link at the bottom of every page at any time. More on your personal data in the{' '}
        <Link href="/kvkk">privacy notice</Link>.
      </p>
    </>
  )
}
