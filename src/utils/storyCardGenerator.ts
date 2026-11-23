import { MatchPlayerStats, MatchRoundHighlight } from '../game/types';

export interface StoryCardData {
  playerName: string;
  leagueName: string;
  leagueIcon: string;
  playerScore: number;
  opponentScore: number;
  opponentName: string;
  speedLabel: string;
  movesLabel: string;
  featuredFootballer: string;
}

export function pickFeaturedFootballer(
  matchHighlights: MatchRoundHighlight[],
  player1Id: string
): string {
  const userCorrectRounds = matchHighlights.filter(
    (h) =>
      h.winnerPlayerId === player1Id &&
      typeof h.acceptedAnswer === 'string' &&
      h.acceptedAnswer.trim().length > 0
  );

  if (userCorrectRounds.length > 0) {
    // Öncelik: son saniye (clutch) doğru tahmini, yoksa en hızlı doğru tahmin
    const sorted = [...userCorrectRounds].sort((a, b) => {
      if (a.wasClutch && !b.wasClutch) return -1;
      if (!a.wasClutch && b.wasClutch) return 1;
      const aSec = a.elapsedSec ?? 999;
      const bSec = b.elapsedSec ?? 999;
      return aSec - bSec;
    });
    return sorted[0].acceptedAnswer!.trim();
  }

  const anyAnswer = matchHighlights.find(
    (h) => typeof h.acceptedAnswer === 'string' && h.acceptedAnswer.trim().length > 0
  );
  return anyAnswer?.acceptedAnswer?.trim() || 'Süper Yıldız';
}

