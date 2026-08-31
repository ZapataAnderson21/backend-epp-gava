import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { PettyCashLabelEs } from 'src/petty-cash/enum';

@Injectable()
export class ExcelService {
  private readonly logger = new Logger('ExcelService');

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Genera el catálogo de recursos disponibles para órdenes de compra.
   */
  async generateResourcesExcel(): Promise<Buffer> {
    this.logger.log('Generating purchase order resources Excel');

    const resources = await this.prismaService.resource.findMany({
      where: { deletedAt: null },
      include: { categoryResource: true },
      orderBy: [{ categoryResourceId: 'asc' }, { name: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIR GAVA';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Recursos');
    sheet.properties.defaultRowHeight = 22;
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
    sheet.autoFilter = 'A3:E3';
    sheet.columns = [
      { key: 'item', width: 8 },
      { key: 'name', width: 30 },
      { key: 'description', width: 50 },
      { key: 'category', width: 28 },
      { key: 'unit', width: 16 },
    ];

    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'RECURSOS DE ÓRDENES DE COMPRA';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0047A3' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:E2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Generado el ${this.formatDateEs(new Date())}`;
    subtitleCell.font = { italic: true, color: { argb: 'FF4B5563' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = sheet.getRow(3);
    headerRow.values = ['ITEM', 'NOMBRE', 'DESCRIPCIÓN', 'CATEGORÍA', 'UNIDAD'];
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF008080' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = this.thinBorder();
    });

    resources.forEach((resource, index) => {
      const row = sheet.addRow({
        item: index + 1,
        name: resource.name,
        description: resource.description ?? '',
        category: resource.categoryResource?.name ?? 'Sin categoría',
        unit: resource.unit,
      });

      row.eachCell((cell, columnNumber) => {
        cell.alignment = {
          horizontal: columnNumber === 1 ? 'center' : 'left',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = this.thinBorder();
        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F7FB' },
          };
        }
      });
    });

    sheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    };
    sheet.headerFooter.oddFooter =
      '&LRecursos de órdenes de compra&C&P de &N&RGenerado por SIR GAVA';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private thinBorder(): Partial<ExcelJS.Borders> {
    return {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  }

  /**
   * Genera un Excel con el detalle de caja chica de un proyecto.
   */
  async generatePettyCashExcel(projectId: number): Promise<Buffer> {
    this.logger.log(`Generating petty cash Excel for projectId=${projectId}`);

    const project = await this.prismaService.project.findUnique({
      where: { projectId },
      select: {
        name: true,
        code: true,
        pettyCashes: {
          orderBy: [{ expenseDate: 'desc' }],
        },
      },
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Caja chica');
    sheet.properties.defaultRowHeight = 22;

    sheet.columns = [
      { key: 'item', width: 8 },
      { key: 'expenseDate', width: 14 },
      { key: 'expenseType', width: 22 },
      { key: 'invoiceNumber', width: 18 },
      { key: 'description', width: 50 },
      { key: 'amount', width: 16 },
    ];

    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `DETALLE DE CAJA CHICA - ${project.name.toUpperCase()}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('A2:F2');
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `Codigo: ${project.code}`;
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const headerRow = sheet.getRow(4);
    headerRow.values = [
      'ITEM',
      'FECHA',
      'TIPO',
      'COMPROBANTE',
      'DESCRIPCION',
      'MONTO S/.',
    ];
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF008080' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    let currentRow = 5;
    for (const [index, pettyCash] of project.pettyCashes.entries()) {
      const row = sheet.getRow(currentRow);
      row.values = [
        index + 1,
        this.formatDateEs(pettyCash.expenseDate),
        PettyCashLabelEs[pettyCash.expenseType],
        pettyCash.invoiceNumber || '',
        pettyCash.description,
        Number(pettyCash.amount),
      ];

      row.eachCell((cell, colNumber) => {
        cell.alignment = {
          horizontal: colNumber === 5 ? 'left' : 'center',
          vertical: 'middle',
          wrapText: colNumber === 5,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });

      row.getCell(6).numFmt = '#,##0.00';
      currentRow++;
    }

    const totalRow = sheet.getRow(currentRow);
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const totalLabelCell = sheet.getCell(`A${currentRow}`);
    totalLabelCell.value = 'TOTAL S/.';
    totalLabelCell.font = { bold: true };
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const totalAmountCell = totalRow.getCell(6);
    totalAmountCell.value = {
      formula:
        project.pettyCashes.length > 0 ? `SUM(F5:F${currentRow - 1})` : '0',
      result: project.pettyCashes.reduce(
        (sum, pettyCash) => sum + Number(pettyCash.amount),
        0,
      ),
    };
    totalAmountCell.numFmt = '#,##0.00';
    totalAmountCell.font = { bold: true };

    totalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Formatea una fecha como dd/mm/yyyy en zona horaria de Lima.
   */
  private formatDateEs(date: Date): string {
    return new Date(date).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Lima',
    });
  }
}
