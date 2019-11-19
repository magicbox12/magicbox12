const archiver = require('archiver')

const path = require('path')

const fs = require('fs')

const compress = (files) => {

  fs.unlinkSync('./_output/JSON Files (ACT,TAG,PUNCH).zip')

  const output = path.join(path.resolve('./'), '_output', 'JSON Files (ACT,TAG,PUNCH).zip')

  const stream = fs.createWriteStream(output)

  const archive = archiver('zip', { zlib: { level: 9 }})

  stream.on('close', () => {
    console.log(archive.pointer() + ' total bytes')
    console.log('archiver has been finalized and the output file descriptor has closed.')    
  })

  stream.on('end', () => console.log('Data has been drained'))

  archive.on('warning', err => {
    console.warn(err)
    process.exit(1)
  })

  archive.on('error', err => {
    console.error(err)
    fs.unlinkSync(output)
    process.exit(1)
  })

  archive.pipe(stream)

  const fileRoot = path.resolve('./files')
  files.forEach(d => {
    const filePath = path.join(fileRoot, d)
    const buffer = fs.readFileSync(filePath)
    archive.append(buffer, { name: d })
  })

  archive.finalize()  
  
}

compress(files)