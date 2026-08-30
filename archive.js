(function initializeArchiveTools(global) {
  "use strict";

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const crcTable = buildCrcTable();

  async function readZip(file, limits = {}) {
    const maxFiles = limits.maxFiles || 1000;
    const maxBytes = limits.maxBytes || 100 * 1024 * 1024;
    const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
    const view = new DataView(buffer);
    const eocd = findEndOfCentralDirectory(view);
    const count = view.getUint16(eocd + 10, true);
    const centralOffset = view.getUint32(eocd + 16, true);
    if (count > maxFiles) throw new Error(`压缩包包含 ${count} 个文件，超过 ${maxFiles} 个文件的限制`);

    const entries = new Map();
    let offset = centralOffset;
    let totalBytes = 0;
    for (let index = 0; index < count; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP 中央目录损坏");
      const method = view.getUint16(offset + 10, true);
      const expectedCrc = view.getUint32(offset + 16, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const size = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      if ([compressedSize, size, localOffset].includes(0xffffffff)) throw new Error("暂不支持 ZIP64 压缩包");
      const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)).replaceAll("\\", "/");
      offset += 46 + nameLength + extraLength + commentLength;
      if (name.endsWith("/")) continue;
      assertSafePath(name);
      totalBytes += size;
      if (totalBytes > maxBytes) throw new Error(`解压后文件超过 ${Math.round(maxBytes / 1024 / 1024)} MB 限制`);
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`文件 ${name} 的本地头损坏`);
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = new Uint8Array(buffer, dataOffset, compressedSize);
      const bytes = method === 0 ? new Uint8Array(compressed) : method === 8
        ? await inflateRaw(compressed)
        : (() => { throw new Error(`文件 ${name} 使用了不支持的压缩方法 ${method}`); })();
      if (bytes.byteLength !== size) throw new Error(`文件 ${name} 的解压大小不一致`);
      if (crc32(bytes) !== expectedCrc) throw new Error(`文件 ${name} 的完整性校验失败`);
      entries.set(name, bytes);
    }
    return entries;
  }

  function createZip(entries) {
    const normalized = [...entries].map(([name, value]) => {
      assertSafePath(name);
      const bytes = typeof value === "string" ? encoder.encode(value) : value;
      return { name: name.replaceAll("\\", "/"), nameBytes: encoder.encode(name.replaceAll("\\", "/")), bytes, crc: crc32(bytes) };
    });
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    for (const entry of normalized) {
      const local = new Uint8Array(30 + entry.nameBytes.length + entry.bytes.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(8, 0, true);
      localView.setUint32(14, entry.crc, true);
      localView.setUint32(18, entry.bytes.length, true);
      localView.setUint32(22, entry.bytes.length, true);
      localView.setUint16(26, entry.nameBytes.length, true);
      local.set(entry.nameBytes, 30);
      local.set(entry.bytes, 30 + entry.nameBytes.length);
      localParts.push(local);

      const central = new Uint8Array(46 + entry.nameBytes.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint32(16, entry.crc, true);
      centralView.setUint32(20, entry.bytes.length, true);
      centralView.setUint32(24, entry.bytes.length, true);
      centralView.setUint16(28, entry.nameBytes.length, true);
      centralView.setUint32(42, localOffset, true);
      central.set(entry.nameBytes, 46);
      centralParts.push(central);
      localOffset += local.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, normalized.length, true);
    endView.setUint16(10, normalized.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, localOffset, true);
    return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
  }

  function findEndOfCentralDirectory(view) {
    const minimum = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error("不是有效的 ZIP 文件，或压缩包目录不完整");
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") throw new Error("当前浏览器不支持 ZIP 解压，请改用文件夹上传");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function assertSafePath(path) {
    const normalized = String(path).replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || normalized.split("/").includes("..")) {
      throw new Error(`发现不安全的文件路径：${path}`);
    }
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildCrcTable() {
    return Array.from({ length: 256 }, (_, value) => {
      let crc = value;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      return crc >>> 0;
    });
  }

  global.CognitionArchive = Object.freeze({ readZip, createZip, crc32, assertSafePath });
})(window);
