const fs = require('fs')
const path = require('path')
const moment = require('moment')
const _ = require('lodash')
const utils = require('./utils/functions')

const PromiseFtp = require('promise-ftp')

const checkfile = async (updateDate, updateTime) => {
  
  const cutoff = updateDate === '' ? moment().format('YYMMDD') : updateDate
  
  const isFormat = moment(cutoff, 'YYMMDD', true).isValid()
  if(!isFormat) throw 'Cutoff 날짜형식이 잘못되었거나, 값이 없습니다.(yymmdd)'  
  if(updateTime === '') throw '업데이트 시간때를 설정해주십시오.(1: 오후1시, 2: 오후8시)'

  if(updateTime === '1') console.log(cutoff + ' 오후 1시 파일 체크중입니다. ')
  if(updateTime === '2') console.log(cutoff + ' 오후 8시 파일 체크중입니다. ')

  const before = Date.now()
  const ftp = new PromiseFtp()
  try {
    if(!cutoff) throw new Error('not setup cutoff')
    const config = {
      host: '211.172.246.55',
      port: 7070,
      user: 'administrator', 
      password: 'jingraphics2019)(*&'
    }

    const findTime = updateTime === '1' ? '13' : '20'
    
    await ftp.connect(config)
    const targetPath = '/SHI/' + cutoff
    const list = await ftp.list(targetPath)

    const recentList = list.filter(d => {
      const date = moment(d['date']).format('HH')
      return findTime === date
    })

    const fileUpdatetime = recentList.map(d => d['date']).map(d => moment(d).format('HH'))
    const isUniq = Array.from(new Set(fileUpdatetime))

    if(recentList.length < 3) {
      const files = list.map(d => d.name.split('_').shift() + ' ' + moment(d['date']).format('YYYY-MM-DD A hh:mm')).join('\r\n')
      throw '찾으려는 파일이 모두 (ACT, PUNCH, TAG) 없습니다.\r\n현재 업로드된 파일들\r\n' + files
    }

    if(isUniq.length > 1) throw 'Data Update 시간을 확인해주십시오.' + recentList.map(d => d['name']).join(' / ')

    const uniqValue = isUniq[0]

    if(!['13','20'].includes(uniqValue)) throw 'Cutoff 시간이 정해진 (13, 20)시와 다릅니다.'

    console.log(recentList.map(d => d['name']).join(' / ') +'\r\n파일들이 확인되었습니다.\r\n파일을 다운로드 중입니다.')

    const updatePath = path.join(__dirname, '_updatefiles')

    if(!fs.existsSync(updatePath)) fs.mkdirSync(udpatePath)

    await new Promise((resolve, reject) => {
      try {
        const dir = fs.readdirSync(updatePath)
        dir.forEach(file => {
          fs.unlinkSync(path.join(updatePath, file))
        })
        resolve()
      } catch(err) {
        reject(err)
      }
    })

    await new Promise((resolve, reject) => {
      try {
        const p = path.join(__dirname, 'files')
        const dir = fs.readdirSync(p)
        const filtered = dir.filter(d => ['ACT_','PUNCH_','TAG_'].some(v => String(d).indexOf(v) !== -1))
        filtered.forEach(file => {
          const fp = path.join(p, file)
          fs.unlinkSync(fp)
        })
        resolve()
      } catch(err) {
        reject(err)
      }
    })

    await utils.asyncForEach(recentList, async (d, k) => {
      try {
        const filename = d.name
        const streamPath = targetPath + '/' + filename
        const stream = await ftp.get(streamPath)
    
        await new Promise((resolve, reject) => {
          const output = path.join(updatePath, filename)
          stream.once('close', resolve);
          stream.once('error', reject);
          stream.pipe(fs.createWriteStream(output))
        })
      } catch(err) {
        console.error(err)
      }
    })

    const files = fs.readdirSync(updatePath)
    files.forEach(d => {
      fs.renameSync(path.join(updatePath, d), path.join(__dirname, 'files', d))
    })

    const after = Date.now()
    console.log( '파일 체크가 끝났습니다. 시간소요:', utils.millisToMinutesAndSeconds(after - before), '초')

  } catch(err) {
    console.error(err)
    process.exit(1)
  } finally {
    ftp.end()
  }
}

const procedure = async (updateTime) => {
  try {

    const cutoff = moment(new Date()).format('YYYYMMDD')
    await checkfile(cutoff, updateTime)
    
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

procedure(updateTime)