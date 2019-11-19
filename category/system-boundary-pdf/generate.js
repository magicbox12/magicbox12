const fs = require('fs')
const path = require('path')

const puppeteer = require('puppeteer')
const setData = require('./data')

async function generate(system) {
  try {
    const html = setData(system)
    if(!html) return

    const browser = await puppeteer.launch({})
    const page = await browser.newPage()
    await page.setContent(html)

    await page.emulateMedia('screen')
    await page.addStyleTag({path: './category/system-boundary-pdf/dist/main.css'})
    await page.pdf({
      path: `./_output_pdf/${system}.pdf`,
      printBackground: true,
      landscape: true,
      format   : 'A2'
    })
    await browser.close()
    
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
  
}

async function createPDF () {
  try {
    const output = path.resolve('./_output_pdf')
    const outputDir = fs.readdirSync(output)
    outputDir.forEach(d => {
      const filePath = path.join(output, d)
      fs.unlinkSync(filePath)
    })

    const filesPath = path.join(__dirname, 'src', 'assets', 'images', 'system')
    const filesDir = fs.readdirSync(filesPath)
    const list = filesDir.map(d => d.split('.').shift())

    const total = list.length
    await asyncForEach(list, async (system, k) => {
      try {
        await generate(system)
        console.log((k+1) + '/' + total, 'generate system ' + system)
      } catch(err) {
        throw err
      }
    })
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

createPDF ()

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}