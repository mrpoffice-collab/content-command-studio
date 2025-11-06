import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ComparisonData {
  title: string;
  originalContent: string;
  improvedContent: string;
  originalScore: number;
  improvedScore: number;
  scoreBreakdown?: {
    category: string;
    before: number;
    after: number;
    improvement: number;
  }[];
  generatedDate?: string;
}

/**
 * Generate a professional before/after comparison PDF
 * showing content improvements and score changes
 */
export function generateComparisonPDF(data: ComparisonData): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = (pageWidth - margin * 3) / 2;
  let yPos = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Header Section
  doc.setFillColor(46, 58, 140); // deep-indigo
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Content Rewrite Report', margin, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('AISO Score Improvement Analysis', margin, 30);

  yPos = 50;

  // Document Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${data.generatedDate || new Date().toLocaleDateString()}`, margin, yPos);
  yPos += 10;

  // Title Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Article Title:', margin, yPos);
  yPos += 7;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  const titleLines = doc.splitTextToSize(data.title, pageWidth - margin * 2);
  doc.text(titleLines, margin, yPos);
  yPos += titleLines.length * 7 + 10;

  // Score Comparison Box
  checkPageBreak(40);

  // Original Score Box
  doc.setFillColor(248, 113, 113); // red-400 for low scores
  if (data.originalScore >= 75) doc.setFillColor(96, 165, 250); // blue-400
  if (data.originalScore >= 85) doc.setFillColor(74, 222, 128); // green-400
  doc.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGINAL SCORE', margin + 5, yPos + 10);

  doc.setFontSize(32);
  doc.text(data.originalScore.toString(), margin + 5, yPos + 25);
  doc.setFontSize(14);
  doc.text('/ 100', margin + 30, yPos + 25);

  // Improved Score Box
  doc.setFillColor(74, 222, 128); // green-400
  if (data.improvedScore >= 90) doc.setFillColor(34, 197, 94); // green-500
  doc.roundedRect(margin * 2 + contentWidth, yPos, contentWidth, 35, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPROVED SCORE', margin * 2 + contentWidth + 5, yPos + 10);

  doc.setFontSize(32);
  doc.text(data.improvedScore.toString(), margin * 2 + contentWidth + 5, yPos + 25);
  doc.setFontSize(14);
  doc.text('/ 100', margin * 2 + contentWidth + 30, yPos + 25);

  // Improvement Arrow
  const improvement = data.improvedScore - data.originalScore;
  const arrowX = pageWidth / 2;
  const arrowY = yPos + 17.5;

  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(2);
  doc.line(arrowX - 10, arrowY, arrowX + 10, arrowY);
  // Arrow head
  doc.line(arrowX + 10, arrowY, arrowX + 5, arrowY - 3);
  doc.line(arrowX + 10, arrowY, arrowX + 5, arrowY + 3);

  doc.setFontSize(12);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(`+${improvement}`, arrowX - 5, arrowY - 5);

  yPos += 45;

  // Score Breakdown Table (if provided)
  if (data.scoreBreakdown && data.scoreBreakdown.length > 0) {
    checkPageBreak(60);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Score Breakdown', margin, yPos);
    yPos += 10;

    const tableData = data.scoreBreakdown.map(item => [
      item.category,
      item.before.toString(),
      item.after.toString(),
      `+${item.improvement}`
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Before', 'After', 'Change']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [46, 58, 140], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center', textColor: [34, 197, 94], fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        yPos = data.cursor.y;
      }
    });

    // Add some space after the table
    yPos += 15;
  }

  // Content Comparison Section
  doc.addPage();
  yPos = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Content Comparison', margin, yPos);
  yPos += 15;

  // Two Column Layout
  const columnHeight = pageHeight - yPos - margin;

  // Original Content Column
  doc.setFillColor(254, 242, 242); // red-50
  doc.rect(margin, yPos, contentWidth, columnHeight, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28); // red-700
  doc.text('ORIGINAL', margin + 5, yPos + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  // Split and render original content
  const originalLines = doc.splitTextToSize(
    data.originalContent.substring(0, 2000) + (data.originalContent.length > 2000 ? '...' : ''),
    contentWidth - 10
  );

  let contentYPos = yPos + 15;
  for (const line of originalLines) {
    if (contentYPos > pageHeight - margin - 5) break;
    doc.text(line, margin + 5, contentYPos);
    contentYPos += 4;
  }

  // Improved Content Column
  doc.setFillColor(240, 253, 244); // green-50
  doc.rect(margin * 2 + contentWidth, yPos, contentWidth, columnHeight, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 128, 61); // green-700
  doc.text('IMPROVED', margin * 2 + contentWidth + 5, yPos + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  // Split and render improved content
  const improvedLines = doc.splitTextToSize(
    data.improvedContent.substring(0, 2000) + (data.improvedContent.length > 2000 ? '...' : ''),
    contentWidth - 10
  );

  contentYPos = yPos + 15;
  for (const line of improvedLines) {
    if (contentYPos > pageHeight - margin - 5) break;
    doc.text(line, margin * 2 + contentWidth + 5, contentYPos);
    contentYPos += 4;
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Generated by Content Command Studio - AISO Stack',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Generate filename
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const date = new Date().toISOString().split('T')[0];
  const filename = `${slug}-rewrite-comparison-${date}.pdf`;

  // Download the PDF
  doc.save(filename);
}
