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

    const updatePath = '/module/systemcompletion/__data'

    await ftp.rmdir(updatePath, true)

    await ftp.mkdir(updatePath + '/mc', true)

    const updateFilePath = path.join(__dirname, 'json')
    const files = {
      cutoff: fs.readFileSync(path.join(__dirname, 'ref', 'cutoff.json')),
      updatetime: fs.readFileSync(path.join(updateFilePath, '.updatetime.json')),
      itrSchedule: fs.readFileSync(path.join(updateFilePath, 'mc', 'group_overall_dashboard_itr_schedule.json')),
      punchKeyData: fs.readFileSync(path.join(updateFilePath, 'mc', 'group_punch_dashboard_keydata.json'))
    }

    const cutoffPath = '/module/systemcompletion/__ref/cutoff.json'

    await ftp.delete(cutoffPath)

    await ftp.put(files.cutoff, '/module/systemcompletion/__ref/cutoff.json')
    await ftp.put(files.updatetime, updatePath + '/.updatetime.json')
    await ftp.put(files.itrSchedule, updatePath + '/mc/group_overall_dashboard_itr_schedule.json')
    await ftp.put(files.punchKeyData, updatePath + '/mc/group_punch_dashboard_keydata.json')
    
    const date = moment().format('YYYY-MM-DD HH:mm:ss')

    const res = await axios.post('http://192.168.0.50:5000/api/updatefiles', { systemcompletion: date })

    console.log(res.data)
  } catch(err) {
    console.error(err)
  } finally {
    await ftp.end()
    process.exit(1)
  }
}

procedure()