const fs = require('fs')
const path = require('path')
const moment = require('moment')
const _ = require('lodash')
const axios = require('axios')
const util = require('./utils/functions')

const PromiseFtp = require('promise-ftp')

const config = {
  host: '192.168.0.50',
  port: 9743,
  user: 'JGS',
  password: 'jins@svr2'
}

const procedure = async () => {
  const ftp = new PromiseFtp()
  try {
    const serverMessage = await ftp.connect(config)
    console.log(serverMessage)

    const requestFilesPath = '/uploadfiles/_requestFiles'

    await ftp.rmdir(requestFilesPath, true)
    await ftp.mkdir(requestFilesPath, true)

    const requestDirPath = path.resolve('./_output')

    const requestDir = fs.readdirSync(requestDirPath)

    await util.asyncForEach(requestDir, async (d, k) => {
      try {
        const file = fs.readFileSync(path.join(requestDirPath, d))
        await ftp.put(file, requestFilesPath + '/' + d)
      } catch(err) {
        console.error(err)
        throw err
      }
    })

    const backupData = fs.readFileSync('./category/backup/output/MD2 SC Historical.xlsx')

    const prevdata = path.resolve('./_output/MD2 SC Historical.xlsx')
    if(fs.existsSync(prevdata)) fs.unlinkSync(prevdata)

    await new Promise((resolve, reject) => setTimeout(() => resolve(), 1500))

    fs.copyFileSync('./category/backup/output/MD2 SC Historical.xlsx', './_output/MD2 SC Historical.xlsx')

    await ftp.put(backupData, requestFilesPath + '/' + 'MD2 SC Historical.xlsx')


    const remotePdfsPath = '/uploadfiles/system boundary'

    await ftp.rmdir(remotePdfsPath, true)
    await ftp.mkdir(remotePdfsPath, true)

    const pdfsPath = './_output_pdf'
    const pdfsList = fs.readdirSync(pdfsPath)

    await util.asyncForEach(pdfsList, async (d, k) => {
      try{
        const file = fs.readFileSync(path.join(pdfsPath, d))
        await ftp.put(file, remotePdfsPath +'/' + d)
      } catch(err){
          console.error(err)
          throw err
      }
  })



  } catch(err) {
    console.error(err)
  } finally {
    await ftp.end()
    process.exit(1)
  }
}

procedure()