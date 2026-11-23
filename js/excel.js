/* ============================================================
   js/excel.js — generador de archivos .xlsx SIN librerías
   Escribe un ZIP sin compresión ("stored") + el XML mínimo que
   exige el formato Office Open XML. Compatible con Excel/LibreOffice.
   ============================================================ */

(function () {
  "use strict";

  /* ---- CRC32 (tabla) ---- */
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const ENC = new TextEncoder();

  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      /* caracteres de control prohibidos en XML */
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  }

  /* 0 -> A, 25 -> Z, 26 -> AA ... */
  function colRef(i) {
    let s = "";
    i++;
    while (i > 0) {
      const m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  /* Estilos de celda: 1 = con borde, 2 = borde + negrita, 3 = borde + negrita + derecha */
  function styleOf(val) {
    if (val && typeof val === "object") {
      if (val.b && val.r) return 3;
      if (val.b) return 2;
    }
    return 1;
  }

  function cellValue(val) {
    return val && typeof val === "object" ? val.v : val;
  }

  /* Anchos de columna calculados del contenido: el texto nunca se corta */
  function colsXml(headers, rows) {
    const all = [headers].concat(rows);
    let n = 0;
    all.forEach(function (f) { n = Math.max(n, f.length); });
    let xml = "<cols>";
    for (let c = 0; c < n; c++) {
      let maxLen = 0;
      all.forEach(function (fila) {
        const txt = String(cellValue(fila[c]) == null ? "" : cellValue(fila[c]));
        if (txt.length > maxLen) maxLen = txt.length;
      });
      const w = Math.min(Math.max(maxLen + 3, 6), 80);
      xml += '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + w + '" customWidth="1"/>';
    }
    return xml + "</cols>";
  }

  /* Hoja de estilos: borde fino en todas las celdas + negrita */
  const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    "</fonts>" +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="2">' +
    "<border><left/><right/><top/><bottom/><diagonal/></border>" +
    '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right>' +
    '<top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>' +
    "</borders>" +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  /* XML de la hoja: encabezados + filas (número = celda numérica).
     Un valor { v, b: true, r: true } marca celda en negrita y alineada a la derecha. */
  function sheetXml(headers, rows) {
    const all = [headers].concat(rows);
    let xml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      colsXml(headers, rows) +
      "<sheetData>";
    all.forEach(function (fila, r) {
      xml += '<row r="' + (r + 1) + '">';
      fila.forEach(function (val, c) {
        const ref = colRef(c) + (r + 1);
        const v = cellValue(val);
        const s = styleOf(val);
        if (typeof v === "number" && isFinite(v)) {
          xml += '<c r="' + ref + '" s="' + s + '"><v>' + v + "</v></c>";
        } else {
          xml += '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' +
            xmlEsc(v) + "</t></is></c>";
        }
      });
      xml += "</row>";
    });
    xml += "</sheetData></worksheet>";
    return xml;
  }

  /* ZIP "stored" (método 0): cabeceras locales + central + EOCD */
  function zipStore(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = ((((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff);

    files.forEach(function (f) {
      const nameB = ENC.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;

      const local = new Uint8Array(30 + nameB.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);  /* PK.. firma local */
      lv.setUint16(4, 20, true);          /* versión requerida */
      lv.setUint16(6, 0, true);           /* flags */
      lv.setUint16(8, 0, true);           /* método: stored */
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameB.length, true);
      lv.setUint16(28, 0, true);          /* extra */
      local.set(nameB, 30);
      chunks.push(local, f.data);

      const cen = new Uint8Array(46 + nameB.length);
      const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true);  /* firma central */
      cv.setUint16(4, 20, true);          /* hecho por */
      cv.setUint16(6, 20, true);          /* requerido */
      cv.setUint16(8, 0, true);           /* flags */
      cv.setUint16(10, 0, true);          /* método */
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameB.length, true);
      cv.setUint32(42, offset, true);     /* offset cabecera local */
      cen.set(nameB, 46);
      central.push(cen);

      offset += local.length + size;
    });

    const cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);    /* fin del directorio */
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    const out = new Uint8Array(offset + cdSize + 22);
    let pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    central.forEach(function (c) { out.set(c, pos); pos += c.length; });
    out.set(eocd, pos);
    return out;
  }

  function buildXlsx(sheetName, headers, rows) {
    const nombre = String(sheetName || "Hoja1")
      .replace(/[[\]:*?/\\]/g, " ")
      .slice(0, 31) || "Hoja1";

    const files = [
      {
        name: "[Content_Types].xml",
        data: ENC.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          "</Types>")
      },
      {
        name: "_rels/.rels",
        data: ENC.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>")
      },
      {
        name: "xl/workbook.xml",
        data: ENC.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="' + xmlEsc(nombre) + '" sheetId="1" r:id="rId1"/></sheets>' +
          "</workbook>")
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: ENC.encode(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          "</Relationships>")
      },
      { name: "xl/styles.xml", data: ENC.encode(STYLES_XML) },
      { name: "xl/worksheets/sheet1.xml", data: ENC.encode(sheetXml(headers, rows)) }
    ];
    return zipStore(files);
  }

  /* Descarga el archivo .xlsx */
  function descargar(nombreArchivo, hoja, headers, rows) {
    const bytes = buildXlsx(hoja, headers, rows);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = String(nombreArchivo || "reporte.xlsx").replace(/[^\w.\-]+/g, "_");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return bytes.length;
  }

  /* Fecha para nombres de archivo: 2026-11-21 */
  function fechaArchivo(d) {
    d = d || new Date();
    const p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  window.Excel = { descargar: descargar, fechaArchivo: fechaArchivo, buildXlsx: buildXlsx };
})();
