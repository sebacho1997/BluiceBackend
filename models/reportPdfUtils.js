const PdfPrinter = require('pdfmake');

function createPrinter() {
  const fonts = {
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  };

  return new PdfPrinter(fonts);
}

function formatCurrency(value) {
  return `Bs${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-BO');
}

function buildSummaryTable(metrics, columns = 3) {
  const rows = [];

  for (let i = 0; i < metrics.length; i += columns) {
    const slice = metrics.slice(i, i + columns);
    while (slice.length < columns) {
      slice.push({ label: '', value: '', tone: 'muted' });
    }

    rows.push(
      slice.map((metric) => ({
        stack: [
          { text: metric.label, style: 'metricLabel' },
          { text: metric.value, style: metric.style || 'metricValue' },
          metric.helper ? { text: metric.helper, style: 'metricHelper' } : ''
        ].filter(Boolean),
        fillColor: metric.tone === 'danger'
          ? '#FDECEC'
          : metric.tone === 'warning'
            ? '#FFF3E0'
            : metric.tone === 'success'
              ? '#EAF7EE'
              : '#F7F9FC',
        margin: [8, 10, 8, 10]
      }))
    );
  }

  return {
    table: {
      widths: new Array(columns).fill('*'),
      body: rows
    },
    layout: {
      hLineColor: () => '#D9E2EC',
      vLineColor: () => '#D9E2EC',
      hLineWidth: () => 1,
      vLineWidth: () => 1
    },
    margin: [0, 8, 0, 16]
  };
}

function buildDataTable(headers, rows, widths) {
  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        headers.map((header) => ({ text: header, style: 'tableHeader' })),
        ...rows
      ]
    },
    layout: {
      fillColor: (rowIndex) => (rowIndex === 0 ? '#DCEBFA' : rowIndex % 2 === 0 ? '#F8FAFC' : null),
      hLineColor: () => '#D9E2EC',
      vLineColor: () => '#D9E2EC',
      hLineWidth: () => 1,
      vLineWidth: () => 1
    },
    margin: [0, 6, 0, 14]
  };
}

function sectionTitle(text) {
  return { text, style: 'sectionTitle', margin: [0, 14, 0, 6] };
}

function divider() {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 1, lineColor: '#D9E2EC' }],
    margin: [0, 8, 0, 8]
  };
}

function buildDocDefinition({ title, subtitleLines = [], content, orientation = 'landscape' }) {
  return {
    pageSize: 'A4',
    pageOrientation: orientation,
    pageMargins: [36, 42, 36, 38],
    footer: (currentPage, pageCount) => ({
      margin: [36, 0, 36, 16],
      columns: [
        { text: `Generado: ${new Date().toLocaleString('es-BO')}`, style: 'footerText' },
        { text: `Pagina ${currentPage} de ${pageCount}`, alignment: 'right', style: 'footerText' }
      ]
    }),
    content: [
      { text: title, style: 'header', alignment: 'center' },
      ...(subtitleLines.length
        ? [{ text: subtitleLines.join('\n'), style: 'subHeader', alignment: 'center', margin: [0, 4, 0, 10] }]
        : []),
      ...content
    ],
    styles: {
      header: { fontSize: 20, bold: true, color: '#0F4C81' },
      subHeader: { fontSize: 11, color: '#52606D' },
      sectionTitle: { fontSize: 13, bold: true, color: '#102A43' },
      metricLabel: { fontSize: 9, color: '#52606D', bold: true },
      metricValue: { fontSize: 16, bold: true, color: '#102A43', margin: [0, 4, 0, 0] },
      metricHelper: { fontSize: 8, color: '#7B8794', margin: [0, 4, 0, 0] },
      blockTitle: { fontSize: 11, bold: true, color: '#102A43' },
      blockMeta: { fontSize: 9, color: '#52606D' },
      tableHeader: { bold: true, color: '#102A43', fontSize: 9 },
      smallText: { fontSize: 9, color: '#243B53' },
      emphasis: { fontSize: 10, bold: true, color: '#102A43' },
      dangerText: { fontSize: 10, bold: true, color: '#B42318' },
      successText: { fontSize: 10, bold: true, color: '#127A3F' },
      footerText: { fontSize: 8, color: '#7B8794' }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };
}

module.exports = {
  createPrinter,
  formatCurrency,
  formatDate,
  buildSummaryTable,
  buildDataTable,
  buildDocDefinition,
  sectionTitle,
  divider
};
