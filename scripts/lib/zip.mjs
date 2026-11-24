// Minimal zip writer and reader on node:zlib only (no dependency: Node has no built-in zip, and the
// offline zip holds a single file, so ~50 lines beat adding archiver/fflate). Limits: no zip64
// (entries and archive under 4 GB), no encryption, UTF-8 names, entries are deflated or stored.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

/** files: [{ name, data: Buffer }] -> Buffer */
export function writeZip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    for (const { name, data } of files) {
        const nameBuf = Buffer.from(name, 'utf8');
        const packed = deflateRawSync(data, { level: 9 });
        const crc = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0x0800, 6); // flag: UTF-8 names
        local.writeUInt16LE(8, 8); // method: deflate
        local.writeUInt16LE(0x0021, 12); // dos date: 1980-01-01 (reproducible)
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        chunks.push(local, nameBuf, packed);
        const c = Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50, 0);
        c.writeUInt16LE(20, 4);
        c.writeUInt16LE(20, 6);
        c.writeUInt16LE(0x0800, 8);
        c.writeUInt16LE(8, 10);
        c.writeUInt16LE(0x0021, 14);
        c.writeUInt32LE(crc, 16);
        c.writeUInt32LE(packed.length, 20);
        c.writeUInt32LE(data.length, 24);
        c.writeUInt16LE(nameBuf.length, 28);
        c.writeUInt32LE(offset, 42);
        central.push(c, nameBuf);
        offset += local.length + nameBuf.length + packed.length;
    }
    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...chunks, centralBuf, end]);
}

/** Buffer -> [{ name, data: Buffer }]; throws on a CRC mismatch. */
export function readZip(buf) {
    let eocd = buf.length - 22;
    while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('not a zip file');
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out = [];
    for (let i = 0; i < count; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
        const method = buf.readUInt16LE(p + 10);
        const crc = buf.readUInt32LE(p + 16);
        const csize = buf.readUInt32LE(p + 20);
        const nlen = buf.readUInt16LE(p + 28);
        const elen = buf.readUInt16LE(p + 30);
        const clen = buf.readUInt16LE(p + 32);
        const lho = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nlen);
        const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
        const raw = buf.subarray(dataStart, dataStart + csize);
        const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
        if (crc32(data) !== crc) throw new Error(`crc mismatch: ${name}`);
        out.push({ name, data });
        p += 46 + nlen + elen + clen;
    }
    return out;
}
