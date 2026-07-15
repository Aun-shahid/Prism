/**
 * Render an on-page element (a mounted ResumeTemplate) to a PDF and return the
 * base64 payload — reused by the email-outreach flow to attach a resume without
 * any server-side PDF rendering. Same html2canvas + jsPDF path the resume
 * builder's downloadPDF uses.
 */
export async function elementToPdfBase64(
  el: HTMLElement,
  pageSize: 'a4' | 'letter' = 'a4',
): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: pageSize === 'letter' ? 'letter' : 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pw, ph);
  // datauristring => "data:application/pdf;filename=...;base64,XXXX"
  const dataUri = pdf.output('datauristring');
  const marker = 'base64,';
  const idx = dataUri.indexOf(marker);
  return idx >= 0 ? dataUri.slice(idx + marker.length) : '';
}
