import type { APIRoute } from 'astro';

export const prerender = false;

interface AnfrageBody {
  _honey?: string;
  anliegen?: string;
  firma?: string;
  name?: string;
  email?: string;
  telefon?: string;
  nachricht?: string;
}

// Absender laufen über die bei Resend verifizierte Domain rhc.ch (wie sulsi.ch)
const ADMIN_TO = 'ralf@rhc.ch';
const FROM_ADMIN = 'Schefer-Fäscht Anfragen <anfragen@rhc.ch>';
const FROM_USER = 'Schefer-Fäscht 2027 <info@rhc.ch>';

function escapeHtml(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendMail(
  apiKey: string,
  opts: { from: string; to: string; reply_to?: string; subject: string; html: string },
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: opts.from, to: [opts.to], reply_to: opts.reply_to, subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`Resend antwortete ${res.status}: ${detail}`);
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

function table(rows: Array<[string, string | undefined]>): string {
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 14px 8px 0;font-weight:600;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:8px 0;white-space:pre-line;">${escapeHtml(v && v.trim() ? v : '—')}</td></tr>`,
    )
    .join('');
}

export const POST: APIRoute = async ({ request, locals }) => {
  const raw = (locals as any).runtime?.env?.RESENDKEY;
  let apiKey: string | undefined;
  try {
    apiKey = typeof raw === 'string' ? raw : raw && typeof raw.get === 'function' ? await raw.get() : undefined;
    apiKey = apiKey?.trim();
  } catch (e) {
    console.error('RESENDKEY konnte nicht gelesen werden', e);
  }
  if (!apiKey) return json({ error: 'Server-Konfiguration unvollständig.' }, 500);

  let body: AnfrageBody;
  try {
    body = (await request.json()) as AnfrageBody;
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }

  if (body._honey && body._honey.trim()) return json({ ok: true });

  const name = body.name?.trim() ?? '';
  const email = body.email?.trim() ?? '';
  const nachricht = body.nachricht?.trim() ?? '';
  const anliegen = body.anliegen?.trim() || 'Allgemeine Anfrage';

  if (!name || !email || !nachricht) {
    return json({ error: 'Bitte füllen Sie Name, E-Mail und Nachricht aus.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse an.' }, 400);
  }

  const rows: Array<[string, string | undefined]> = [
    ['Anliegen', anliegen],
    ['Name', name],
    ['Firma / Verein', body.firma],
    ['E-Mail', email],
    ['Telefon', body.telefon],
    ['Nachricht', nachricht],
  ];

  const adminHtml = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:620px;padding:24px;color:#111;">
      <h2 style="margin:0 0 6px;color:#1E4D2B;">Neue Anfrage: ${escapeHtml(anliegen)}</h2>
      <p style="margin:0 0 18px;color:#666;font-size:14px;">via schefer-fest.ch</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${table(rows)}</table>
      <p style="margin-top:24px;padding-top:12px;border-top:1px solid #eee;color:#666;font-size:12px;">Antwort auf diese Mail geht direkt an <strong>${escapeHtml(email)}</strong>.</p>
    </div>`;

  const userHtml = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:560px;padding:24px;color:#111;line-height:1.6;">
      <h2 style="margin:0 0 16px;color:#1E4D2B;">Danke für Ihre Nachricht</h2>
      <p>Guten Tag ${escapeHtml(name)}</p>
      <p>Ihre Anfrage zum Schefer-Fäscht 2027 (${escapeHtml(anliegen)}) ist bei uns angekommen. Wir melden uns so rasch wie möglich bei Ihnen.</p>
      <p style="margin-top:32px;">Freundliche Grüsse<br/>Das Team vom Schefer-Fäscht 2027</p>
      <p style="margin-top:24px;color:#666;font-size:13px;border-top:1px solid #eee;padding-top:14px;line-height:1.5;">
        Organisation: rhc gmbh, Appenzell · <a href="tel:+41715404010" style="color:#1E4D2B;">071 540 40 10</a> ·
        <a href="https://www.schefer-fest.ch" style="color:#1E4D2B;">www.schefer-fest.ch</a>
      </p>
    </div>`;

  try {
    await sendMail(apiKey, {
      from: FROM_ADMIN,
      to: ADMIN_TO,
      reply_to: email,
      subject: `Schefer-Fäscht: ${anliegen} – ${name}`,
      html: adminHtml,
    });
    try {
      await sendMail(apiKey, {
        from: FROM_USER,
        to: email,
        reply_to: ADMIN_TO,
        subject: 'Ihre Anfrage zum Schefer-Fäscht 2027',
        html: userHtml,
      });
    } catch (e) {
      console.error('Bestätigungsmail fehlgeschlagen: ' + String((e as Error)?.message ?? e));
    }
    return json({ ok: true });
  } catch (e) {
    console.error('Anfrage-Mail fehlgeschlagen: ' + String((e as Error)?.message ?? e));
    return json({ error: 'Die Nachricht konnte nicht gesendet werden. Bitte rufen Sie uns an: 071 540 40 10.' }, 500);
  }
};
