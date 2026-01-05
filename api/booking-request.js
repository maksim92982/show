/**
 * Vercel Serverless Function: POST /api/booking-request
 *
 * Sends booking request to admin via Telegram.
 *
 * Required env vars:
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_ID
 */

const getEnv = name => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const escape = s => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = getEnv('TELEGRAM_BOT_TOKEN');
    const chatId = getEnv('TELEGRAM_CHAT_ID');

    const b = req.body || {};
    const title = escape(b.title || 'Запись');
    const day = escape(b.day || '');
    const time = escape(b.time || '');
    const contact = escape(b.contact || '');
    const name = escape(b.name || '');
    const comment = escape(b.comment || '');
    const pageUrl = escape(b.pageUrl || '');

    if (!day || !time) {
      res.status(400).json({ error: 'Missing day/time' });
      return;
    }
    if (!contact) {
      res.status(400).json({ error: 'Missing contact' });
      return;
    }

    const textLines = [
      `🗓️ <b>${title}</b>`,
      `Дата/время: <b>${day} ${time}</b>`,
      name ? `Имя: <b>${name}</b>` : null,
      `Контакт: <b>${contact}</b>`,
      comment ? `Комментарий: ${comment}` : null,
      pageUrl ? `Страница: ${pageUrl}` : null,
    ].filter(Boolean);

    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textLines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || data?.ok !== true) {
      const msg = data?.description ? String(data.description) : `HTTP ${tgRes.status}`;
      res.status(500).json({ error: `Telegram error: ${msg}` });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}




