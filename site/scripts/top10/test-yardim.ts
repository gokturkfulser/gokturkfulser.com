// Yalnızca testler için: sahte YouTube/Gemini yanıtları. Ağ çağrısı yok; gerçek API'lere hiçbir test ulaşmaz.
import type { HamGece, HamOyun } from './gemini.ts';

export const YT_ANAHTAR = 'YT-SAHTE-ANAHTAR-123';
export const GM_ANAHTAR = 'GM-SAHTE-ANAHTAR-456';

const OYUNCULAR: [string, string][] = [
  ['Tomas Veltri', 'SAS'],
  ['Kofi Adebayo', 'OKC'],
  ['Ilse Brandt', 'DEN'],
  ['Rafael Quintero', 'MIA'],
  ['Jun Takeda', 'GSW'],
  ['Dario Fenn', 'PHX'],
  ['Nils Haugen', 'MIN'],
  ['Amara Osei', 'BOS'],
  ['Leo Marchetti', 'NYK'],
  ['Mirko Daval', 'SAS'],
];

/** Geçerli ham gece (Gemini çıktısı biçiminde, istem.md alan adlarıyla): top10 → 10 oyun, top5 → 5.
 *  1. sıra 70/30 paylı alley-oop; 3. sıra (yalnızca top5) orta güvenli. Zaman damgaları 0:10, 0:50, 1:30… */
export function gecerliHam(tur: 'top10' | 'top5' = 'top10', tarih = '2026-11-01'): HamGece {
  const n = tur === 'top10' ? 10 : 5;
  const plays: HamOyun[] = Array.from({ length: n }, (_, i) => {
    const [player, team] = OYUNCULAR[i]!;
    const sn = (n - 1 - i) * 40 + 10;
    return {
      rank: i + 1,
      action: 'dunk',
      contributors: [{ player, team, role: 'finisher', share: 100, share_reason: null }],
      opponent: null,
      tags: [],
      description: `Play number ${i + 1}`,
      timestamp: `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`,
      confidence: 'high',
      confidence_reason: null,
    };
  });
  plays[0] = {
    ...plays[0]!,
    action: 'alley_oop',
    tags: ['no_look', 'fast_break'],
    opponent: 'Dario Fenn',
    contributors: [
      { player: 'Mirko Daval', team: 'SAS', role: 'passer', share: 70, share_reason: 'The no-look pass was the more spectacular part' },
      { player: 'Tomas Veltri', team: 'SAS', role: 'finisher', share: 30, share_reason: null },
    ],
  };
  if (n === 5) plays[2] = { ...plays[2]!, confidence: 'medium', confidence_reason: 'Jersey number partly hidden' };
  return { date: tarih, type: tur, plays };
}

export const json = (govde: unknown, durum = 200) => new Response(JSON.stringify(govde), { status: durum, headers: { 'Content-Type': 'application/json' } });

/** Gemini Interactions yanıtı (resmi biçim: steps[] → son model_output → content[].text; usage). */
export const geminiYaniti = (ham: unknown, usage: object | null = { total_input_tokens: 2000, total_output_tokens: 500, total_thought_tokens: 100, total_tokens: 2600 }) => ({
  id: 'i-1',
  steps: [
    { type: 'thought', content: [] },
    { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(ham) }] },
  ],
  ...(usage ? { usage } : {}),
});

export const oge = (id: string, title: string, publishedAt: string) => ({ snippet: { title, publishedAt, resourceId: { videoId: id } } });

export type Cagri = { url: string; init?: RequestInit };

/** NBA tarzı video açıklaması: gecerliHam() oyuncularını "featuring" satırında sayar (sırasız). */
export const ACIKLAMA_ORNEK = [
  'Check out the best plays of the night featuring Tomas Veltri, Kofi Adebayo, Ilse Brandt, Rafael Quintero, Jun Takeda, Dario Fenn, Nils Haugen, Amara Osei, Leo Marchetti and Mirko Daval.',
  '',
  'Subscribe to the NBA: https://on.nba.com/2JX5gSN',
].join('\n');
