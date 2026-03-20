import PDFDocument from 'pdfkit';
import type { Application } from '@prisma/client';

export interface PDFExportOptions {
  title: string;
  exportDate: Date;
}

export async function generateApplicationsPDF(
  applications: Application[],
  options: PDFExportOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text(options.title, { align: 'center' });
      doc.moveDown(0.5);

      // Export date
      const dateStr = options.exportDate.toISOString().split('T')[0];
      doc.fontSize(10).font('Helvetica').text(`Exported: ${dateStr}`, { align: 'center' });
      doc.moveDown(1.5);

      // Table configuration
      const columns = [
        { header: 'Company', width: 120, key: 'companyName' as const },
        { header: 'Role', width: 130, key: 'jobTitle' as const },
        { header: 'Status', width: 80, key: 'status' as const },
        { header: 'Language', width: 70, key: 'targetLanguage' as const },
        { header: 'Date', width: 90, key: 'createdAt' as const },
      ];

      const tableLeft = 50;
      const rowHeight = 22;

      // Draw table header
      let y = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');

      let x = tableLeft;
      for (const col of columns) {
        doc.text(col.header, x, y, { width: col.width, ellipsis: true });
        x += col.width;
      }

      // Header underline
      y += rowHeight - 4;
      doc.moveTo(tableLeft, y).lineTo(tableLeft + columns.reduce((s, c) => s + c.width, 0), y).stroke();
      y += 6;

      // Draw rows
      doc.font('Helvetica').fontSize(8);
      const cellPadding = 4;

      for (const app of applications) {
        const d = app.createdAt instanceof Date ? app.createdAt : new Date(app.createdAt);
        const createdDate = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

        const values: Record<string, string> = {
          companyName: app.companyName,
          jobTitle: app.jobTitle,
          status: app.status,
          targetLanguage: app.targetLanguage,
          createdAt: createdDate,
        };

        // Measure the height each cell needs
        doc.font('Helvetica').fontSize(8);
        let maxCellHeight = rowHeight;
        for (const col of columns) {
          const textHeight = doc.heightOfString(values[col.key] ?? '', { width: col.width - cellPadding });
          maxCellHeight = Math.max(maxCellHeight, textHeight + cellPadding * 2);
        }

        // Check if we need a new page
        if (y + maxCellHeight > doc.page.height - 50) {
          doc.addPage();
          y = 50;

          // Redraw header on new page
          doc.fontSize(9).font('Helvetica-Bold');
          x = tableLeft;
          for (const col of columns) {
            doc.text(col.header, x, y, { width: col.width, ellipsis: true });
            x += col.width;
          }
          y += rowHeight - 4;
          doc.moveTo(tableLeft, y).lineTo(tableLeft + columns.reduce((s, c) => s + c.width, 0), y).stroke();
          y += 6;
          doc.font('Helvetica').fontSize(8);
        }

        x = tableLeft;
        for (const col of columns) {
          doc.text(values[col.key] ?? '', x, y, { width: col.width - cellPadding });
          x += col.width;
        }

        y += maxCellHeight;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
