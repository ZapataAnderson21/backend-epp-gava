declare module 'pdfmake/src/printer' {
  import type {
    TFontDictionary,
  } from 'pdfmake/interfaces';

  class PdfPrinter {
    constructor(fontDescriptors: TFontDictionary);

    createPdfKitDocument(
      documentDefinitions: object,
      options?: Record<string, unknown>,
    ): PDFKit.PDFDocument;
  }

  export = PdfPrinter;
}
