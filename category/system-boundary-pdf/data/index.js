const path = require('path')
const _ = require('lodash')
const moment = require('moment')
const fs = require('fs')
const ref = path.resolve('./category/system-boundary-pdf/data/__ref')

const database = require('./db')

generate()

async function generate() {
  try {
    const output = path.resolve('./category/system-boundary-pdf/src/assets/data')
    const outputDir = fs.readdirSync(output)
    outputDir.forEach(d => {
      const filePath = path.join(output, d)
      fs.unlinkSync(filePath)
    })

    const pool = await database.getConnection()
    const query = 'SELECT [SYS] FROM [SYSTEM]'
    const result = await pool.request().query(query)
    if(pool) pool.close()
    console.clear()
    const systems = result.recordset.map(d => d['SYS'])
    const systemList = JSON.stringify(systems, null, '\t')
    const systemListPath = path.join(__dirname, 'systems.json')
    if(fs.existsSync(systemListPath)) fs.unlinkSync(path.join(__dirname, 'systems.json'))
    fs.writeFileSync(path.join(__dirname, 'systems.json'), systemList)

    const total = systems.length
    await asyncForEach(systems, async (d,k) => {
      try {
        await getData(d, k + 1, total)
      } catch(err) {
        throw err
      }
    })
  } catch(err) {
    console.error(err)
    process.exit(1)
  }
}

