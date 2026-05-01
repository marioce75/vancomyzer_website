import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { findUserById } from '@/lib/db'
import type { TrialStatusResult } from './trialService'

const hex = (h: string) => {
  const r = parseInt(h.slice(1, 3), 16) / 255
  const g = parseInt(h.slice(3, 5), 16) / 255
  const b = parseInt(h.slice(5, 7), 16) / 255
  return rgb(r, g, b)
}

const GREEN = hex('#00d4aa')
const NAVY  = hex('#1C3A52')
const SLATE = hex('#3D5A73')
const WHITE = rgb(1, 1, 1)
const LIGHT = hex('#F7FBFA')

export async function generatePilotReport(
  userId: number,
  status: TrialStatusResult
): Promise<string> {
  const { stats, trial, daysElapsed } = status

  const dbUser = findUserById(userId)
  const userName = dbUser?.full_name ?? 'Vancomyzer User'
  const institution = dbUser?.institution ?? 'Your Institution'
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()

  const fontBold  = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontReg   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontObliq = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Navy header band
  page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: NAVY })
  page.drawRectangle({ x: 0, y: height - 116, width, height: 6, color: GREEN })

  page.drawText('VANCOMYZER™', { x: 40, y: height - 40, size: 9, font: fontBold, color: GREEN })
  page.drawText('90-Day Pilot Summary Report', { x: 40, y: height - 58, size: 20, font: fontBold, color: WHITE })
  page.drawText(`Prepared for: ${userName}  ·  ${institution}`, { x: 40, y: height - 80, size: 10, font: fontReg, color: rgb(0.7, 0.9, 0.85) })
  page.drawText(`Generated: ${generatedDate}  ·  Pilot Day ${daysElapsed} of 90`, { x: 40, y: height - 96, size: 9, font: fontReg, color: rgb(0.6, 0.8, 0.75) })

  let y = height - 148

  page.drawText('Your Pilot at a Glance', { x: 40, y, size: 14, font: fontBold, color: NAVY })
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.5, color: GREEN })
  y -= 24

  const statBoxes = [
    { label: 'Patients Dosed', value: stats.totalCases.toString(), sub: 'total cases logged' },
    { label: 'AUC Target Attainment', value: stats.aucTargetAttainmentRate != null ? `${stats.aucTargetAttainmentRate.toFixed(0)}%` : 'N/A', sub: 'of cases with outcome data' },
    { label: 'Obesity Model', value: stats.obesityModelActivations.toString(), sub: 'auto-activations (BMI ≥40)' },
    { label: 'ICU Patients', value: stats.icuCases.toString(), sub: 'critical care cases' },
  ]

  const boxW = 121, boxH = 72, boxGap = 10
  statBoxes.forEach((box, i) => {
    const x = 40 + i * (boxW + boxGap)
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: boxH, color: LIGHT })
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: 3, color: GREEN })
    page.drawText(box.value, { x: x + 12, y: y - 30, size: 22, font: fontBold, color: NAVY })
    page.drawText(box.label, { x: x + 12, y: y - 46, size: 8, font: fontBold, color: SLATE })
    page.drawText(box.sub, { x: x + 12, y: y - 58, size: 7, font: fontReg, color: SLATE })
  })
  y -= boxH + 28

  page.drawText('What the Data Shows', { x: 40, y, size: 14, font: fontBold, color: NAVY })
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.5, color: GREEN })
  y -= 20

  const insights: string[] = []

  if (stats.totalCases >= 20) {
    insights.push(`Over ${stats.totalCases} vancomycin cases were processed through Bayesian AUC-guided dosing during this pilot.`)
  } else if (stats.totalCases > 0) {
    insights.push(`${stats.totalCases} vancomycin cases were processed through Bayesian AUC-guided dosing during this pilot.`)
  }

  if (stats.aucTargetAttainmentRate != null) {
    insights.push(`AUC target attainment (400–600 mg·h/L) was achieved in ${stats.aucTargetAttainmentRate.toFixed(0)}% of cases with documented outcomes, reflecting direct alignment with the 2020 ASHP/IDSA consensus guidelines.`)
  }

  if (stats.obesityModelActivations > 0) {
    insights.push(`The Vancomyzer™ Obesity Model (FFM-based, BMI ≥40) was automatically activated ${stats.obesityModelActivations} time${stats.obesityModelActivations !== 1 ? 's' : ''} — providing pharmacologically appropriate dosing for patients in whom total body weight-based models have known systematic bias.`)
  }

  if (stats.twoLevelCases > 0) {
    insights.push(`${stats.twoLevelCases} cases used two-level Bayesian MAP estimation, enabling individualized pharmacokinetic parameter refinement after initial level results.`)
  }

  if (stats.icuCases > 0) {
    insights.push(`${stats.icuCases} ICU patients were dosed, a population at elevated risk of vancomycin-associated nephrotoxicity where AUC-guided dosing has the greatest demonstrated clinical impact.`)
  }

  if (insights.length === 0) {
    insights.push('Continue using Vancomyzer™ to build your outcome dataset. Richer data produces a more meaningful report.')
  }

  insights.forEach(text => {
    const maxW = 532
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []
    words.forEach(w => {
      const test = line + (line ? ' ' : '') + w
      if (fontReg.widthOfTextAtSize(test, 10) > maxW && line) { lines.push(line); line = w }
      else line = test
    })
    if (line) lines.push(line)

    page.drawText('–', { x: 40, y: y - 2, size: 10, font: fontBold, color: GREEN })
    lines.forEach((l, li) => {
      page.drawText(l, { x: 54, y: y - li * 14, size: 10, font: fontReg, color: NAVY })
    })
    y -= lines.length * 14 + 8
  })

  y -= 16

  page.drawText('Clinical Context', { x: 40, y, size: 14, font: fontBold, color: NAVY })
  y -= 6
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1.5, color: GREEN })
  y -= 18

  const context = [
    'The 2020 ASHP/IDSA/PIDS/SIDP consensus guidelines mandate AUC24-guided vancomycin monitoring with Bayesian software as the preferred method, targeting AUC24/MIC of 400–600 mg·h/L.',
    'Trough-based monitoring is associated with AKI rates as high as 19%. AUC-guided dosing reduces nephrotoxicity risk — particularly relevant for ICU and high-comorbidity populations.',
    'Vancomyzer™ is the only transparent, open-source Bayesian dosing platform displaying all PK equations with DOI-linked citations at the point of care.',
  ]

  context.forEach(text => {
    const words = text.split(' ')
    let line = ''
    const lines: string[] = []
    words.forEach(w => {
      const test = line + (line ? ' ' : '') + w
      if (fontReg.widthOfTextAtSize(test, 9) > 532 && line) { lines.push(line); line = w }
      else line = test
    })
    if (line) lines.push(line)
    page.drawText('·', { x: 40, y: y - 1, size: 10, font: fontBold, color: GREEN })
    lines.forEach((l, li) => {
      page.drawText(l, { x: 52, y: y - li * 12, size: 9, font: fontReg, color: SLATE })
    })
    y -= lines.length * 12 + 8
  })

  y -= 16

  page.drawRectangle({ x: 0, y: y - 72, width, height: 72, color: LIGHT })
  page.drawRectangle({ x: 0, y: y - 72, width: 4, height: 72, color: GREEN })

  page.drawText('Ready to Continue?', { x: 20, y: y - 18, size: 13, font: fontBold, color: NAVY })
  page.drawText('Subscribe to Vancomyzer™ to retain your full case history, unlock multi-user access,', { x: 20, y: y - 34, size: 9, font: fontReg, color: SLATE })
  page.drawText('and continue AUC-guided dosing with no interruption to your clinical workflow.', { x: 20, y: y - 46, size: 9, font: fontReg, color: SLATE })
  page.drawText('Visit vancomyzer.com/upgrade to get started.', { x: 20, y: y - 60, size: 9, font: fontBold, color: GREEN })

  page.drawLine({ start: { x: 40, y: 36 }, end: { x: 572, y: 36 }, thickness: 0.5, color: hex('#C8DDD8') })
  page.drawText('Vancomyzer™ is a product of Dosys Health LLC · McAllen, Texas · dosys.health · mario@dosys.health', { x: 40, y: 22, size: 7.5, font: fontReg, color: SLATE })
  page.drawText('This report is generated from anonymized case logs collected during the free pilot period. It does not contain patient identifiers.', { x: 40, y: 12, size: 6.5, font: fontObliq, color: SLATE })

  const pdfBytes = await pdfDoc.save()

  // TODO: In production, move to Vercel Blob Storage or S3 and return a signed URL instead.
  const dir = path.join(process.cwd(), 'public', 'reports')
  await mkdir(dir, { recursive: true })
  const filename = `pilot-report-${userId}-${Date.now()}.pdf`
  const filepath = path.join(dir, filename)
  await writeFile(filepath, pdfBytes)

  return `/reports/${filename}`
}