export function formatStoryMatchMetrics(
  matchHighlights: MatchRoundHighlight[],
  player1Id: string,
  stats: MatchPlayerStats,
  playerScore: number
): { speedLabel: string; movesLabel: string } {
  const userRounds = matchHighlights.filter((h) => h.winnerPlayerId === player1Id);
  const timedSecs = userRounds
    .map((h) => h.elapsedSec)
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0);

  let speedLabel: string;
  if (timedSecs.length > 0) {
    const totalSec = timedSecs.reduce((acc, s) => acc + s, 0);
    speedLabel = `${totalSec.toFixed(1)} sn`;
  } else if (typeof stats.fastestAnswerSec === 'number' && stats.fastestAnswerSec > 0) {
    speedLabel = `${stats.fastestAnswerSec.toFixed(1)} sn`;
  } else {
    speedLabel = 'Şimşek Hız';
  }

  const totalMoves = Math.max(
    playerScore,
    stats.totalCorrect + stats.totalWrongAttempts,
    userRounds.length
  );
  const movesLabel = `${totalMoves} Hamle`;

  return { speedLabel, movesLabel };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitFontText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  fontWeight: string = '900'
): number {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${fontWeight} ${size}px "Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
    size -= 2;
  }
  ctx.font = `${fontWeight} ${minSize}px "Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;
  return minSize;
}

export async function generateInstagramStoryCardBlob(
  data: StoryCardData
): Promise<Blob> {
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D bağlamı oluşturulamadı.');
  }

  // 1. Stadyum Gece Arka Planı (9:16 Dikey)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#04121f');
  bgGrad.addColorStop(0.45, '#072227');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Üst Stadyum Projektör Işıkları
  const leftGlow = ctx.createRadialGradient(170, 140, 20, 170, 140, 560);
  leftGlow.addColorStop(0, 'rgba(16, 185, 129, 0.34)');
  leftGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, 900);

  const rightGlow = ctx.createRadialGradient(910, 160, 20, 910, 160, 560);
  rightGlow.addColorStop(0, 'rgba(251, 191, 36, 0.28)');
  rightGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, width, 900);

  // İnce Saha Çizgileri Dekoru
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 52, 52, width - 104, height - 104, 48);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 230, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(52, height / 2);
  ctx.lineTo(width - 52, height / 2);
  ctx.stroke();
  ctx.restore();

  // 2. Üst Logo & "3-2-1 FUTBOL" Başlığı
  ctx.save();
  const logoBadgeGrad = ctx.createLinearGradient(width / 2 - 72, 120, width / 2 + 72, 264);
  logoBadgeGrad.addColorStop(0, '#fbbf24');
  logoBadgeGrad.addColorStop(1, '#f59e0b');
  drawRoundedRect(ctx, width / 2 - 72, 124, 144, 144, 38);
  ctx.fillStyle = logoBadgeGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#020617';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 54px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('321', width / 2, 198);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const titleGrad = ctx.createLinearGradient(240, 320, 840, 390);
  titleGrad.addColorStop(0, '#fde68a');
  titleGrad.addColorStop(0.5, '#ffffff');
  titleGrad.addColorStop(1, '#34d399');
  ctx.fillStyle = titleGrad;
  ctx.font = '900 84px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('3-2-1 FUTBOL', width / 2, 370);

  // ZAFER KARTI Rozeti
  drawRoundedRect(ctx, width / 2 - 220, 405, 440, 62, 31);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '900 28px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('🏆 GALİBİYET SKOR KARTI', width / 2, 446);

  // 3. Oyuncu Kullanıcı Adı & Aktif Lig Kartı
  drawRoundedRect(ctx, 100, 520, width - 200, 220, 38);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 26px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('ŞAMPİYON OYUNCU', width / 2, 578);

  const safePlayerName = data.playerName.trim() || 'Futbol Sever';
  fitFontText(ctx, safePlayerName, width - 270, 62, 34, '900');
  ctx.fillStyle = '#ffffff';
  ctx.fillText(safePlayerName, width / 2, 650);

  // Aktif Lig Hapı
  const leaguePillText = `${data.leagueIcon}  ${data.leagueName}`;
  ctx.font = '900 32px "Inter", "Segoe UI", system-ui, sans-serif';
  const pillW = Math.min(width - 280, Math.max(340, ctx.measureText(leaguePillText).width + 76));
  drawRoundedRect(ctx, (width - pillW) / 2, 676, pillW, 56, 28);
  ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.fillText(leaguePillText, width / 2, 715);

  // 4. Dev Skor Tabelası
  drawRoundedRect(ctx, 100, 785, width - 200, 260, 42);
  const scoreCardGrad = ctx.createLinearGradient(100, 785, width - 100, 1045);
  scoreCardGrad.addColorStop(0, 'rgba(6, 78, 59, 0.72)');
  scoreCardGrad.addColorStop(1, 'rgba(15, 23, 42, 0.94)');
  ctx.fillStyle = scoreCardGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = '900 132px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${data.playerScore}  -  ${data.opponentScore}`, width / 2, 932);

  const vsText = `${safePlayerName}  vs  ${data.opponentName}`;
  fitFontText(ctx, vsText, width - 280, 30, 20, '700');
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(vsText, width / 2, 1002);

  // 5. Süre & Hamle İstatistik Kutuları
  const boxGap = 32;
  const boxW = (width - 200 - boxGap) / 2;
  const boxY = 1090;
  const boxH = 210;

  // Sol Kutu: Süre
  drawRoundedRect(ctx, 100, boxY, boxW, boxH, 34);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 26px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('⏱️ TAMAMLAMA SÜRESİ', 100 + boxW / 2, boxY + 68);
  fitFontText(ctx, data.speedLabel, boxW - 44, 62, 34, '900');
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.speedLabel, 100 + boxW / 2, boxY + 150);

  // Sağ Kutu: Hamle
  const rightBoxX = 100 + boxW + boxGap;
  drawRoundedRect(ctx, rightBoxX, boxY, boxW, boxH, 34);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.font = '800 26px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('⚡ MAÇ PERFORMANSI', rightBoxX + boxW / 2, boxY + 68);
  fitFontText(ctx, data.movesLabel, boxW - 44, 62, 34, '900');
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.movesLabel, rightBoxX + boxW / 2, boxY + 150);

  // 6. Maçta Bildiği En Dikkat Çekici Futbolcu Kartı
  drawRoundedRect(ctx, 100, 1345, width - 200, 230, 38);
  const starGrad = ctx.createLinearGradient(100, 1345, width - 100, 1575);
  starGrad.addColorStop(0, 'rgba(245, 158, 11, 0.24)');
  starGrad.addColorStop(1, 'rgba(234, 88, 12, 0.16)');
  ctx.fillStyle = starGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#fcd34d';
  ctx.font = '900 28px "Inter", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('⭐ MAÇTA BİLDİĞİ YILDIZ FUTBOLCU', width / 2, 1418);

  fitFontText(ctx, data.featuredFootballer, width - 270, 68, 34, '900');
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.featuredFootballer, width / 2, 1516);

  // 7. Alt Meydan Okuma Bandı
  drawRoundedRect(ctx, 100, 1655, width - 200, 146, 36);
  const ctaGrad = ctx.createLinearGradient(100, 1655, width - 100, 1801);
  ctaGrad.addColorStop(0, '#fbbf24');
  ctaGrad.addColorStop(1, '#34d399');
  ctx.fillStyle = ctaGrad;
  ctx.fill();

  ctx.fillStyle = '#020617';
  fitFontText(ctx, '@321futbol • Beni geçebilir misin?', width - 250, 42, 26, '900');
  ctx.fillText('@321futbol • Beni geçebilir misin?', width / 2, 1742);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG çıktısı üretilemedi.'));
        }
      },
      'image/png',
      1
    );
  });
}

export async function shareOrDownloadStoryCard(
  data: StoryCardData
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await generateInstagramStoryCardBlob(data);
  const fileName = '321-futbol-skor-karti.png';
  const file = new File([blob], fileName, { type: 'image/png' });

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const canNativeShareFiles = Boolean(
    nav &&
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [file] })
  );

  if (canNativeShareFiles && nav) {
    try {
      await nav.share({
        title: '3-2-1 Futbol Skor Kartı',
        text: `${data.playerName} (${data.leagueName}) • @321futbol • Beni geçebilir misin?`,
        files: [file],
      });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Paylaşım başarısız olursa otomatik PNG indirmeye düş
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'downloaded';
}
