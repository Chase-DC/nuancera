/*
 * exporters.js — turn a palette (array of hex strings) into export payloads.
 *
 *   toHexList  -> plain text, one #rrggbb per line
 *   toJSON     -> structured JSON (hex + rgb)
 *   toGPL      -> GIMP palette format (text)
 *   toASE      -> Adobe Swatch Exchange (real BINARY format) as Uint8Array
 *   bytesToB64 -> base64 helper for binary exports through the IPC bridge
 *
 * Loads in browser (window.Exporters) and Node (module.exports) for testing.
 */
(function (root, factory) {
  const api = factory(
    typeof require !== 'undefined' ? require('./color-utils.js') : root.CE
  );
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.Exporters = api;
})(this, function (CE) {
  'use strict';

  function toHexList(hexes) {
    return hexes.map((h) => CE.normalizeHex(h) || h).join('\n') + '\n';
  }

  function toJSON(hexes, meta) {
    const palette = hexes.map((h) => {
      const rgb = CE.hexToRgb(h);
      return { hex: CE.normalizeHex(h), rgb };
    });
    return JSON.stringify({ name: (meta && meta.name) || 'Palette', colors: palette }, null, 2);
  }

  function toGPL(hexes, name) {
    const lines = ['GIMP Palette', `Name: ${name || 'Palette Studio'}`, 'Columns: 0', '#'];
    for (const h of hexes) {
      const c = CE.hexToRgb(h);
      if (!c) continue;
      const pad = (n) => String(n).padStart(3, ' ');
      lines.push(`${pad(c.r)} ${pad(c.g)} ${pad(c.b)}\t${CE.normalizeHex(h)}`);
    }
    return lines.join('\n') + '\n';
  }

  // ---- Adobe .ase (binary) --------------------------------------------------
  function toASE(hexes, name) {
    const bytes = [];
    const u8 = (v) => bytes.push(v & 0xff);
    const u16 = (v) => { u8(v >> 8); u8(v); };
    const u32 = (v) => { u8(v >>> 24); u8(v >>> 16); u8(v >>> 8); u8(v); };
    const f32 = (v) => {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, v, false); // big-endian
      const a = new Uint8Array(buf);
      u8(a[0]); u8(a[1]); u8(a[2]); u8(a[3]);
    };
    const utf16be = (str) => { for (let i = 0; i < str.length; i++) u16(str.charCodeAt(i)); };

    // Header: "ASEF", version 1.0, block count
    'ASEF'.split('').forEach((c) => u8(c.charCodeAt(0)));
    u16(1); u16(0);
    const colors = hexes.map((h) => CE.hexToRgb(h)).filter(Boolean);
    u32(colors.length);

    colors.forEach((rgb, i) => {
      const label = (CE.rgbToHex(rgb.r, rgb.g, rgb.b)).toUpperCase(); // name = hex
      const nameLen = label.length + 1; // include trailing null (chars)
      // block body bytes: nameLen(2) + name(2*nameLen) + model(4) + 3*float(12) + type(2)
      const bodyLen = 2 + nameLen * 2 + 4 + 12 + 2;
      u16(0x0001);     // color entry block
      u32(bodyLen);
      u16(nameLen);
      utf16be(label); u16(0); // null terminator
      'RGB '.split('').forEach((c) => u8(c.charCodeAt(0)));
      f32(rgb.r / 255); f32(rgb.g / 255); f32(rgb.b / 255);
      u16(2);          // color type: 2 = normal
    });

    return new Uint8Array(bytes);
  }

  function bytesToB64(uint8) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < uint8.length; i += chunk) {
      bin += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
    }
    return (typeof btoa !== 'undefined' ? btoa : (s) => Buffer.from(s, 'binary').toString('base64'))(bin);
  }

  return { toHexList, toJSON, toGPL, toASE, bytesToB64 };
});
