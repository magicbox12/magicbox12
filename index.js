const fs = require('fs')
const moment = require('moment')
const _ = require('lodash')
const sql = require('mssql')
const path = require('path')
const xlsx = require('xlsx-stream-reader')
const utils = require('./utils/functions')
const query = require('./query')

const connectionConfig = require('./config/db')

require('events').EventEmitter.defaultMaxListeners = 30 // memory leak issue solved -- default 10

const jgsconfig = connectionConfig

const generate = getCutoff()

const cutoff = generate.date

uploadProcedure()

async function uploadProcedure () {
  try {
    const testpack = await parseTestpack()
    await uploadExcel('TESTPACK_DATAREVIEW', 'dbo', [], testpack.header, testpack.rows, jgsconfig)    
    await upload()
    const updatetime = {
      updatetime: moment().format('YYYY-MM-DD HH:mm'),
      assigned: false,
      generate: generate.generate
    }
    fs.writeFileSync(path.join(__dirname, 'json', '.updatetime.json'), JSON.stringify(updatetime, null, '\t'))
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function getCutoff() {
  const data = fs.readdirSync('./files')
  const list = data
  .filter(d => String(d).indexOf('ACT_') !== -1)
  .map(v => {
    return {
      name: v,
      time: fs.statSync('./files/' + v).mtime.getTime()
    }
  })
  .sort((a,b) => b.time - a.time)
  .map(v => v.name)

  const fileNames = {
    act: data.find(d => String(d).indexOf('ACT_') !== -1).split('_').pop(),
    punch: data.find(d => String(d).indexOf('PUNCH_') !== -1).split('_').pop(),
    tag: data.find(d => String(d).indexOf('TAG_') !== -1).split('_').pop(),
  }

  const generateTime = {
    act: moment(fileNames.act, 'YYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss'),
    punch: moment(fileNames.punch, 'YYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss'),
    tag: moment(fileNames.tag, 'YYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss')
  }
  const recent = String(list[0]).replace('ACT_', '')
  return {
    date: moment(recent, 'YYMMDDHHmmss').format('YYMMDD'),
    generate: generateTime
  }
}

function parseSchedule (actual) {
  const actualData = actual
  const startDate = '2018-05-04'
  const start =      [27]
  const hull =       [28,29,30,31,32,33]
  const deckbox =    [61,62,63,64,65,66]
  const topside =    [94,95,96,97,98,99]
  let schedule = []
  const itrSchedule = {
    DURATION: [],
    LH: {
      RECOVERY: { THISWEEK: [], CUMULATIVE: [] },
      FORECAST: { THISWEEK: [], CUMULATIVE: [] },
      ACTUAL:   { THISWEEK: [], CUMULATIVE: [] }
    },
    DB: {
      RECOVERY: { THISWEEK: [], CUMULATIVE: [] },
      FORECAST: { THISWEEK: [], CUMULATIVE: [] },
      ACTUAL:   { THISWEEK: [], CUMULATIVE: [] }
    },
    T: {
      RECOVERY: { THISWEEK: [], CUMULATIVE: [] },
      FORECAST: { THISWEEK: [], CUMULATIVE: [] },
      ACTUAL:   { THISWEEK: [], CUMULATIVE: [] }
    }
  }

  return new Promise(function(resolve, reject) {
    const wbr = new xlsx()
    wbr.on('error', err => { reject(err) })
    wbr.on('worksheet', wsr => {
      if(wsr.id > 1) wsr.skip()
      wsr.on('row', row => {
        const currentIdx = Number(row.attributes.r)
        if(start.includes(currentIdx)) {
          schedule = row.values
            .map((d, k) => {
              const cutoff = moment(startDate).add(k - 6, 'weeks').add(9, 'hours').format('YYYY-MM-DD')
              return d !== '' ? cutoff : null
            })
        }
        if(hull.includes(currentIdx)) {
          if(currentIdx === hull[0]) itrSchedule.LH.RECOVERY.THISWEEK = getPlanValues(row.values)
          if(currentIdx === hull[1]) itrSchedule.LH.RECOVERY.CUMULATIVE = getPlanValues(row.values)
          if(currentIdx === hull[2]) itrSchedule.LH.FORECAST.THISWEEK = getPlanValues(row.values)
          if(currentIdx === hull[3]) itrSchedule.LH.FORECAST.CUMULATIVE = getPlanValues(row.values)
          if(currentIdx === hull[4]) itrSchedule.LH.ACTUAL.THISWEEK = getAcutalValues(row.values, 'thisweek')
          if(currentIdx === hull[5]) itrSchedule.LH.ACTUAL.CUMULATIVE = getAcutalValues(row.values, 'cumulative')
        }
        if(deckbox.includes(currentIdx)) {
          if(currentIdx === deckbox[0]) itrSchedule.DB.RECOVERY.THISWEEK = getPlanValues(row.values)
          if(currentIdx === deckbox[1]) itrSchedule.DB.RECOVERY.CUMULATIVE = getPlanValues(row.values)
          if(currentIdx === deckbox[2]) itrSchedule.DB.FORECAST.THISWEEK = getPlanValues(row.values)
          if(currentIdx === deckbox[3]) itrSchedule.DB.FORECAST.CUMULATIVE = getPlanValues(row.values)
          if(currentIdx === deckbox[4]) itrSchedule.DB.ACTUAL.THISWEEK = getAcutalValues(row.values, 'thisweek')
          if(currentIdx === deckbox[5]) itrSchedule.DB.ACTUAL.CUMULATIVE = getAcutalValues(row.values, 'cumulative')
        }

        if(topside.includes(currentIdx)) {
          if(currentIdx === topside[0]) itrSchedule.T.RECOVERY.THISWEEK = getPlanValues(row.values)
          if(currentIdx === topside[1]) itrSchedule.T.RECOVERY.CUMULATIVE = getPlanValues(row.values)
          if(currentIdx === topside[2]) itrSchedule.T.FORECAST.THISWEEK = getPlanValues(row.values)
          if(currentIdx === topside[3]) itrSchedule.T.FORECAST.CUMULATIVE = getPlanValues(row.values)
          if(currentIdx === topside[4]) itrSchedule.T.ACTUAL.THISWEEK = getAcutalValues(row.values, 'thisweek')
          if(currentIdx === topside[5]) itrSchedule.T.ACTUAL.CUMULATIVE = getAcutalValues(row.values, 'cumulative')
        }

        function getPlanValues(arr) {
          const data = arr.map((d,k) => {
            const obj = {}
            obj.cutoff = schedule[k]
            obj.value = k > 5
              ? d === '' 
                ? 0 
                : Number(d.replace(/\,/g, ''))
              : null
            return k > 5 ? obj : null
          })
          return data.filter((d,k) => k > 5 && d.cutoff)
        }

        function getAcutalValues(arr, type) {
          const data = arr.map((d,k) => {
            const obj = {}
            obj.cutoff = schedule[k]
            const t = moment(schedule[k], 'YYYY-MM-DD', true)
            const a = _.chain(actualData).filter(v => {
              const c = moment(v['ITR COMPLETE DATE'], 'YYYYMMDD', true)
              const diff = c.diff(t, 'days')
              if(type === 'thisweek') return diff > -7 && diff <= 0
              else return diff <= 0
            })
            .map('COMPLETE')
            .sumBy()
            .value()

            obj.value = k > 5
              ? a
              : null
            return k > 5 ? obj : null
          })
          return data.filter((d,k) => k > 5 && d.cutoff)
        }
        
      })
      wsr.on('end', () => { 
        itrSchedule.DURATION = schedule.filter(d => d)
        console.log('end'); 
      })
      wsr.process()
    })
    wbr.on('end',() => {
      resolve(itrSchedule)
    })
    const filepath = path.join(__dirname, './files/schedule-itr.xlsx')
    fs.createReadStream(filepath).pipe(wbr)
  })
}

function parseExcel() {
  return new Promise(function(resolve, reject) {
    let header = []
    let rows = []
    const wbr = new xlsx()
    wbr.on('error', err => { reject(err) })
    wbr.on('worksheet', wsr => {
      if(wsr.id > 1) wsr.skip()
      wsr.on('row', row => {
        if(row.attributes.r == 1) {
          header = row.values.filter((d, k) => k > 0)
        } else {
          const r = []
          const v = row.values
          header.forEach((d,k) => {
            const i = k + 1
            const str = v[i] || null
            const s = str && [8,9,10,11].includes(i)
              ? moment(utils.getJsDateFromExcel(str)).subtract(1, 'day').format('YYYYMMDD')
              : str
            r.push(s)
          })
          rows.push(r)
        }
      })

      wsr.on('end', () => {
        return resolve({
          header,
          rows
        })
      })
      wsr.process()
    })
    wbr.on('end', () => resolve('end'))
    const filepath = path.join(__dirname, './files/subsystem.xlsx')
    fs.createReadStream(filepath).pipe(wbr)
  })
}

function parseTestpack() {
  return new Promise(function(resolve, reject) {
    let header = []
    let rows = []
    const wbr = new xlsx()
    wbr.on('error', err => { reject(err) })
    wbr.on('worksheet', wsr => {
      if(wsr.id > 1) wsr.skip()
      wsr.on('row', row => {
        if(row.attributes.r == 1) {
          header = row.values.filter((d, k) => k > 0)
        } else {
          const r = []
          const v = row.values
          header.forEach((d,k) => {
            const i = k + 1
            const str = v[i] || null
            const s = str && [3].includes(i)
              ? moment(utils.getJsDateFromExcel(str)).subtract(1, 'day').format('YYYYMMDD')
              : str
            r.push(s)
          })
          rows.push(r)
        }
      })

      wsr.on('end', () => {
        return resolve({
          header,
          rows
        })
      })
      wsr.process()
    })
    wbr.on('end', () => resolve('end'))
    const filepath = path.join(__dirname, './files/testpack.xlsx')
    fs.createReadStream(filepath).pipe(wbr)
  })
}

function uploadExcel(tablename, tableschema, datetypes, headerColumns, rows, connection) {
  return new Promise(function(resolve, reject){
      console.time('Upload JSON to MSSQL by ' + tablename)
      const table = new sql.Table('#table');
      table.create = true;

      if(!['SUBSYSTEM', 'TESTPACK_DATAREVIEW'].includes(tablename)) {
        rows.forEach((d, k) => {
          const row = []
          headerColumns.forEach(v => {
            const value = d[v] || null
            row.push(value)
          })
          table.rows.add(...row)
        })
      } else {
        rows.forEach(d => {
          const row = []
          headerColumns.forEach((v,k) => {
            const value = d[k] || null
            row.push(value)
          })
          table.rows.add(...row)
        })
      }

      headerColumns.forEach((d,k) => {
        if(datetypes.includes(k)) {
          table.columns.add(d, sql.DateTime, {nullable: true})
        }
        else {
          const maxLength = tablename !== 'SUBSYSTEM'
            ? _.chain(rows).map(d).map(d => d ? String(d).length : 0).maxBy().value()
            : _.chain(rows).map(k).map(v => v ? String(v).length : 0).maxBy().value()
          const characterLength = maxLength === 0 ? 255 : maxLength
          table.columns.add(String(d).toUpperCase(), sql.NVarChar(characterLength), {nullable: true})
        }
      })
  
      sql.connect(connection).then(pool => {
          const insert = new sql.Request(pool);
          const query = `
              if object_id('${tableschema}.${tablename}') is not null 
              begin 
                  drop table ${tableschema}.${tablename} 
              end;
              select * into ${tableschema}.${tablename} from #table;        
          `
          insert.bulk(table, (err, rowCount) => {
              if(err) reject(err)
              insert.query(query, (err, r) => {
                  if(err) reject(err)
                  console.log(rows.length)
                  console.timeEnd('Upload JSON to MSSQL by ' + tablename)
                  sql.close()
                  resolve()                    
              })
          })
      }).catch(err => reject(err))
      
      sql.on('error', err => reject(err))
  })
}

function exportJSON(query) {
  return new Promise((resolve, reject) => {
    sql.connect(jgsconfig)
    .then(pool => {
      return pool.request().query(query)
    })
    .then(result => {
      sql.close()
      return resolve(result.recordset)
    })
    .catch(err => reject(err))
    sql.on('error', err => reject(err))
  })
}

async function CreatePunchTable (config, date) {
  try {
    console.time('punch upload...')
    const cutoff = moment(date, 'YYMMDD', true).format('YYYY-MM-DD')
    const pool = await new sql.ConnectionPool(config).connect()
    const query = 
    `
    SELECT 
      @STDATE = CASE WHEN 
            [03_PLANNING].[DBO].GET_CUTOFF(MIN([ISSUED DATE]), 5) <= [03_PLANNING].[DBO].GET_CUTOFF(MIN([COMPLETED DATE]), 5)
            THEN [03_PLANNING].[DBO].GET_CUTOFF(MIN([ISSUED DATE]), 5)
            ELSE [03_PLANNING].[DBO].GET_CUTOFF(MIN([COMPLETED DATE]), 5)
            END
    FROM PUNCH    
    `
    const result = await pool.request().output('stdate', sql.Date).query(query)
    if(pool) pool.close()
    const stdate = moment(result.output.stdate).format('YYYY-MM-DD')
    const duration = getDuration(moment(cutoff).diff(stdate, 'weeks'), cutoff)
    await uploadTable(duration)

    async function uploadTable (duration) {
      try {
        await asyncForEach(duration, async (d,k) => {
          try {
            await issued(d, k)
            await completed(d, k)
          } catch(err) {
            console.error(err)
            process.exit(1)
          }
        })
        console.timeEnd('punch upload...')
      } catch(err) {
        console.log(err)
        process.exit(1)
      }
    }

    async function issued (date, seq) {
      try {
        const pool = await new sql.ConnectionPool(config).connect()
        const query = seq === 0
        ?
          `
            IF OBJECT_ID('PUNCH.ISSUED') IS NOT NULL DROP TABLE PUNCH.ISSUED;
            SELECT 
              [CUTOFF] = @CUTOFF, 
              * 
            INTO PUNCH.ISSUED
            FROM PUNCH
            WHERE [03_PLANNING].[DBO].GET_CUTOFF([ISSUED DATE], 5) > DATEADD( WW, -1, @CUTOFF ) AND [03_PLANNING].[DBO].GET_CUTOFF([ISSUED DATE], 5) <= @CUTOFF;
          `
        :
          `
            INSERT INTO PUNCH.ISSUED 
            SELECT 
              [CUTOFF] = @CUTOFF, 
              * 
            FROM PUNCH
            WHERE [03_PLANNING].[DBO].GET_CUTOFF([ISSUED DATE], 5) > DATEADD( WW, -1, @CUTOFF ) AND [03_PLANNING].[DBO].GET_CUTOFF([ISSUED DATE], 5) <= @CUTOFF;
          `
        await pool.request().input('cutoff', date ).query(query)
        if(pool) pool.close()    
    
      } catch(err) {
        console.error(err)
        process.exit(1)
      }
    }
    
    async function completed (date, seq) {
      try {
        const pool = await new sql.ConnectionPool(config).connect()
        const query = seq === 0
        ?
          `
            IF OBJECT_ID('PUNCH.COMPLETED') IS NOT NULL DROP TABLE PUNCH.COMPLETED;
            SELECT 
              [CUTOFF] = @CUTOFF, 
              * 
            INTO PUNCH.COMPLETED
            FROM PUNCH
            WHERE [03_PLANNING].[DBO].GET_CUTOFF([COMPLETED DATE], 5) > DATEADD( WW, -1, @CUTOFF ) AND [03_PLANNING].[DBO].GET_CUTOFF([COMPLETED DATE], 5) <= @CUTOFF;
          `
        : 
          `
          INSERT INTO PUNCH.COMPLETED
          SELECT 
            [CUTOFF] = @CUTOFF, 
            * 
          FROM PUNCH
          WHERE [03_PLANNING].[DBO].GET_CUTOFF([COMPLETED DATE], 5) > DATEADD( WW, -1, @CUTOFF ) AND [03_PLANNING].[DBO].GET_CUTOFF([COMPLETED DATE], 5) <= @CUTOFF;      
          `
        await pool.request().input('cutoff', date ).query(query)
        if(pool) pool.close()    
    
      } catch(err) {
        console.error(err)
        process.exit(1)
      }  
    }
    
    function getDuration(duration, cutoff) {
      let stDate = moment(cutoff)
      const range = []
      for(let i = 0; i <= duration + 1; i ++) {
        const d = moment(stDate).subtract(i, 'w').isoWeekday('friday').format('YYYY-MM-DD')
        range.push(d)
      }
      return range
    }    
    

  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

async function upload() {
  try {
    console.clear()

    const cutoffdir = fs.readFileSync('./ref/cutoff.json')
    const cutoffdata = JSON.parse(cutoffdir)

    cutoffdata.MC.date = moment(cutoff, 'YYMMDD', true).format('YYYYMMDD')

    fs.writeFileSync('./ref/cutoff.json', JSON.stringify(cutoffdata))


    console.log(cutoff + 'updated...')
    const before = Date.now()
    console.time('JSON parse...')
    const data = await utils.parseData(cutoff)
    console.timeEnd('JSON parse...')
    console.time('Subsystem Excel File parse...')
    const exceldata = await parseExcel()
    console.timeEnd('Subsystem Excel File parse...')
    await uploadExcel('SUBSYSTEM', 'dbo', [], exceldata.header, exceldata.rows, jgsconfig)
    await uploadExcel('ACT', 'dbo', [], data.header.act, data.json.act, jgsconfig)
    await uploadExcel('PUNCH', 'dbo', [], data.header.punch, data.json.punch, jgsconfig)
    await uploadExcel('TAG', 'dbo', [], data.header.tag, data.json.tag, jgsconfig)

    const pool = await sql.connect(jgsconfig)

    console.time('uploaded tables update')
    await pool.request().query(`ALTER TABLE [ACT] ADD [DISCIPLINE] NVARCHAR(6);`)
    await pool.request().query(`UPDATE [ACT] SET [DISCIPLINE] = [ITR DISCIPLINE];`)

    await pool.request().query(
      `
      DELETE ACT FROM ACT A LEFT JOIN SUBSYSTEM S ON A.[SUB-SYSTEM] = S.[SUBSYS] WHERE S.AREA IS NULL;
      DELETE PUNCH FROM PUNCH P LEFT JOIN SUBSYSTEM S ON P.[SUB-SYSTEM] = S.[SUBSYS] WHERE S.AREA IS NULL;

      DECLARE @ISMODULE INT;
      SELECT @ISMODULE = COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SUBSYSTEM' AND COLUMN_NAME = 'MODULE';

      IF @ISMODULE = 0 BEGIN ALTER TABLE SUBSYSTEM ADD [MODULE] NVARCHAR(10); END;
      
      ALTER TABLE SUBSYSTEM ALTER COLUMN [MC_PLAN] DATE;
      ALTER TABLE SUBSYSTEM ALTER COLUMN [WD_PLAN] DATE;
      ALTER TABLE SUBSYSTEM ALTER COLUMN [MC_ACTUAL] DATE;
      ALTER TABLE SUBSYSTEM ALTER COLUMN [WD_ACTUAL] DATE;
      ALTER TABLE ACT ADD [_CUTOFF] DATETIME;

      EXEC GENERATE_MASTER_SUBSYSTEM;
      `
    )
    await pool.request().query('UPDATE ACT SET [_CUTOFF] = [03_PLANNING].[DBO].GET_CUTOFF([ITR COMPLETE DATE], 5 );')
    if(pool) sql.close()

    console.timeEnd('uploaded tables update')

    await CreatePunchTable(jgsconfig, cutoff)

    console.time('generate punch keydata && itr schedule')

    const json = {
      cutoff: JSON.parse(fs.readFileSync(__dirname + '/ref/cutoff.json')),
      overall: {
        itr: {
          schedule: {}
        },
      },
      itr: {
        dashboard: {
          complete: await exportJSON(query.itr.dashboard.complete),
        }
      },
      punch: {
        dashboard: {
          keydata: await exportJSON(query.punch.dashboard.keys),
        }
      }
    }
    json.overall.itr.schedule = await parseSchedule(json.itr.dashboard.complete)

    console.timeEnd('generate punch keydata && itr schedule')

    const files = [
      { filename: 'group_punch_dashboard_keydata.json', data: JSON.stringify(json.punch.dashboard.keydata) },
      { filename: 'group_overall_dashboard_itr_schedule.json', data: JSON.stringify(json.overall.itr.schedule) }
     ]
    _.forEach(files, d => { fs.writeFileSync('./json/' + d.filename, d.data) })

    fs.renameSync('./json/group_punch_dashboard_keydata.json', './json/mc/group_punch_dashboard_keydata.json')
    fs.renameSync('./json/group_overall_dashboard_itr_schedule.json', './json/mc/group_overall_dashboard_itr_schedule.json')    

    const after = Date.now()
    console.log( 'upload time...', utils.millisToMinutesAndSeconds(after - before))
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}