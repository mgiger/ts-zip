# ts-zip

Simple Typescript class to extract files from zip archives

Just paste this class into your code and you're living large.

### Usage
```typescript
const archiveData: ArrayBuffer; // Archive file buffer

const archive = new ZipArchive(archiveData)
for(file of archive.files) {
	console.log(`${file.fileName}: ${file.uncompressedSize} bytes`)
}

// get the decompressed file contents
const fileData = archive.file[0].extract()
```

Dependencies:

* zlib