async function getData (system, seq, total) {
  try {
    const key = system
    const pool = await database.getConnection()
    const queries = database.queries()
    const query = {
      summary   : queries.summary,
      subsystem : queries.subsystem,
      discipline: queries.discipline,
      punch     : queries.punch,
      testpack  : queries.testpack,
      timeline  : queries.timeline,
      info      : queries.info
    }
    const result = {
      summary   : await pool.request().input('system', key).query(query.summary),
      subsystem : await pool.request().input('system', key).query(query.subsystem),
      discipline: await pool.request().input('system', key).query(query.discipline),
      punch     : await pool.request().input('system', key).query(query.punch),
      testpack  : await pool.request().input('system', key).query(query.testpack),
      timeline  : await pool.request().input('system', key).query(query.timeline),
      info      : await pool.request().input('system', key).query(query.info)
    }

    if(pool) pool.close()

    const dataset = {
      summary   : result.summary.recordset[0],
      subsystem : result.subsystem.recordset,
      discipline: result.discipline.recordset,
      punch     : result.punch.recordset,
      testpack  : result.testpack.recordset,
      timeline  : result.timeline.recordset,
      info      : result.info.recordset[0],
    }

    const description = {
      'ITR-A'         : 'ITR-A',
      'ITR-B'         : 'ITR-B',
      'ITR-C'         : 'ITR-C',
      'ITR-A-PRESSURE': 'Pressure Test',
      'ITR-B-LOOPS'   : 'Loops'
    }

    const disciplineSort = require(path.join(ref, 'discipline.json'))
    const disciplineDescription = require(path.join(ref, 'disciplineDescription.json'))

    const data = {
      summary: dataset.summary,
      summaryRadar: _.chain(dataset.summary)
      .pick([ 'ITR-A-PRESSURE', 'ITR-A', 'ITR-B-LOOPS', 'ITR-B', 'ITR-C' ])
      .map((d, k) => {
        return {
          CATEGORY: description[k],
          VALUE: format(d)
        }
      })
        .value(),
      subsystem: dataset.subsystem.map(d => {
        return {
          SUBSYSTEM: d['SUBSYSTEM'],
          PROGRESS : d['ITR-A']
        }
      }),
      discipline: {
        a: dataset.discipline
          .filter(d => d['A_TOTAL'] )
          .sort((a, b) => disciplineSort[a['DISCIPLINE']] - disciplineSort[b['DISCIPLINE']])
          .map(d => {
            return {
              DISCIPLINE: disciplineDescription[d['DISCIPLINE']],
              TOTAL     : d['A_TOTAL'],
              COMPLETE  : d['A_COMPLETE'],
              REMAIN    : d['A_REMAIN'],
              PROGRESS  : format(d['A_PROGRESS'])
            }
          })
        ,
        b: dataset.discipline
          .filter(d => d['B_TOTAL'] )
          .sort((a, b) => disciplineSort[a['DISCIPLINE']] - disciplineSort[b['DISCIPLINE']])
          .map(d => {
            return {
              DISCIPLINE: disciplineDescription[d['DISCIPLINE']],
              TOTAL     : d['B_TOTAL'],
              COMPLETE  : d['B_COMPLETE'],
              REMAIN    : d['B_REMAIN'],
              PROGRESS  : format(d['B_PROGRESS'])
            }
          })
      },
      punch: {
        ov: dataset.punch.find(d => d['DISCIPLINE'] === 'OV'),
        a : dataset.punch
          .filter(d => d['DISCIPLINE'] !== 'OV' && d['A_TOTAL'] > 0)
          .sort((a, b) => disciplineSort[a['DISCIPLINE']] - disciplineSort[b['DISCIPLINE']])
          .map(d => {
            return {
              DISCIPLINE: disciplineDescription[d['DISCIPLINE']],
              TOTAL     : d['A_TOTAL'],
              COMPLETE  : d['A_COMPLETE'],
              REMAIN    : d['A_REMAIN'],
              PROGRESS  : format(d['A_PROGRESS'])
            }
          }),
        b: dataset.punch
          .filter(d => d['DISCIPLINE'] !== 'OV' && d['B_TOTAL'] > 0)
          .sort((a, b) => disciplineSort[a['DISCIPLINE']] - disciplineSort[b['DISCIPLINE']])
          .map(d => {
            return {
              DISCIPLINE: disciplineDescription[d['DISCIPLINE']],
              TOTAL     : d['B_TOTAL'],
              COMPLETE  : d['B_COMPLETE'],
              REMAIN    : d['B_REMAIN'],
              PROGRESS  : format(d['B_PROGRESS'])
            }
          })
      },
      testpack: dataset.testpack.map(d => {
        const values = JSON.parse(JSON.stringify(d))
        values['PROGRESS'] = format(values['PROGRESS'])
        return values
      }),
      timeline: {
        'A-ITR'   : setData(dataset.timeline.find(d => d['CATEGORY'] === 'A-ITR')),
        'MC'   : setData(dataset.timeline.find(d => d['CATEGORY'] === 'MC')),
        'B-ITR': setData(dataset.timeline.find(d => d['CATEGORY'] === 'B-ITR')),
        'RFDC' : setData(dataset.timeline.find(d => d['CATEGORY'] === 'RFDC')),
        'ORC'  : setData(dataset.timeline.find(d => d['CATEGORY'] === 'ORC'))
      },
      info: dataset.info
    }

    const locationPath = path.resolve('./category/system-boundary-pdf/src/assets/images/location')
    const locationDir = fs.readdirSync(locationPath)
    const locationFind = locationDir.find(d => d.indexOf(system) !== -1)
    
    const location = locationFind ? String(locationFind).split('.').shift().split('_').pop() : null
    const locationDescription = {
      NE: 'NORTHEAST',
      NW: 'NORTHWEST',
      SE: 'SOUTHEAST',
      SW: 'SOUTHWEST'
    }

    const output = {
      summary   : data.summary,
      summaryRadar   : [data.summaryRadar],
      subsystem : data.subsystem,
      discipline: data.discipline,
      punch     : data.punch,
      testpack  : data.testpack,
      timeline  : data.timeline,
      info      : data.info,
      locationFileName: location ? location : '',
      locationDescription : location ? locationDescription[location] : ''
    }

    const outputPath = path.resolve('./category/system-boundary-pdf/src/assets/data')
    fs.writeFileSync(path.join(outputPath, system + '.json'), JSON.stringify(output, null, '\t'))
    console.log(seq + '/' + total, system, 'complete')
  } catch(err) {
    console.error(err)
  }
}
function setData(object) {
  return {
    TOTAL       : object['TOTAL'],
    COMPLETE    : object['COMPLETE'],
    REMAIN      : object['REMAIN'],
    PLAN        : object['PLAN'] ? moment(object['PLAN']).format('DD-MMM-YY') : null,
    ACTUAL      : object['ACTUAL'] ? moment(object['ACTUAL']).format('DD-MMM-YY') : null,
    'ITR-START' : object['ITR-START'] ? moment(object['ITR-START']).format('DD-MMM-YY') : null,
    'ITR-FINISH': object['ITR-FINISH'] ? moment(object['ITR-FINISH']).format('DD-MMM-YY') : null,
    PROGRESS    : format(object['PROGRESS'])
  }
}

function format( num ){
  if (!num) return 0
  if (num > 1) return Number(Number(num).toPrecision(3)).toLocaleString('en')
  else {
    const nums = num
      .toString()
      .split('.')
      .pop()
      .split('')
      .map(d => Number(d))
    const find = nums.findIndex(d => Number(d) === 0)
    const precision = find === 0 ? 1 : 2
    return Number(Number(num).toPrecision(precision)).toLocaleString('en')
  }
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}