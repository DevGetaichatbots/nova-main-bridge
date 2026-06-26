import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportIframeToPdf(iframeEl, filename = 'dashboard.pdf') {
  const doc = iframeEl.contentDocument || iframeEl.contentWindow?.document;
  if (!doc) throw new Error('Cannot access iframe document');

  const canvas = await html2canvas(doc.body, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scale: 2,
    scrollX: 0,
    scrollY: 0,
    width: doc.body.scrollWidth,
    height: doc.body.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  const pageWidth = 210;
  const pageHeight = 297;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  const pdf = new jsPDF({ orientation: imgHeight > pageHeight ? 'p' : 'p', unit: 'mm', format: 'a4' });

  let y = 0;
  let remaining = imgHeight;

  while (remaining > 0) {
    pdf.addImage(imgData, 'PNG', 0, y > 0 ? -(imgHeight - remaining) : 0, imgWidth, imgHeight);
    remaining -= pageHeight;
    if (remaining > 0) {
      pdf.addPage();
      y += pageHeight;
    }
  }

  pdf.save(filename);
}
