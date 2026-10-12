'use strict';
// 07 · Media metadata privacy pipeline — real JPEG EXIF scrubber (pure Node).
// Removes APP1/APP13 metadata segments (EXIF/IPTC incl. GPS/device data),
// keeps image data intact. Source attribution must be preserved out-of-band.
function stripJpegExif(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8)
    throw Object.assign(new Error('not a JPEG (SOI missing)'), { code: 400 });
  const out = [buf.subarray(0, 2)];
  let pos = 2, stripped = 0, bytes = 0;
  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) break;
    const marker = buf[pos + 1];
    if (marker === 0xda || marker === 0xd9) { out.push(buf.subarray(pos)); break; } // SOS/EOI: rest is image data
    const len = buf.readUInt16BE(pos + 2);
    if (marker === 0xe1 || marker === 0xed) { stripped++; bytes += len + 2; } // APP1 EXIF / APP13 IPTC -> drop
    else out.push(buf.subarray(pos, pos + 2 + len));
    pos += 2 + len;
  }
  return { data: Buffer.concat(out), segments_removed: stripped, bytes_removed: bytes };
}

module.exports = {
  meta: { area: '07', id: 'metadata_shredder', name: 'Media metadata privacy pipeline', state: 'live' },
  stripJpegExif,
  status: () => ({ formats: ['jpeg (APP1/APP13 removal)'], note: 'never erase source attribution or rights evidence; keep it in the database, not the file' }),
  actions: {
    // payload: { base64: "<jpeg bytes>" } -> { base64, segments_removed, bytes_removed }
    strip(p) {
      if (!p || typeof p.base64 !== 'string') throw Object.assign(new Error('base64 JPEG payload required'), { code: 400 });
      const res = stripJpegExif(Buffer.from(p.base64, 'base64'));
      return { base64: res.data.toString('base64'), segments_removed: res.segments_removed, bytes_removed: res.bytes_removed };
    },
    status: () => module.exports.status(),
  },
};
