// Günün kelimesi bu listeden seçilir. Her kelime tam 5 harftir ve yalnızca Türk alfabesinin
// harflerini içerir (q, w, x yok); `mantik.test.ts` bunu doğrular. Yalnızca çekimsiz, yaygın
// kelimeler vardır; özel isim yoktur. Küçük harfle yazılır, oyunda toLocaleUpperCase('tr') ile büyütülür.
const KELIME_METNI = `
abiye adale adres akşam aktör albüm alkol altın anlam anket antik arıza armut arsız arife aslan asker aşama atlas ayran
badem bahar balık balta banka baraj bebek beden belge beşik beyaz biber bilek bilet bilge bıçak bodur boğaz boyun boyut bozuk bölge börek bölük bulut buluş büyük bütün
cadde cahil ceket cesur cevap cümle
çanta çarşı çatal çekiç çelik çevre çınar çırak çiçek çizgi çocuk çorap çorba çözüm çukur
daire dalga dalış damar damla defne deniz derya dergi deste devam devir dilek dizin doğru doğum dolap domuz doruk dosya dudak durak duvar dürüm düğme düğün dünya düzen
elmas emlak emsal engel erken esnaf esrar evrak ezber ekmek
fakat fakir fanus fener fidan fidye fikir filiz final firma fırın fırça
gelin gelir genel gerek gıcık gizem gizli gölge gönül görev görüş gözde gövde gurur gümüş güneş güzel güdük göçük
haber hacim hafta hakem halat halde halka hamle hamur hasta havlu hayal hayat hazır hedef hekim hepsi heves heyet hilal hoşaf hudut hurma hücre hüner
ırmak ısrar ıslak
iklim ilham ilkel imkan inanç insan ipucu irade isyan istek ispat içeri
jeton jilet
kabak kabuk kadro kafes kahin kahve kakao kalem kalın kalıp kanal kanat kanun kapak karga karne kasap kaşar kaşık katil kavga kavun kayık kayıp kazak kazan kekik kemer kenar kepek kibar kilim kilit kimse kiraz kitap kolay kolon komşu konak konuk konut korku kovuk kulak kumaş kumru kural kurum kutup kuzey kuşku küçük küfür künye kütük kaçak
lamba liman lisan lokma lokum lüzum
makam makas mantı marul masal matem mazot medya mesaj meyve miras model motor mısır müzik
nakit namus nazar nehir nesil nokta
olgun orman
örnek özgür
pamuk pazar pembe perde peron pilot piyon plaka polis prens
radyo rakam rakip rapor roman rütbe resim
sabah sabun sahne sakin salça salon sanat saray saygı sebze seçim sedir sehpa selam semer serin sinek sinir sitem sofra sokak soğan sonuç sorun sunum surat sütun
şafak şarkı şehir şeker şölen
tabak tahta takım talep tarak tarih tarla tavan tavuk taşıt temiz tepsi terzi tohum toplu tuğla turşu tuzak tören tüfek tütün
unvan uygun uzman üzgün
vagon vakit vapur vatan vergi vücut
yakıt yalan yapay yarım yarın yasak yatak yavru yayın yazar yemek yetki yılan yorum yüzme yüzük
zafer zaman zarar zehir zemin zirve zurna
`;

export const KELIMELER: readonly string[] = [...new Set(KELIME_METNI.split(/\s+/).filter(Boolean))];
