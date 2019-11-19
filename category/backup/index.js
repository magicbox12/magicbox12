const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const sql = require('mssql')
const _ = require('lodash')
const moment = require('moment')
const inquirer = require('inquirer')

const excel = require('exceljs')

const dbconfig = require(path.resolve('./config/db'))

const getConnection = async (config) => {
  try {
    const pool = await new sql.ConnectionPool(config).connect()
    return pool
  } catch(err) {
    console.error('err')
    throw err
  }
}

async function backup (date) {
  try {
    const output = path.join(__dirname, 'output', date)
    rimraf.sync(output)
    const isFolder = fs.existsSync(output)
    
    if(!isFolder) fs.mkdirSync(output)

    const pool = await getConnection(dbconfig)

    const header = {
      mc   : require(path.join(__dirname, 'data', 'header_mc')),
      daily: require(path.join(__dirname, 'data', 'header_daily'))
    }

    const tableSetup = {
      mc   : header.mc.tableSetup(),
      daily: header.daily.tableSetup()
    }

    const columns = {
      mc   : tableSetup.mc.rows,
      daily: tableSetup.daily.rows,
    }

    const sqlPath = path.join(__dirname, 'queries')
    const sql = {
      schedule: fs.readFileSync(path.join(sqlPath, 'wdmc.sql')),
      mc      : fs.readFileSync(path.join(sqlPath, 'mc.sql')),
      mc_shi  : fs.readFileSync(path.join(sqlPath, 'mc_shi.sql')),
      daily   : fs.readFileSync(path.join(sqlPath, 'daily.sql')),
      act_c   : fs.readFileSync(path.join(sqlPath, 'act_c.sql'))
    }

    const query = {
      schedule: String.raw`${sql.schedule}`,
      mc      : String.raw`${sql.mc}`,
      mc_shi  : String.raw`${sql.mc_shi}`,
      daily   : String.raw`${sql.daily}`,
      act_c   : String.raw`${sql.act_c}`
    }

    const result = {
      schedule: await pool.request().query(query.schedule),
      mc      : await pool.request().query(query.mc),
      mc_shi  : await pool.request().query(query.mc_shi),
      daily   : await pool.request().query(query.daily),
      act_c   : await pool.request().query(query.act_c)
    }

    if(pool) pool.close()

    const dataset = {
      schedule: result.schedule.recordset,
      mc      : result.mc.recordset,
      mc_shi  : result.mc_shi.recordset,
      daily   : result.daily.recordset,
      act_c   : result.act_c.recordset
    }

    const summaryColumns = {
      mc   : getSummaryColumns(columns.mc),
      daily: getSummaryColumns(columns.daily)
    }

    const data = {
      schedule: dataset.schedule[0],
      mc      : dataset.mc.map(d => {
        const values = JSON.parse(JSON.stringify(d))
        values['WD_PLAN'] = dateParse(values['WD_PLAN'], 'YYYY-MM-DDT00:00:00.000Z')
        values['MC_PLAN'] = dateParse(values['MC_PLAN'], 'YYYY-MM-DDT00:00:00.000Z')
        return _.pickBy(values, (d, k) => columns.mc.map(v => v['name']).includes(k))
      }),
      mc_shi: dataset.mc_shi.map(d => {
        const values = JSON.parse(JSON.stringify(d))
        values['WD_PLAN'] = dateParse(values['WD_PLAN'], 'YYYY-MM-DDT00:00:00.000Z')
        values['MC_PLAN'] = dateParse(values['MC_PLAN'], 'YYYY-MM-DDT00:00:00.000Z')
        return _.pickBy(values, (d, k) => columns.mc.map(v => v['name']).includes(k))
      }),
      daily: dataset.daily.map(d => {
        const values = JSON.parse(JSON.stringify(d))
        values['COMM_DATE'] = dateParse(values['COMM_DATE'], 'YYYY-MM-DDT00:00:00.000Z')
        return _.pickBy(values, (d, k) => columns.daily.map(v => v['name']).includes(k))
      }),
      act_c: dataset.act_c[0]
    }

    const summary = {
      schedule: data.schedule,
      mc      : getSummary(data.mc, summaryColumns.mc, 'mc'),
      mc_shi  : getSummary(data.mc_shi, summaryColumns.mc, 'mc'),
      daily   : getSummary(data.daily, summaryColumns.daily, 'daily'),
      act_c   : data.act_c
    }


    const files = {
      schedule: JSON.stringify(summary.schedule, null, '\t'),
      summary : {
        mc    : JSON.stringify(summary.mc, null, '\t'),
        mc_shi: JSON.stringify(summary.mc_shi, null, '\t'),
        daily : JSON.stringify(summary.daily, null, '\t')
      },
      rows: {
        mc    : JSON.stringify(data.mc, null, '\t'),
        mc_shi: JSON.stringify(data.mc_shi, null, '\t'),
        daily : JSON.stringify(data.daily, null, '\t')
      }
    }

    const workbook = new excel.Workbook()
    const wb = await workbook.xlsx.readFile(path.join(__dirname, 'data/MD2 SC Historical.xlsx'))
 
    const ws = wb.getWorksheet(1)

    const wh = ws.getRow(1)

    let thisweek = getCutoff(date)
    let thisweekColumn

    wh.eachCell(function(cell, cellNumber) {
      if(cellNumber >= 9) {
        const date = dateParse(cell.value)
        if(date === thisweek) thisweekColumn = cellNumber
      }
    })

    const excelData = [
      { row: 2, data: summary.mc['OV_TOTAL'] },
      { row: 3, data: summary.mc['OV_COMPLETE'] },
      { row: 4, data: summary.daily['ACT_B_OV_TOTAL'] },
      { row: 5, data: summary.daily['ACT_B_OV_COMPLETE'] },
      { row: 6, data: summary.act_c['TOTAL'] },
      { row: 7, data: summary.act_c['COMPLETE'] },
      { row: 8, data: summary.mc_shi['OV_TOTAL'] },
      { row: 9, data: summary.mc_shi['OV_COMPLETE'] },
      { row: 10, data: summary.mc_shi['PI_TOTAL'] },
      { row: 11, data: summary.mc_shi['PI_COMPLETE'] },
      { row: 12, data: summary.mc_shi['EL_TOTAL'] },
      { row: 13, data: summary.mc_shi['EL_COMPLETE'] },
      { row: 14, data: summary.schedule['WD_PLAN'] },
      { row: 15, data: summary.schedule['WD_ACTUAL'] },
      { row: 16, data: summary.schedule['MC_PLAN'] },
      { row: 17, data: summary.schedule['MC_ACTUAL'] },
      { row: 18, data: summary.mc['PUNCH_A_TOTAL'] },
      { row: 19, data: summary.mc['PUNCH_A_COMPLETE'] },
      { row: 20, data: summary.mc['PUNCH_B_TOTAL'] },
      { row: 21, data: summary.mc['PUNCH_B_COMPLETE'] },
    ]

    excelData.forEach(d => {
      const row = ws.getRow(d.row)
      const cell = row.getCell(thisweekColumn)
      cell.value = Number(d.data)
      row.commit()
    })
    wh.commit()

    const historical = path.join(__dirname, 'output')
    await wb.xlsx.writeFile(path.join(historical, 'MD2 SC Historical.xlsx'))

    fs.writeFileSync(path.join(output, 'schedule.json'), files.schedule)
    fs.writeFileSync(path.join(output, 'summary_mc.json'), files.summary.mc)
    fs.writeFileSync(path.join(output, 'summary_mc_shi.json'), files.summary.mc_shi)
    fs.writeFileSync(path.join(output, 'summary_daily.json'), files.summary.daily)
    fs.writeFileSync(path.join(output, 'rows_mc.json'), files.rows.mc)
    fs.writeFileSync(path.join(output, 'rows_mc_shi.json'), files.rows.mc_shi)
    fs.writeFileSync(path.join(output, 'rows_daily.json'), files.rows.daily)

    const prev = path.join(__dirname, 'data/MD2 SC Historical.xlsx')
    fs.unlinkSync(prev)
    fs
      .createReadStream(path.join(historical, 'MD2 SC Historical.xlsx'))
      .pipe(fs.createWriteStream(path.join(__dirname, 'data/MD2 SC Historical.xlsx')))

  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

function getSummaryColumns (arr) {
  const columns = arr
    .filter(d => d['type'] && d['seq'] > 0 && ![ 'key', 'date' ].includes(d['type']))
    .map(d => {
      return { name: d['name'], classes: d['classes'], type: d['type'] }
    })
  return columns  
}

function getSummary(arr, summaryColumns, type) {
  if(!Array.isArray(arr)) return 
  if(type === 'daily') {
    const result = {}
    summaryColumns.forEach(v => {
      const key = v['name']
      result[key] = arr.map(d => d[key]).reduce((a, b) => (a || 0) + (b || 0), 0)
    })
    const overall = (result['ACT_B_OV_COMPLETE'] || 0) + (result['ACT_C_OT_COMPLETE'] || 0) + (result['ACT_C_RT_COMPLETE'] || 0)
    const total = (result['ACT_B_OV_TOTAL'] || 0) + (result['ACT_C_OT_TOTAL'] || 0) + (result['ACT_C_RT_TOTAL'] || 0)
    result['PROGRESS'] = format(overall / total * 100)
    
    if(summaryColumns.find(d => d['name'] === 'COMM_DATE')) {
      const dates = Array.from(new Set(arr.filter(d => d['COMM_DATE']).map(d => new Date(d['COMM_DATE']))))
      result['COMM_DATE'] = dates.length > 0 ? moment(Math.max.apply(null, dates)).format('DD-MMM-YY') : null
    }
    if(summaryColumns.find(d => d['name'] === 'PRIORITY')) result['PRIORITY'] = null
    return result  
  }
  if(type === 'mc') {
    const result = {}
    summaryColumns.forEach(v => {
      const key = v['name']
      result[key] = arr.map(d => d[key]).reduce((a, b) => (a || 0) + (b || 0), 0)
    })
    result['OV_PROGRESS'] = format(result['OV_COMPLETE'] / result['OV_TOTAL'] * 100)
    
    if(summaryColumns.find(d => [ 'WD_PLAN', 'MC_PLAN' ].includes(d['name']))) {
      const wd = Array.from(new Set(arr.filter(d => d['WD_PLAN']).map(d => new Date(d['WD_PLAN']))))
      result['WD_PLAN'] = wd.length > 0 ? moment(Math.max.apply(null, wd)).format('DD-MMM-YY') : null
      const mc = Array.from(new Set(arr.filter(d => d['MC_PLAN']).map(d => new Date(d['MC_PLAN']))))
      result['MC_PLAN'] = mc.length > 0 ? moment(Math.max.apply(null, mc)).format('DD-MMM-YY') : null
    }
    if(summaryColumns.find(d => d['name'] === 'PRIORITY')) result['PRIORITY'] = null
    return result      
  }
}

function dateParse(d, format) {
  return moment(d, format, true).isValid() ? moment(d, format, true).format('YYYY-MM-DD') : d
}

function format( num ){
  if (!num) return 0
  if (num > 1) return Number(Number(num).toPrecision(3))
  else {
    const nums = num
      .toString()
      .split('.')
      .pop()
      .split('')
      .map(d => Number(d))
    const find = nums.findIndex(d => Number(d) === 0)
    const precision = find === 0 ? 1 : 2
    return Number(Number(num).toPrecision(precision))
  }
}

function getCutoff(date) {
  const cutoff = moment(date, 'YYYYMMDD', true).format('YYYY-MM-DD')
  let stDate = moment(cutoff)
  const cutDate = moment(cutoff).isoWeekday('friday')
  const isNext = cutDate.diff(stDate, 'days')
  if (isNext < 0) stDate = stDate.add(1, 'weeks').isoWeekday('friday')
  else stDate = stDate.isoWeekday('friday')
  return stDate.format('YYYY-MM-DD')
}


const procedure = async (cutoff) => {
  try {
    if(!cutoff) throw `백업데이터 생성을 취소합니다.`
    await backup(cutoff)
    console.log(`${cutoff} 백업데이터가 생성되었습니다.`)
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

procedure(cutoff)