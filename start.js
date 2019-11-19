
// npm
const moment = require('moment')
const cron = require('node-cron')
const path = require('path')
const fs = require('fs')

// .js files
// const checkfile = require('./checkfile')
// const compress = require('./compress-files')
// const index = require('./index')
// const keyvalues = require('./generate-keyvalues')
// const discipline = require('./category/comm-dashboard-discipline/index')
// const update = require('./update-files')
// const backup = require('./category/backup/index')
// const pdfdata = require('./category/system-boundary-pdf/data/index')
// const createPDF = require('./category/system-boundary-pdf/generate')
// const mergePDF = require('./category/system-boundary-pdf/merge')
// const transfer = require('./transfer-files')


// path
// const dir = fs.readdirSync(path.resolve('./files'))
// const files = dir.filter(d => String(d).indexOf('ACT_') !== -1 || String(d).indexOf('PUNCH_') !== -1 || String(d).indexOf('TAG_') !== -1)
// const cutoff = JSON.parse(fs.readFileSync(path.resolve('./ref/cutoff.json')))['MC'].date


// date format
const NowDay = new Date()
const NowWeek = NowDay.getDay()
const ClosedDay = ['2019-12-25']
const Today = moment(NowDay).format('YYYY-MM-DD')
let compareV = true

// schedule format
// cron.schedule('* 30 13,20 * * 0-5', async () => {
//   if(NowWeek > 5 && ClosedDay.includes(Today)) {
//     compareV = false
//   } else {
//     compareV = true
//     // let updateTime = NowDay.getHours() == 13 ? '1' : '2'
//     // await checkfile.procedure(updateTime)
//     // await compress.compress(files)
//     // await index.uploadProcedure()
//     // await keyvalues.uploadTables('jgs')
//     // await discipline.procedure('jgs')
//     // await update.procedure() 
//     // await backup.procedure(cutoff)
//     // await pdfdata.generate()
//     // await createPDF.createPDF ()
//     // await mergePDF.generateOverall()
//     // await transfer.procedure()
//   }
// })
