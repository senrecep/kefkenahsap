import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "email_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"subject" varchar NOT NULL,
  	"body" jsonb NOT NULL,
  	"order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_templates_id" integer;
  CREATE UNIQUE INDEX "email_templates_name_idx" ON "email_templates" USING btree ("name");
  CREATE INDEX "email_templates_updated_at_idx" ON "email_templates" USING btree ("updated_at");
  CREATE INDEX "email_templates_created_at_idx" ON "email_templates" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_templates_fk" FOREIGN KEY ("email_templates_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_email_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("email_templates_id");`)
  await seedEmailTemplates(db)
}

// #256: the owner-approved templates, frozen here as Lexical JSON (raw SQL, not the Local API: a later schema change must
// not break this migration on a fresh database). `[...]` = filled by hand, `{ad}`/`{hizmet}` = filled from the lead.
const WA = 'https://wa.me/905322958416'
const GALERI = 'https://www.kefkenahsap.com/tr/galeri'
const REVIEW = 'https://g.page/r/CR2jWPAf5IeAEBM/review'

const textNode = (text: string, format = 0) => ({ type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 })
/** One paragraph; each argument is a line (joined by line breaks), `**x**` is bold. */
const p = (...lines: string[]) => ({
  type: 'paragraph',
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  textFormat: 0,
  textStyle: '',
  children: lines.flatMap((line, i) => [
    ...(i ? [{ type: 'linebreak', version: 1 }] : []),
    ...line
      .split(/(\*\*[^*]+\*\*)/)
      .filter(Boolean)
      .map((part) => (part.startsWith('**') ? textNode(part.slice(2, -2), 1) : textNode(part))),
  ]),
})
let buttonId = 0
const btn = (label: string, url: string, style: 'dolu' | 'cerceveli' = 'dolu') => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: `5e0d${String(++buttonId).padStart(20, '0')}`, blockName: '', blockType: 'button', label, url, style },
})
const doc = (...children: object[]) => ({
  root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children: [...children, p('İyi günler dileriz,')] },
})
const hello = p('Merhaba {ad},')

export const EMAIL_TEMPLATES = [
  {
    name: 'Teklif cevabı',
    description: 'Siteden veya e-postayla gelen ilk talebe cevap.',
    subject: 'Talebiniz hakkında — {hizmet}',
    body: doc(
      hello,
      p("Kefken Ahşap Dekorasyon'a gösterdiğiniz ilgi için teşekkür ederiz. **{hizmet}** talebinizi aldık."),
      p(
        'Size doğru bir fiyat verebilmemiz için yerinde ölçü almamız gerekiyor. Uygun olduğunuz bir gün ve saati bu e-postaya yanıt olarak ya da WhatsApp üzerinden iletebilirsiniz. Alanın birkaç fotoğrafını gönderirseniz ön bilgi de verebiliriz.',
      ),
      btn("WhatsApp'tan yazın", WA),
      btn('Yaptığımız işler', GALERI, 'cerceveli'),
    ),
  },
  {
    name: 'Keşif randevusu teyidi',
    description: 'Ölçü/keşif günü kesinleşince.',
    subject: 'Keşif randevunuz — {hizmet}',
    body: doc(
      hello,
      p('Keşif randevunuzu teyit ederiz:'),
      p('**Tarih:** [gün, tarih]', '**Saat:** [saat]', '**Adres:** [adres]'),
      p('Ölçü sırasında uygulama yapılacak alana rahat ulaşabilmemiz yeterli. Varsa aklınızdaki örnek fotoğrafları ya da malzeme tercihinizi o gün konuşabiliriz.'),
      p('Saatte bir değişiklik olursa lütfen bize haber verin.'),
      btn("WhatsApp'tan yazın", WA),
    ),
  },
  {
    name: 'Fiyat teklifi',
    description: 'Keşiften sonra teklifi gönderirken.',
    subject: 'Fiyat teklifiniz — {hizmet}',
    body: doc(
      hello,
      p('**{hizmet}** için hazırladığımız fiyat teklifi aşağıdadır.'),
      p(
        '**Kapsam:** [kısa iş tanımı, ölçüler]',
        '**Malzeme:** [malzeme]',
        '**Tutar:** [tutar, KDV durumu]',
        '**Tahmini süre:** [süre]',
        '**Teklif geçerliliği:** [tarih]',
      ),
      p('Teklifle ilgili sorularınızı ya da değiştirmek istediğiniz bir şey olursa yazmanız yeterli; birlikte netleştiririz.'),
      btn("WhatsApp'tan yazın", WA),
      btn('Yaptığımız işler', GALERI, 'cerceveli'),
    ),
  },
  {
    name: 'Teklif hatırlatma',
    description: 'Teklife birkaç gün cevap gelmediyse.',
    subject: 'Teklifimiz hakkında — {hizmet}',
    body: doc(
      hello,
      p('[tarih] tarihinde gönderdiğimiz **{hizmet}** teklifini inceleme fırsatınız oldu mu?'),
      p('Aklınıza takılan bir nokta ya da değiştirmek istediğiniz bir detay varsa memnuniyetle yardımcı oluruz. Teklifimiz [tarih] tarihine kadar geçerlidir.'),
      btn("WhatsApp'tan yazın", WA),
    ),
  },
  {
    name: 'İş başlangıcı',
    description: 'Onaydan sonra, iş başlamadan önce.',
    subject: 'İşinize başlıyoruz — {hizmet}',
    body: doc(
      hello,
      p('**{hizmet}** işinize başlıyoruz. Planımız şöyle:'),
      p('**Başlangıç:** [tarih, saat]', '**Tahmini süre:** [süre]', '**Ekip:** [kişi sayısı / sorumlu kişi]'),
      p('Başlamadan önce [uygulama alanının boşaltılması, elektrik/su erişimi gibi hazırlıklar] hazır olursa işimiz daha hızlı ilerler.'),
      p('Hava koşulları ya da malzeme teslimi nedeniyle bir değişiklik olursa sizi hemen bilgilendireceğiz.'),
      btn("WhatsApp'tan yazın", WA),
    ),
  },
  {
    name: 'İş tamamlandı',
    description: 'Teslimden sonra: teşekkür, bakım önerisi ve Google yorumu.',
    subject: 'İşiniz tamamlandı — teşekkür ederiz',
    body: doc(
      hello,
      p('**{hizmet}** işinizi tamamladık. Bizi tercih ettiğiniz için teşekkür ederiz.'),
      p(
        'Ahşabın uzun ömürlü olması için [bakım önerisi, örneğin: yılda bir kez koruyucu yağ uygulanması] öneririz. İleride bakım ya da onarım gerekirse bize her zaman ulaşabilirsiniz.',
      ),
      p("Memnun kaldıysanız Google'da kısa bir yorum bırakmanız bizim için çok değerli olur."),
      btn("Google'da yorum yazın", REVIEW),
      btn("WhatsApp'tan yazın", WA, 'cerceveli'),
    ),
  },
  {
    name: 'Nazik ret',
    description: 'İşi alamadığında (yoğunluk, bölge ya da kapsam dışı).',
    subject: 'Talebiniz hakkında',
    body: doc(
      hello,
      p('Talebiniz için teşekkür ederiz. Maalesef [neden: şu anki iş yoğunluğumuz / bölgenin uzaklığı / işin kapsamı] nedeniyle bu işi üstlenemiyoruz.'),
      p('İlerleyen dönemde benzer bir ihtiyacınız olursa bize yeniden yazmanızdan memnuniyet duyarız.'),
    ),
  },
]

/** Inserts the templates only into an empty table, so running it again (or after the owner's edits) changes nothing. */
export async function seedEmailTemplates(db: MigrateUpArgs['db']): Promise<void> {
  const existing = await db.execute(sql`SELECT 1 FROM "email_templates" LIMIT 1`)
  if (existing.rows.length) return
  for (const [i, t] of EMAIL_TEMPLATES.entries()) {
    await db.execute(
      sql`INSERT INTO "email_templates" ("name", "description", "subject", "body", "order") VALUES (${t.name}, ${t.description}, ${t.subject}, ${JSON.stringify(t.body)}::jsonb, ${(i + 1) * 10})`,
    )
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_templates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "email_templates" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_email_templates_fk";
  
  DROP INDEX "payload_locked_documents_rels_email_templates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_templates_id";`)
}
