///
/// EarthBrowser
///
/// Created by Matt Giger on 2/26/2024
/// Copyright (c) 2024 Geodata Labs
///

import { inflateRawSync } from 'zlib'

export class ZipArchive {
    public files: ZipEntry[] = []
    public dirs: ZipDirectory[] = []

    constructor(buffer: ArrayBuffer) {
        const view: DataView = new DataView(buffer)

        let eod: ZipDirectoryEnd | null = null
        let index: number = 0
        let bail = false
        while(!eod && !bail) {
            const signature = view.getUint32(index, true)
            if (signature === 0x04034b50) {
                const ent = new ZipEntry(view, index)
                ent.startsAt = index + 30 + ent.fileNameLength + ent.extraLength
                this.files.push(ent)
                index = ent.startsAt + ent.compressedSize
            } else if (signature === 0x02014b50){
                const dir = new ZipDirectory(view, index)
                this.dirs.push(dir)
                index += 46 + dir.fileNameLength + dir.extraLength + dir.fileCommentLength
            } else if (signature === 0x06054b50) {
                eod = new ZipDirectoryEnd(view, index)
            } else {
                bail = true
            }
        }
    }
}

export class ZipEntry {
    public signature: string
    public version: number
    public generalPurpose: number
    public compressionMethod: number
    public lastModifiedTime: number
    public lastModifiedDate: number
    public crc: number
    public compressedSize: number
    public uncompressedSize: number
    public fileNameLength: number
    public fileName: string
    public extraLength: number
    public extra?: Uint8Array
    public startsAt: number = 0
    private data: DataView

    constructor(data: DataView, offset: number) {
        this.data = data
        this.signature = readString(data, offset, 4)
        this.version = data.getUint16(offset + 4, true)
        this.generalPurpose = data.getUint16(offset + 6, true)
        this.compressionMethod = data.getUint16(offset + 8, true)
        this.lastModifiedTime = data.getUint16(offset + 10, true)
        this.lastModifiedDate = data.getUint16(offset + 12, true)
        this.crc = data.getUint32(offset + 14, true)
        this.compressedSize = data.getUint32(offset + 18, true)
        this.uncompressedSize = data.getUint32(offset + 22, true)
        this.fileNameLength = data.getUint16(offset + 26, true)
        this.extraLength = data.getUint16(offset + 28, true)
        this.fileName = readString(data, offset + 30, this.fileNameLength)
        this.extra = new Uint8Array(data.buffer, offset + 30 + this.fileNameLength, this.extraLength)
    }

    public extract(): Uint8Array {
        const buffer = this.data.buffer.slice(this.startsAt, this.startsAt + this.compressedSize)
        if(this.compressionMethod === 0x00) {
            return new Uint8Array(buffer)
        } else if(this.compressionMethod === 0x08) {
			return inflateRawSync(buffer)
        }

		return new Uint8Array(0)
    }
}

export class ZipDirectory {
    public signature: string
    public versionCreated: number
    public versionNeeded: number
    public generalPurpose: number
    public compressionMethod: number
    public lastModifiedTime: number
    public lastModifiedDate: number
    public crc: number
    public compressedSize: number
    public uncompressedSize: number
    public fileNameLength: number
    public extraLength: number
    public fileCommentLength: number
    public diskNumber: number
    public internalAttributes: number
    public externalAttributes: number
    public offset: number
    public fileName: string
    public extra: string
    public comments: string

    constructor(data: DataView, offset: number) {
        this.signature = readString(data, offset, 4)
        this.versionCreated = data.getUint16(offset + 4, true)
        this.versionNeeded = data.getUint16(offset + 6, true)
        this.generalPurpose = data.getUint16(offset + 8, true)
        this.compressionMethod = data.getUint16(offset + 10, true)
        this.lastModifiedTime = data.getUint16(offset + 12, true)
        this.lastModifiedDate = data.getUint16(offset + 14, true)
        this.crc = data.getUint32(offset + 16, true)
        this.compressedSize = data.getUint32(offset + 20, true)
        this.uncompressedSize = data.getUint32(offset + 24, true)
        this.fileNameLength = data.getUint16(offset + 28, true)
        this.extraLength = data.getUint16(offset + 30, true)
        this.fileCommentLength = data.getUint16(offset + 32, true)
        this.diskNumber = data.getUint16(offset + 34, true)
        this.internalAttributes = data.getUint16(offset + 36, true)
        this.externalAttributes = data.getUint32(offset + 38, true)
        this.offset = data.getUint32(42, true)
        this.fileName = readString(data, offset + 46, this.fileNameLength)
        this.extra = readString(data, offset + 46 + this.fileNameLength, this.extraLength)
        this.comments = readString(data, offset + 46 + this.fileNameLength + this.extraLength, this.fileCommentLength)
    }
}

class ZipDirectoryEnd {
    public signature: string
    public numberOfDisks: number
    public centralDirectoryStartDisk: number
    public numberCentralDirectoryRecordsOnThisDisk: number
    public numberCentralDirectoryRecords: number
    public centralDirectorySize: number
    public centralDirectoryOffset: number
    public commentLength: number
    public comment: string

    constructor(data: DataView, offset: number) {
        this.signature = readString(data, offset, 4)
        this.numberOfDisks = data.getUint16(offset + 4, true)
        this.centralDirectoryStartDisk = data.getUint16(offset + 6, true)
        this.numberCentralDirectoryRecordsOnThisDisk = data.getUint16(offset + 8, true)
        this.numberCentralDirectoryRecords = data.getUint16(offset + 10, true)
        this.centralDirectorySize = data.getUint32(offset + 12, true)
        this.centralDirectoryOffset = data.getUint32(offset + 16, true)
        this.commentLength = data.getUint16(offset + 20, true)
        this.comment = readString(data, offset + 22, this.commentLength)
    }
}

const  utf8decoder = new TextDecoder('utf8')

function readString(data: DataView, offset: number, length: number): string {
    const bytes = new Uint8Array(data.buffer, offset, length)
    const value = utf8decoder.decode(bytes)
    return value
}
