import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = `"Vancomyzer™" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@vancomyzer.com'}>`

async function send(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER) {
    console.log(`[TRIAL_EMAIL] Skipped — SMTP not configured. To: ${to} Subject: ${subject}`)
    return
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html })
  } catch (err) {
    console.error('[TRIAL_EMAIL] Failed:', err)
  }
}

export async function sendPhase2Email(user: { email: string; name: string }) {
  await send(
    user.email,
    'Vancomyzer™ — You have reached Phase 2 of your pilot',
    `
      <p>Hi ${user.name},</p>
      <p>You are now in <strong>Phase 2</strong> of your 90-day Vancomyzer™ pilot — the active use phase.</p>
      <p>Every patient you run through the calculator is being logged. At day 75, a personalized
      summary report will be generated showing your AUC attainment rate, obesity model activations,
      and key clinical outcomes — a document you can share with your pharmacy director.</p>
      <p>Keep using Vancomyzer™ as your primary dosing support tool.</p>
      <p>— The Dosys Health LLC Team<br>mario@dosys.health</p>
    `
  )
}

export async function sendReportReadyEmail(user: { email: string; name: string }) {
  await send(
    user.email,
    'Vancomyzer™ — Your pilot summary report is ready',
    `
      <p>Hi ${user.name},</p>
      <p>You have reached day 75 of your Vancomyzer™ pilot. <strong>Your personalized summary report is ready to generate.</strong></p>
      <p>The report documents your AUC target attainment rate, obesity model activations, and case volume —
      everything you need to make the case for an institutional subscription to your pharmacy director.</p>
      <p><a href="https://vancomyzer.com/dashboard/pilot" style="color:#00d4aa;font-weight:bold;">
        Generate my report →
      </a></p>
      <p>You have 15 days remaining in your free pilot.</p>
      <p>— The Dosys Health LLC Team</p>
    `
  )
}

export async function sendTrialExpiringEmail(user: { email: string; name: string }, daysLeft: number) {
  await send(
    user.email,
    `Vancomyzer™ — ${daysLeft} days left in your free pilot`,
    `
      <p>Hi ${user.name},</p>
      <p>Your Vancomyzer™ free pilot ends in <strong>${daysLeft} days</strong>.</p>
      <p>Subscribe now to retain your full case history, unlock multi-user access, and continue
      AUC-guided dosing without interruption.</p>
      <p><a href="https://vancomyzer.com/upgrade" style="color:#00d4aa;font-weight:bold;">
        Subscribe — $19/mo or $149/yr →
      </a></p>
      <p>— The Dosys Health LLC Team</p>
    `
  )
}
