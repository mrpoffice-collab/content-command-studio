import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuditResult {
  title: string;
  url: string;
  overallScore: number;
  seoScore: number;
  readabilityScore: number;
  engagementScore: number;
  issues: string[];
}

interface BatchSummary {
  totalPosts: number;
  averageScore: number;
  needsWork: number;
  fair: number;
  good: number;
  excellent: number;
}

export function generateBatchAuditPDF(
  auditResults: AuditResult[],
  summary: BatchSummary,
  blogUrl: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Helper to add page if needed
  const checkAddPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // HEADER
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Content Audit Report', 14, 25);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 25, { align: 'right' });
  doc.text(`Blog: ${blogUrl}`, pageWidth - 14, 32, { align: 'right' });

  yPosition = 50;

  // EXECUTIVE SUMMARY
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, yPosition);
  yPosition += 10;

  // Summary stats box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, yPosition, pageWidth - 28, 45, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  const summaryData = [
    ['Total Posts Analyzed:', summary.totalPosts.toString()],
    ['Average Score:', `${summary.averageScore}/100`],
    ['', ''],
    ['Distribution:', ''],
    ['  Excellent (90-100):', `${summary.excellent} posts`],
    ['  Good (80-89):', `${summary.good} posts`],
    ['  Fair (70-79):', `${summary.fair} posts`],
    ['  Needs Work (<70):', `${summary.needsWork} posts`],
  ];

  let tempY = yPosition + 8;
  summaryData.forEach(([label, value]) => {
    if (label) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, tempY);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 90, tempY);
    }
    tempY += 5;
  });

  yPosition += 50;

  // SCORING SCALE REFERENCE
  checkAddPage(30);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Scoring Scale', 14, yPosition);
  yPosition += 8;

  const scaleData = [
    { range: '90-100', label: 'Excellent', color: [34, 197, 94] }, // green-500
    { range: '80-89', label: 'Good', color: [59, 130, 246] }, // blue-500
    { range: '70-79', label: 'Fair', color: [234, 179, 8] }, // yellow-500
    { range: '<70', label: 'Needs Work', color: [249, 115, 22] }, // orange-500
  ];

  scaleData.forEach((scale) => {
    doc.setFillColor(...scale.color);
    doc.roundedRect(20, yPosition, 8, 6, 1, 1, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(scale.range, 32, yPosition + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.text(`- ${scale.label}`, 52, yPosition + 4.5);

    yPosition += 8;
  });

  yPosition += 5;

  // DETAILED RESULTS
  checkAddPage(20);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Post-by-Post Analysis', 14, yPosition);
  yPosition += 10;

  // Sort by score (worst first)
  const sortedResults = [...auditResults].sort((a, b) => a.overallScore - b.overallScore);

  sortedResults.forEach((result, index) => {
    checkAddPage(60);

    // Post header - calculate how many lines the title will take
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const titleText = `${index + 1}. ${result.title}`;
    const titleLines = doc.splitTextToSize(titleText, pageWidth - 28);
    doc.text(titleLines, 14, yPosition);
    yPosition += titleLines.length * 6; // Add 6 units per line

    // URL - add extra spacing
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    const urlLines = doc.splitTextToSize(result.url, pageWidth - 34);
    doc.text(urlLines, 20, yPosition);
    yPosition += urlLines.length * 5 + 2; // Add 5 units per line plus extra spacing
    doc.setTextColor(30, 41, 59); // back to slate-800

    // Scores table
    const tableData = [
      ['Overall Score', result.overallScore.toString(), getScoreLabel(result.overallScore)],
      ['SEO', result.seoScore.toString(), getScoreLabel(result.seoScore)],
      ['Readability', result.readabilityScore.toString(), getScoreLabel(result.readabilityScore)],
      ['Engagement', result.engagementScore.toString(), getScoreLabel(result.engagementScore)],
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Score', 'Grade']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
      },
      margin: { left: 20 },
      tableWidth: pageWidth - 40,
    });

    yPosition = (doc as any).lastAutoTable.finalY + 6;

    // Issues
    if (result.issues && result.issues.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Key Issues:', 20, yPosition);
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      result.issues.slice(0, 3).forEach((issue) => {
        checkAddPage(5);
        doc.text(`• ${issue}`, 25, yPosition, { maxWidth: pageWidth - 45 });
        yPosition += 5;
      });
    }

    yPosition += 5;
  });

  // RECOMMENDATIONS
  checkAddPage(60);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', 14, yPosition);
  yPosition += 10;

  const recommendations = [
    'Prioritize posts with scores below 70 for immediate rewriting',
    'Use the Content Rewrite feature to improve SEO, readability, and engagement',
    'Target all posts to achieve 80+ scores (Good professional quality)',
    'Focus on readability improvements: shorter sentences, simpler words',
    'Add more headers (H2, H3) to improve structure and SEO',
    'Include more bullet points and numbered lists for scannability',
    'Strengthen hooks and calls-to-action in each post',
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  recommendations.forEach((rec) => {
    checkAddPage(8);
    const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - 34);
    lines.forEach((line: string) => {
      doc.text(line, 20, yPosition);
      yPosition += 5;
    });
  });

  // FOOTER ON EACH PAGE
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');

    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Content Command Studio • Professional Content Optimization', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  return 'Needs Work';
}
