import { inflate as inflateCallback } from 'node:zlib';
import { promisify } from 'node:util';
import { BadRequestException } from '@nestjs/common';

const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const inflate = promisify(inflateCallback);
const MAX_DIMENSION = 2048;
const MAX_PIXELS = 4_000_000;
const MAX_DECOMPRESSED_BYTES = MAX_PIXELS * 4 + MAX_DIMENSION;

export interface ValidatedPng {
  width: number;
  height: number;
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function validateSignaturePng(
  bytes: Buffer,
): Promise<ValidatedPng> {
  const invalid = () =>
    new BadRequestException('El archivo de firma PNG no es válido.');
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 45 ||
    !bytes.subarray(0, 8).equals(PNG_MAGIC)
  )
    throw invalid();
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let bitDepth = -1;
  let sawHeader = false;
  let sawPalette = false;
  let sawData = false;
  let dataEnded = false;
  let sawEnd = false;
  const idat: Buffer[] = [];

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw invalid();
    const size = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > bytes.length) throw invalid();
    const type = bytes.toString('ascii', typeStart, dataStart);
    const data = bytes.subarray(dataStart, dataEnd);
    if (
      crc32(bytes.subarray(typeStart, dataEnd)) !== bytes.readUInt32BE(dataEnd)
    )
      throw invalid();

    if (!sawHeader) {
      if (type !== 'IHDR' || size !== 13) throw invalid();
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      const compression = data[10],
        filter = data[11],
        interlace = data[12];
      if (
        !width ||
        !height ||
        width > MAX_DIMENSION ||
        height > MAX_DIMENSION ||
        width * height > MAX_PIXELS ||
        colorType !== 6 ||
        bitDepth !== 8 ||
        compression !== 0 ||
        filter !== 0 ||
        interlace !== 0
      )
        throw invalid();
      sawHeader = true;
    } else if (type === 'IHDR') {
      throw invalid();
    } else if (type === 'PLTE') {
      if (sawData || size === 0 || size > 768 || size % 3 !== 0)
        throw invalid();
      sawPalette = true;
    } else if (type === 'IDAT') {
      if (dataEnded || (colorType === 3 && !sawPalette)) throw invalid();
      sawData = true;
      idat.push(data);
    } else {
      if (sawData) dataEnded = true;
      if (type === 'IEND') {
        if (size !== 0 || !sawData || chunkEnd !== bytes.length)
          throw invalid();
        sawEnd = true;
        offset = chunkEnd;
        break;
      }
      // Unknown critical chunks are not safely interpretable.
      if ((bytes[typeStart] & 0x20) === 0 && type !== 'tRNS') throw invalid();
    }
    offset = chunkEnd;
  }
  if (!sawHeader || !sawEnd) throw invalid();
  const rowBytes = width * 4;
  const expectedBytes = height * (rowBytes + 1);
  if (expectedBytes > MAX_DECOMPRESSED_BYTES) throw invalid();
  try {
    const raw = await inflate(Buffer.concat(idat), {
      maxOutputLength: expectedBytes,
    });
    if (raw.length !== expectedBytes) throw invalid();
    for (let row = 0; row < height; row++)
      if (raw[row * (rowBytes + 1)] > 4) throw invalid();
  } catch {
    throw invalid();
  }
  return { width, height };
}
