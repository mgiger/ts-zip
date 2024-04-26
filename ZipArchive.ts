///
/// EarthBrowser
///
/// Created by Matt Giger on 2/26/2024
/// Copyright (c) 2024 Geodata Labs
///

import { inflateRawSync } from 'zlib'

export class ZipArchive {
    public files: CentralFileHeader[] = []
	private eod: DirectoryEnd
	private view: DataView

    constructor(buffer: ArrayBuffer) {
        this.view = new DataView(buffer)

		this.eod = this.findEndOfCentralDirectory()

		let offset = this.eod.centralDirectoryOffset
		for(let i = 0; i < this.eod.numberCentralDirectoryRecords; i++) {
			const file = new CentralFileHeader(this.view, offset)
			this.files.push(file)
			offset = file.nextEntryByteOffset
		}
    }

	private findEndOfCentralDirectory(): DirectoryEnd {
		let index: number = this.view.byteLength - 22
		while(index >= 0) {
			const signature = this.view.getUint32(index, true)
			if(signature === 0x06054b50) {
				return new DirectoryEnd(this.view, index)
			} else {
				index--
			}
		}
		throw new Error('Could not find end of central directory')
	}
}

class DirectoryEnd {
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

export class CentralFileHeader {
	public data: DataView

	public signature: number
	public madeByVersion: number
	public extractVersion: number
	public generalPurposeFlags: number
	public compressionMethod: number
	public lastModifiedTime: number
	public lastModifiedDate: number
	public crc: number
	public compressedSize: number
	public uncompressedSize: number
	public fileNameLength: number
	public extraLength: number
	public commentLength: number
	public diskNumber: number
	public internalAttributes: number
	public externalAttributes: number
	public localFileHeaderOffset: number
	public nextEntryByteOffset: number

	public fileName: string
	public extra: string
	public comment: string

	constructor(data: DataView, offset: number) {
		this.data = data
		this.signature = data.getUint32(offset, true)
		this.madeByVersion = data.getUint16(offset + 4, true)
		this.extractVersion = data.getUint16(offset + 6, true)
		this.generalPurposeFlags = data.getUint16(offset + 8, true)
		this.compressionMethod = data.getUint16(offset + 10, true)
		this.lastModifiedTime = data.getUint16(offset + 12, true)
		this.lastModifiedDate = data.getUint16(offset + 14, true)
		this.crc = data.getUint32(offset + 16, true)
		this.compressedSize = data.getUint32(offset + 20, true)
		this.uncompressedSize = data.getUint32(offset + 24, true)
		this.fileNameLength = data.getUint16(offset + 28, true)
		this.extraLength = data.getUint16(offset + 30, true)
		this.commentLength = data.getUint16(offset + 32, true)
		this.diskNumber = data.getUint16(offset + 34, true)
		this.internalAttributes = data.getUint16(offset + 36, true)
		this.externalAttributes = data.getUint32(offset + 38, true)
		this.localFileHeaderOffset = data.getUint32(offset + 42, true)
		this.fileName = readString(data, offset + 46, this.fileNameLength)
		this.extra = readString(data, offset + 46 + this.fileNameLength, this.extraLength)
		this.comment = readString(data, offset + 46 + this.fileNameLength + this.extraLength, this.commentLength)

		this.nextEntryByteOffset = offset + 46 + this.fileNameLength + this.extraLength + this.commentLength
	}

    public async extract(): Promise<ArrayBuffer> {
		const localH = new LocalFileHeader(this.data, this.localFileHeaderOffset)
        const buffer = this.data.buffer.slice(localH.startsAt, localH.startsAt + this.compressedSize)
        if(this.compressionMethod === 0x00) {
            return buffer
        } else if(this.compressionMethod === 0x08) {
            return await inflateRawSync(buffer)
        } else {
            return Promise.reject()
        }
    }
}

class LocalFileHeader {
    private data: DataView
    public signature: number
    public version: number
    public generalPurposeFlags: number
    public compressionMethod: number
    public lastModifiedTime: number
    public lastModifiedDate: number
    public crc: number
    public compressedSize: number
    public uncompressedSize: number
    public fileNameLength: number
    public fileName: string
    public extraLength: number
    public extra?: Uint32Array
    public startsAt: number
	public nextEntryByteOffset: number = 0

    constructor(data: DataView, offset: number) {
        this.data = data
        this.signature = data.getUint32(offset, true)
        this.version = data.getUint16(offset + 4, true)
        this.generalPurposeFlags = data.getUint16(offset + 6, true)
        this.compressionMethod = data.getUint16(offset + 8, true)
        this.lastModifiedTime = data.getUint16(offset + 10, true)
        this.lastModifiedDate = data.getUint16(offset + 12, true)
        this.crc = data.getUint32(offset + 14, true)
        this.compressedSize = data.getUint32(offset + 18, true)
        this.uncompressedSize = data.getUint32(offset + 22, true)
        this.fileNameLength = data.getUint16(offset + 26, true)
        this.extraLength = data.getUint16(offset + 28, true)
        this.fileName = readString(data, offset + 30, this.fileNameLength)

		this.startsAt = offset + 30 + this.fileNameLength + this.extraLength
		if(this.generalPurposeFlags & 0x08) {
			this.startsAt += 16
		}

		this.nextEntryByteOffset = this.startsAt + this.compressedSize
    }
}

const  utf8decoder = new TextDecoder('utf8')

function readString(data: DataView, offset: number, length: number): string {
    const bytes = new Uint8Array(data.buffer, offset, length)
    const value = utf8decoder.decode(bytes)
    return value
}

export async function inflate(data: ArrayBuffer): Promise<ArrayBuffer> {
	const buffer = data
	const dstream = new DecompressionStream("deflate-raw")
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(buffer)
			controller.close()
		}
	})

	let done = false
	const decompressed = []
	const reader = stream.pipeThrough(dstream).getReader()
	do {
		const result = await reader.read()
		done = result.done
		if (result.value) {
			decompressed.push(result.value)
		}
	} while (!done)

	const blob = new Blob(decompressed)
	return blob.arrayBuffer()
}
