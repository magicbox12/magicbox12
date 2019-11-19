const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const moment = require('moment')
const sql = require('mssql')
const xlsx = require('xlsx-stream-reader')
const excel = require('exceljs')
const chartdata = require('./generate-chart')
const punchdata = require('./generate-punch')

const config = {
  jgs: require(path.resolve('./config/db')),
  md2: require(path.resolve('./config/db-service'))
}

const connection = async (config) => {
  try {
    const pool = await new sql.ConnectionPool(config).connect()
    return pool
  } catch(err) {
    console.error('err')
    throw err
  }
}

const parseExcel = () => {
  return new Promise((resolve, reject) => {
    try {
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
            header.forEach((d, k) => {
              const i = k + 1
              const str = v[i] || null
              const s = str
              r.push(s)
            })
            rows.push(r)
          }
        })
  
        wsr.on('end', () => { console.log('parse complete' )})
        wsr.process()
      })
      wbr.on('end', () => {
        resolve({
          header,
          rows
        })
      })
      const filename = fs.readdirSync(path.join(__dirname, 'files'))[0]
      const filepath = path.join(__dirname, 'files', filename)
      fs.createReadStream(filepath).pipe(wbr)
    } catch(err) {
      console.error(err)
      reject(err)
    }
  })
}

const uploadExcel = (tablename, tableschema, headerColumns, rows, connection) => {
  return new Promise(function(resolve, reject){
      console.time('Upload JSON to MSSQL by ' + tablename)
      const table = new sql.Table('#table');
      table.create = true;

      rows.forEach(d => {
        const row = _.chain(d).values().value()
        table.rows.add(...row)
      })

      headerColumns.forEach((d,k) => {
        if(['TOTAL', 'AVAILABLE', 'NOT AVAILABLE', 'COMPLETE'].includes(d)) {
          table.columns.add(String(d).toUpperCase(), sql.Int, { nullable: true })
        } else {
          const maxLength = _.chain(rows).map(d).map(d => d ? String(d).length : 0).maxBy().value()
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

const procedure = async (DataType) => {
  try {
      
    let config = DataType === 'md2' ? config.md2 : config.jgs

    if(!fs.existsSync(path.join(__dirname, 'backup'))) fs.mkdirSync(path.join(__dirname, 'backup'))
    const prevFileName = fs.readdirSync(path.join(__dirname, 'output'))[0]
    if(prevFileName) fs.renameSync(path.join(__dirname, 'output', prevFileName), path.join(__dirname, 'backup', prevFileName))

    const { header, rows } = await parseExcel()
    const pool = await connection(config)
    
    const query = `SELECT * FROM [ACT] WHERE [STAGE] IN ('B','C')`
    const queryResult = await pool.request().query(query)

    if(pool) await pool.close()

    const list = queryResult.recordset.map(d => {
      const row = JSON.parse(JSON.stringify(d))
      row['SYSTEM'] = row['SUB-SYSTEM'] && row['SUB-SYSTEM'] !== '' ? String(row['SUB-SYSTEM']).substring(0, 4) : null
      return row
    })

    const result = []
    rows.forEach((r, rk) => {
      try {
        const obj = {}
        header.forEach((d, k) => {
          obj[d] = r[k] ? String(r[k]) : null
        })

        const filters = {
          'STAGE': obj['STAGE'] ? obj['STAGE'].split(',') : null,
          'ITR DISCIPLINE': obj['ITR DISCIPLINE'] && !['TE','ME'].includes(obj['ITR DISCIPLINE']) ? obj['ITR DISCIPLINE'].split(',') : null,
          'ITR NUMBER': obj['ITR NUMBER'] ? obj['ITR NUMBER'].split(',') : null,
          'SUB-SYSTEM': obj['SUB-SYSTEM'] ? obj['SUB-SYSTEM'].split(',') : null,
          'SYSTEM': obj['SYSTEM'] ? obj['SYSTEM'].split(',') : null
        }
        const filter = _.chain(filters).pickBy(v => v).value()
        
        if(obj['ITR NUMBER'] === 'B-PI-01') delete filter['ITR DISCIPLINE']

        const total = list.filter(v => {
          for ( let key in filter ) {
            const text = String(v[key])
            if (!filter[key].includes(text)) return false
          }
          return true
        })

        

        const available = total.filter(d => !d['ITR COMPLETE DATE'] && d['MC(ACTUAL) BY SUB-SYSTEM'])
        const notAvailable = total.filter(d => !d['ITR COMPLETE DATE'] && !d['MC(ACTUAL) BY SUB-SYSTEM'])
        const complete = total.filter(d => d['ITR COMPLETE DATE'])

        const summary = {
          'TOTAL': total.length, 
          'AVAILABLE': available.length, 
          'NOT AVAILABLE': notAvailable.length, 
          'COMPLETE': complete.length
        }
        Object.assign(obj, summary)
        result.push(obj)
      } catch(err) {
        console.error('row error', err)
      }
    })

    const tableHeader = [...header, 'TOTAL', 'AVAILABLE', 'NOT AVAILABLE', 'COMPLETE']

    await uploadExcel('COMM_DISC_SUMMARY', 'dbo', tableHeader, result, config)

    const workbook = new excel.Workbook()
    const worksheet = workbook.addWorksheet('Summary')

    const wh = tableHeader.map(d => {
      return {
        header: d,
        key: d,
        width: 20
      }
    })
    worksheet.columns = wh

    result.forEach(d => {
      worksheet.addRow(d)
    })

    const dateNow = moment().format('YYMMDD HHmm')
    const outputname = `Comm Disicpline Summary ${dateNow}.xlsx`
    const outputFullname = path.join(__dirname, 'output', outputname)
    await workbook.xlsx.writeFile(outputFullname)

    await chartdata.generate(config)
    await punchdata.generate(config)

  } catch(err) {
    console.error(err)
    process.exit(1)
  } 
}

procedure(connConfig)
