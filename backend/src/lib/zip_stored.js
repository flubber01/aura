'use strict';
// AURA — kleines ZIP-Werkzeug: gespeicherte (0) und deflate (8) Einträge.
// Ein Modul, damit Bundles (Downloads) und der Modul-Import nicht zweimal
// dasselbe Rad erfinden. Kein Fremdpaket, keine Abhängigkeit.

const zlib = require('zlib');

let crcTable = null;
function crc32(data) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let i = 0; i < 8; i++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(date) { return ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xffff; }
function dosDate(date) { return (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff; }
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xffff); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

// entries: [{ name, data: Buffer, compress?: boolean }] → ZIP als Buffer
function pack(entries, options) {
  const when = (options && options.date) || new Date();
  const tm = dosTime(when); const dt = dosDate(when);
  const local = []; const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const crc = crc32(raw);
    const body = entry.compress ? zlib.deflateRawSync(raw) : raw;
    const method = entry.compress ? 8 : 0;
    const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(tm), u16(dt), u32(crc), u32(body.length), u32(raw.length), u16(name.length), u16(0), name]);
    local.push(head, body);
    central.push(Buffer.concat([u32(0x02014b50), u16(0x031e), u16(20), u16(0x0800), u16(method), u16(tm), u16(dt), u32(crc), u32(body.length), u32(raw.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += head.length + body.length;
  }
  const directory = Buffer.concat(central);
  return Buffer.concat([...local, directory, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
}

// ZIP → { ok, errors[], entries: [{ rel, content: Buffer }] }
// Prüft Prüfsumme und Größe je Eintrag. Pfade werden NICHT bewertet — das macht der Aufrufer.
function unpack(buffer) {
  const errors = [];
  const entries = [];
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) return { ok: false, errors: ['kein ZIP (zu kurz)'], entries };
  let eocd = -1;
  const scanFrom = Math.max(0, buffer.length - 65557 - 22);
  for (let i = buffer.length - 22; i >= scanFrom; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return { ok: false, errors: ['kein ZIP-Archiv erkannt (Ende-Verzeichnis fehlt)'], entries };

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < count; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) { errors.push('Zentralverzeichnis beschädigt'); break; }
    const method = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compSize = buffer.readUInt32LE(offset + 20);
    const uncompSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.subarray(offset + 46, offset + 46 + nameLen).toString('utf8');
    offset += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith('/')) continue;
    if (method !== 0 && method !== 8) { errors.push(`"${rawName}": Kompressionsverfahren ${method} nicht unterstützt`); continue; }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) { errors.push(`"${rawName}": lokaler Kopf beschädigt`); continue; }
    const lNameLen = buffer.readUInt16LE(localOffset + 26);
    const lExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compSize);
    let content;
    try { content = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed); }
    catch (e) { errors.push(`"${rawName}": nicht entpackbar (${e.message})`); continue; }
    if (content.length !== uncompSize) { errors.push(`"${rawName}": Größe stimmt nicht`); continue; }
    if (crc32(content) !== crc) { errors.push(`"${rawName}": Prüfsumme stimmt nicht`); continue; }
    entries.push({ rel: rawName, content, bytes: content.length, method });
  }
  return { ok: errors.length === 0, errors, entries };
}

module.exports = { pack, unpack, crc32 };
