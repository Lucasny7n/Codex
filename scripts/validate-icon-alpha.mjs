import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const iconDir = join(root, 'src-tauri/icons');
const icons = ['32x32.png', '128x128.png', '128x128@2x.png', '256x256.png', '512x512.png'];

for (const icon of icons) {
  const result = inspectPngAlpha(join(iconDir, icon));
  if (!result.hasAlphaChannel) {
    throw new Error(`${icon} não tem canal alpha RGBA/GA.`);
  }
  if (!result.hasTransparentPixel) {
    throw new Error(`${icon} tem canal alpha, mas nenhum pixel transparente foi encontrado.`);
  }
  console.log(`${icon}: alpha ok (${result.width}x${result.height}, ${result.bitDepth}-bit)`);
}

function inspectPngAlpha(path) {
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`${path} não é PNG válido.`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
  if (!channels || (bitDepth !== 8 && bitDepth !== 16)) {
    return { width, height, bitDepth, hasAlphaChannel: false, hasTransparentPixel: false };
  }

  const sampleBytes = bitDepth / 8;
  const bytesPerPixel = channels * sampleBytes;
  const rowBytes = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idat));
  const previous = Buffer.alloc(rowBytes);
  let sourceOffset = 0;
  let hasTransparentPixel = false;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + rowBytes));
    sourceOffset += rowBytes;
    unfilter(row, previous, bytesPerPixel, filter);

    const alphaOffset = (channels - 1) * sampleBytes;
    for (let x = alphaOffset; x < row.length; x += bytesPerPixel) {
      const alpha = sampleBytes === 1 ? row[x] : row.readUInt16BE(x);
      if (alpha < (sampleBytes === 1 ? 255 : 65535)) {
        hasTransparentPixel = true;
        break;
      }
    }
    row.copy(previous);
    if (hasTransparentPixel) break;
  }

  return { width, height, bitDepth, hasAlphaChannel: true, hasTransparentPixel };
}

function unfilter(row, previous, bytesPerPixel, filter) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    if (filter === 1) {
      row[index] = (row[index] + left) & 0xff;
    } else if (filter === 2) {
      row[index] = (row[index] + up) & 0xff;
    } else if (filter === 3) {
      row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      row[index] = (row[index] + paeth(left, up, upLeft)) & 0xff;
    } else if (filter !== 0) {
      throw new Error(`Filtro PNG não suportado: ${filter}`);
    }
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  if (distanceUp <= distanceUpLeft) return up;
  return upLeft;
}
