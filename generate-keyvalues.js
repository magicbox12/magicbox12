const fs = require('fs')
const path = require('path')
const util = require('util')
const _ = require('lodash')
const sql = require('mssql')

const connConfig = {
  jgs: {
    user: 'sa',
    password: 'dnjfgk8152!@',
    server: '192.168.0.50',
    database: '08_SystemCompletion',
    connectionTimeout: 300000,
    requestTimeout: 300000,      
    options: {
        port: 1433,
        encrypt: true,
        trustedConnection: true,
        abortTransactionOnError: true
    },    
    pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000
    }    
  },
  md2: {
    user: 'sa',
    password: 'jingraphics2019)(*&',
    server: '211.172.246.55',
    database: '08_SystemCompletion',
    connectionTimeout: 300000,
    requestTimeout: 300000,      
    options: {
        port: 1433,
        encrypt: true,
        trustedConnection: true,
        abortTransactionOnError: true
    },    
    pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000
    }    
  }
}

const dirPath = path.join(__dirname, 'files')
const dir = fs.readdirSync(dirPath).filter(d => String(d).indexOf('.xlsx') === -1)

let subsystems = []
let areaList = []

let mc = {
  site: []
}

dir.forEach(d => {
  const file = d  
  const filePath = path.join(dirPath, file)
  const result = fs.readFileSync(filePath).toString()
  const json = JSON.parse(result)
  const area = json.map(d => d['AREA'])
  const output = Array.from(new Set(area))
  
  areaList = areaList.concat(areaList, output)

  const subsystem = _.chain(json).map(d => _.pick(d, ['AREA', 'SUB-SYSTEM'])).value()
  subsystems = subsystems.concat(subsystems, subsystem)

  if(String(d).indexOf('ACT') !== -1 ) mc.site = _.chain(json).map(d => _.pick(d, ['SITE', 'SUB-SYSTEM'])).value()
})

const output = {
  area: Array.from(new Set(areaList)),
  subsystem: unique(subsystems, ['AREA', 'SUB-SYSTEM']),
  mc: {
    site: unique(mc.site, ['SITE', 'SUB-SYSTEM'])
  }
}

util.log('key values generate...')

uploadTables(Env)

async function uploadTables (Env) {
  try {
    const connection = Env === 'jgs' ? connConfig.jgs : connConfig.md2
    console.log(connection)
    await upload(output.subsystem, '_AREA', 'dbo', connection)
    await upload(output.mc.site, '_MC_SITE', 'dbo', connection)
  } catch(err) {
    console.error(err)
  }
}

async function upload (json, tablename, tableschema, connection) {
  try {
    const data = await parseData(json)
    await uploadExcel(tablename, tableschema, [], data.header, data.rows, connection)
  } catch(err) {
    console.error(err)
  } finally {
    sql.close()
  }
}

function unique(arr, keyProps) {
 const kvArray = arr.map(entry => {
  const key = keyProps.map(k => entry[k]).join('|');
  return [key, entry];
 });
 const map = new Map(kvArray);
 return Array.from(map.values());
}


function parseData (array) {
  return new Promise(function(resolve, reject) {
    const json = array
    const json_getAllKeys = data => 
      data.reduce((keys, obj) => 
        keys.concat(Object.keys(obj).filter(key => 
          keys.indexOf(key) === -1))
      , [])
    const header = json_getAllKeys(json)
    resolve({
      rows: json,
      header
    })    
  })
}

function uploadExcel(tablename, tableschema, datetypes, headerColumns, rows, connection) {
  return new Promise(function(resolve, reject){
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
                  console.log('Upload JSON to MSSQL by ' + tablename + ' --- ' + rows.length)
                  sql.close()
                  resolve()
              })
          })
      }).catch(err => reject(err))
      
      sql.on('error', err => reject(err))
  })
}
