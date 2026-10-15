// Draft cookie policy used until a published `pages` doc (slug cerez-politikasi/cookies) exists. Lists what the site really sets:
// GA4, the consent cookie and the footer "Çerez tercihleri" link exist only when NEXT_PUBLIC_GA_ID is set (Analytics.tsx, Footer.tsx).
import { Link } from '@/i18n/navigation'

import type { Uses } from './kvkk'

export function CookiesDraft({ locale, name, uses }: { locale: string; name: string; uses: Uses }) {
  if (locale === 'tr')
    return (
      <>
        <p>{name} web sitesi yalnızca aşağıdaki çerezleri ve benzeri teknolojileri kullanır.</p>
        <h2>Zorunlu çerezler</h2>
        <ul>
          {uses.ga && <li><strong>kh_consent</strong> — çerez tercihinizi (kabul/ret) 6 ay saklar.</li>}
          <li><strong>NEXT_LOCALE</strong> — seçtiğiniz site dilini hatırlar.</li>
          <li>Teklif formunda Cloudflare Turnstile güvenlik doğrulaması çalışır; formu kötüye kullanıma karşı korur.</li>
        </ul>
        {uses.ga && (
          <>
            <h2>Ölçüm çerezleri (yalnızca onayınızla)</h2>
            <p>
              &quot;Kabul et&quot; derseniz Google Analytics 4 yüklenir ve <strong>_ga</strong>, <strong>_ga_*</strong> çerezleriyle ziyaretler ölçülür
              (en fazla 2 yıl). &quot;Reddet&quot; derseniz Google Analytics hiç yüklenmez.
            </p>
          </>
        )}
        {uses.umami && (
          <>
            <h2>Çerezsiz ölçüm</h2>
            <p>Umami ile sayfa görüntülemeleri çerez kullanmadan ve kişiyi tanımlamadan sayılır.</p>
          </>
        )}
        {uses.map && (
          <>
            <h2>Harita</h2>
            <p>
              İletişim sayfasındaki Google Haritalar yalnızca &quot;Haritayı göster&quot;e tıkladığınızda yüklenir; o andan itibaren Google kendi
              çerezlerini kullanabilir.
            </p>
          </>
        )}
        {uses.ga && (
          <>
            <h2>Tercihinizi değiştirmek</h2>
            <p>Sayfanın altındaki &quot;Çerez tercihleri&quot; bağlantısından seçiminizi istediğiniz zaman değiştirebilirsiniz.</p>
          </>
        )}
        <p>
          Kişisel verileriniz hakkında ayrıntılar <Link href="/kvkk">KVKK aydınlatma metninde</Link>.
        </p>
      </>
    )
  return (
    // English is the fallback for every other locale until a translated legal page exists in the CMS.
    <div lang="en" dir="ltr" className="contents">
      <p>The {name} website uses only the cookies and similar technologies listed below.</p>
      <h2>Necessary</h2>
      <ul>
        {uses.ga && <li><strong>kh_consent</strong> — stores your cookie choice (accept/reject) for 6 months.</li>}
        <li><strong>NEXT_LOCALE</strong> — remembers the site language you chose.</li>
        <li>The quote form runs a Cloudflare Turnstile check to protect it against abuse.</li>
      </ul>
      {uses.ga && (
        <>
          <h2>Measurement (only with your consent)</h2>
          <p>
            If you click &quot;Accept&quot;, Google Analytics 4 loads and measures visits with the <strong>_ga</strong> and <strong>_ga_*</strong> cookies
            (up to 2 years). If you click &quot;Reject&quot;, Google Analytics is never loaded.
          </p>
        </>
      )}
      {uses.umami && (
        <>
          <h2>Cookieless measurement</h2>
          <p>Umami counts page views without cookies and without identifying you.</p>
        </>
      )}
      {uses.map && (
        <>
          <h2>Map</h2>
          <p>The Google Maps map on the contact page loads only when you click to show it; from then on Google may use its own cookies.</p>
        </>
      )}
      {uses.ga && (
        <>
          <h2>Changing your choice</h2>
          <p>Use the &quot;Cookie preferences&quot; link at the bottom of every page at any time.</p>
        </>
      )}
      <p>
        More on your personal data in the <Link href="/kvkk">privacy notice</Link>.
      </p>
    </div>
  )
}
