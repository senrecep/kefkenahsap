// Draft privacy notice (KVKK aydınlatma metni) used until a published `pages` doc (slug kvkk/privacy) exists.
// Facts only from siteSettings and the actual form/infra (PLAN §10). A lawyer should review it before launch.
import { Link } from '@/i18n/navigation'
import { gaIdOf } from '@/lib/analytics'
import { isMapEmbedUrl } from '@/lib/http/safe-href'

type Controller = { name: string; address?: string; email?: string | null }
/** What this deployment really loads: GA4 (siteSettings, else env), Umami (env), the click-to-load Google map (siteSettings). */
export type Uses = { ga: boolean; umami: boolean; map: boolean }
/** One answer for the KVKK notice and the cookie policy (#156): measurement is named in both, or in neither. */
export const legalUses = (settings: { gaId?: string | null; address?: { mapEmbedUrl?: string | null } | null }): Uses => ({
  ga: Boolean(gaIdOf(settings)),
  umami: Boolean(process.env.NEXT_PUBLIC_UMAMI_SRC && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID),
  map: isMapEmbedUrl(settings.address?.mapEmbedUrl),
})

// The e-mail is its own anchor: Cloudflare Email Obfuscation rewrites a bare address inside a text node, and its
// decoder leaves split text nodes that break hydration (#147). A mailto link survives untouched.
function ControllerLine({ c }: { c: Controller }) {
  return (
    <p>
      {c.name}
      {c.address && <> — {c.address}</>}
      {c.email && (
        <>
          {c.address ? ' · ' : ' — '}
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </>
      )}
    </p>
  )
}

