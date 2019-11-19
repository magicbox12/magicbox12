const merge = require('easy-pdf-merge')

const fs = require('fs')
const path = require('path')


const filePath = './_output_pdf'
const files = fs.readdirSync(path.resolve(filePath))

const paths = []
files.forEach(d => {
  const fp = filePath + '/' + d
  paths.push(fp)
})

generateOverall()

function mergePDF () {
  return new Promise(async (resolve, reject) => {
    try {
      merge(paths, path.join('./_output/System Boundary Overall.pdf'), err => {
        if(err) throw err
        console.log('Succesfully merge!')
        resolve()
      })
    } catch(err) {
      reject(err)
    }
  })
}

async function generateOverall () {
  try {
    if(fs.existsSync('./_output/System Boundary Overall.pdf')) fs.unlinkSync('./_output/System Boundary Overall.pdf')
    if(fs.existsSync('./_output/Overall.pdf')) fs.unlinkSync('./_output/Overall.pdf')
    await mergePDF()
  } catch(err) {
    console.error(err)
    process.exit(1)
  }

}