export function KvkkDraft({ locale, c, uses }: { locale: string; c: Controller; uses: Uses }) {
  if (locale === 'tr')
    return (
      <>
        <p>
          Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) md. 10 uyarınca, web sitemiz üzerinden bize ilettiğiniz kişisel verilerin
          nasıl işlendiğini açıklar.
        </p>
        <h2>Veri sorumlusu</h2>
        <ControllerLine c={c} />
        <h2>Hangi verileri işliyoruz?</h2>
        <ul>
          <li>Teklif formunda yazdıklarınız: ad soyad, telefon, e-posta (isteğe bağlı), hizmet, il/ilçe, mesaj ve eklediğiniz fotoğraflar.</li>
          <li>Formu gönderdiğiniz sayfa, dil ve varsa kampanya (utm) bilgisi; KVKK onayınızın kaydı.</li>
          <li>Kötüye kullanımı önlemek için IP adresiniz ve Cloudflare Turnstile güvenlik doğrulamasının sonucu.</li>
          {/* Measurement is named only where the cookie policy describes one (GA4 or Umami configured). */}
          <li>{uses.ga || uses.umami ? 'Çerezler ve ziyaret ölçümü' : 'Çerezler'} için <Link href="/cerez-politikasi">çerez politikasına</Link> bakın.</li>
        </ul>
        <h2>Ne amaçla ve hangi hukuki sebeple?</h2>
        <ul>
          <li>Talebinizi değerlendirmek, size dönüş yapmak ve teklif hazırlamak (KVKK md. 5/2-c: sözleşmenin kurulmasıyla doğrudan ilgili olması).</li>
          <li>Formu spam ve kötüye kullanıma karşı korumak (KVKK md. 5/2-f: meşru menfaat).</li>
          <li>Verilerin yurt dışındaki hizmet sağlayıcılara aktarılması (KVKK md. 5/1 ve md. 9: açık rıza; formdaki onay kutusu).</li>
        </ul>
        <h2>Kimlere aktarılıyor?</h2>
        <p>Verileriniz satılmaz ve pazarlama için paylaşılmaz. Hizmeti yürütmek için şu sağlayıcılar kullanılır; sunucuları yurt dışında olabilir:</p>
        <ul>
          <li>Cloudflare, Inc. — site trafiği, güvenlik ve Turnstile doğrulaması.</li>
          <li>Resend — yeni talep bildirim e-postasının gönderimi.</li>
          <li>Google (Gmail) — bildirim e-postalarının alındığı e-posta kutusu.</li>
          {uses.ga && <li>Google (Analytics) — ziyaret ölçümü, yalnızca çerez onayıyla.</li>}
          {uses.umami && <li>Umami — çerezsiz ve kişiyi tanımlamayan sayfa görüntüleme sayımı.</li>}
          {uses.map && <li>Google (Haritalar) — iletişim sayfasındaki harita, yalnızca &quot;Haritayı göster&quot;e tıklarsanız yüklenir.</li>}
        </ul>
        <p>Fotoğraflarınız ve mesajınız yapay zekâ servislerine gönderilmez.</p>
        <h2>Ne kadar süre saklıyoruz?</h2>
        <p>Talepler ve ekli fotoğraflar, alındıktan 2 yıl sonra otomatik olarak silinir.</p>
        <h2>Haklarınız (KVKK md. 11)</h2>
        <p>Veri sorumlusuna başvurarak:</p>
        <ul>
          <li>kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme,</li>
          <li>işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
          <li>yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
          <li>eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
          <li>KVKK md. 7 şartları çerçevesinde silinmesini veya yok edilmesini isteme,</li>
          <li>düzeltme, silme ve yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
          <li>münhasıran otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
          <li>kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <p>haklarına sahipsiniz. Başvurunuzu {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : 'e-posta'} adresine ya da yukarıdaki posta adresine iletebilirsiniz.</p>
      </>
    )
  return (
    // English is the fallback for every other locale until a translated legal page exists in the CMS.
    <div lang="en" dir="ltr" className="contents">
      <p>
        This notice explains, under Article 10 of the Turkish Personal Data Protection Law No. 6698 (KVKK), how we process the personal data you send us
        through this website.
      </p>
      <h2>Data controller</h2>
      <ControllerLine c={c} />
      <h2>What we process</h2>
      <ul>
        <li>What you enter in the quote form: name, phone, e-mail (optional), service, city/district, message and any photos you attach.</li>
        <li>The page and language you sent the form from, campaign (utm) data if present, and a record of your consent.</li>
        <li>Your IP address and the result of the Cloudflare Turnstile check, to prevent abuse.</li>
        <li>For cookies{uses.ga || uses.umami ? ' and visit measurement' : ''}, see the <Link href="/cerez-politikasi">cookie policy</Link>.</li>
      </ul>
      <h2>Purposes and legal grounds</h2>
      <ul>
        <li>To review your request, contact you and prepare a quote (KVKK Art. 5/2-c: necessary to enter into a contract).</li>
        <li>To protect the form against spam and abuse (KVKK Art. 5/2-f: legitimate interest).</li>
        <li>Transfer to service providers abroad (KVKK Art. 5/1 and Art. 9: explicit consent, given with the form checkbox).</li>
      </ul>
      <h2>Who receives the data</h2>
      <p>Your data is never sold or shared for marketing. These providers run the service; their servers may be outside Türkiye:</p>
      <ul>
        <li>Cloudflare, Inc. — site traffic, security and the Turnstile check.</li>
        <li>Resend — sending the new-request notification e-mail.</li>
        <li>Google (Gmail) — the mailbox that receives those notifications.</li>
        {uses.ga && <li>Google (Analytics) — visit measurement, only with cookie consent.</li>}
        {uses.umami && <li>Umami — cookieless page-view counts that do not identify you.</li>}
        {uses.map && <li>Google (Maps) — the map on the contact page, loaded only if you click to show it.</li>}
      </ul>
      <p>Your photos and message are not sent to AI services.</p>
      <h2>How long we keep it</h2>
      <p>Requests and their photos are deleted automatically 2 years after we receive them.</p>
      <h2>Your rights (KVKK Art. 11)</h2>
      <p>
        You may ask the data controller to tell you whether your data is processed and how, to learn the purpose and the third parties it was
        transferred to in Türkiye or abroad, to correct incomplete or wrong data, to delete or destroy it under Art. 7, to have those changes passed on
        to third parties, to object to a result against you that comes solely from automated analysis, and to claim compensation for damage caused by
        unlawful processing. Send your request to {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : 'our e-mail address'} or to the postal address
        above.
      </p>
    </div>
  )
}
