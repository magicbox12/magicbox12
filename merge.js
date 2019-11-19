const path = require('path')
const filePath = path.resolve(__dirname)
const fs = require('fs')
const _ = require('lodash')
const merge = require('easy-pdf-merge')

const HULL_OV = []
const TOPSIDE_OV = []
const DECKBOX_OV = []

start()

async function start() {
    try{
        if(fs.existsSync(filePath + '/PDF_OV/HULL_OV.pdf')) fs.unlinkSync(filePath + '/PDF_OV/HULL_OV.pdf')
        if(fs.existsSync(filePath + '/PDF_OV/TOPSIDE_OV.pdf')) fs.unlinkSync(filePath + '/PDF_OV/TOPSIDE_OV.pdf')
        if(fs.existsSync(filePath + '/PDF_OV/DECKBOX_OV.pdf')) fs.unlinkSync(filePath + '/PDF_OV/DECKBOX_OV.pdf')
        await hull_bd()
        await hull_ass()
        await hull_mergePDF()
        await topside_bd()
        await topside_ass()
        await topside_mergePDF()
        await deckbox_bd()
        await deckbox_ass()
        await deckbox_mergePDF()

    } catch(err) {
        console.error(err)
        process.exit(1)
    }
}

function hull_mergePDF() {
    return new Promise((resolve,reject) => {
        merge(HULL_OV, filePath + '/PDF_OV/HULL_OV.pdf', (err) => {
            if(err) {
              reject(err)
            }
            console.log('Succesfully HULL_OV merge!')
        resolve()
        })
    })
}

function topside_mergePDF() {
    return new Promise((resolve,reject) => {
        merge(TOPSIDE_OV, filePath + '/PDF_OV/TOPSIDE_OV.pdf', (err) => {
            if(err) {
              reject(err)
            }
            console.log('Succesfully TOPSIDE_OV merge!')
        resolve()
        })
    })
}

function deckbox_mergePDF() {
    return new Promise((resolve,reject) => {
        merge(DECKBOX_OV, filePath + '/PDF_OV/DECKBOX_OV.pdf', (err) => {
            if(err) {
              reject(err)
            }
            console.log('Succesfully DECKBOX_OV merge!')
        resolve()
        })
    })
}


function hull_bd() {
    return new Promise((resolve) => {
        const unit = path.resolve(filePath + '/Block/HULL')
        const dir = fs.readdirSync(unit)
        const list = []
        _.forEach(dir, d => {
            const stat = fs.statSync(unit + `/${d}`)
            list.push({
                filename: d,
                path: unit + `/${d}`,
                date: stat.mtime
            })
        })

        list.sort(function(a,b) {
            if( new Date(b.date) > new Date(a.date)) return - 1
            if( new Date(a.date) < new Date(b.date)) return 1
            return 0
        })

        list.sort(function(a, b) {
            return new Date(a.date) - new Date(b.date)
        })

        list.forEach((d) => {
            if(d['filename'] != 'OVERALL.pdf'){
              const fp = path.join(unit,d['filename'])
              HULL_OV.push(fp)
            }
        })

        resolve()
    })
}

function hull_ass() {
    return new Promise((resolve) => {
        const unit = path.resolve(filePath + '/Assembly Sequence/HULL')
        const dir = fs.readdirSync(unit)
        const list = []
        _.forEach(dir, d => {
            const stat = fs.statSync(unit + `/${d}`)
            list.push({
                filename: d,
                path: unit + `/${d}`,
                date: stat.mtime
            })
        })

        list.sort(function(a,b) {
            if( new Date(b.date) > new Date(a.date)) return - 1
            if( new Date(a.date) < new Date(b.date)) return 1
            return 0
        })

        list.sort(function(a, b) {
            return new Date(a.date) - new Date(b.date)
        })

        list.forEach((d) => {
            const fp = path.join(unit,d['filename'])
            HULL_OV.push(fp)
        })

        resolve()
    })
}

function topside_bd() {
    return new Promise((resolve) => {
        const unit = path.resolve(filePath + '/Block/TOPSIDE')
        const dir = fs.readdirSync(unit)
        const list = []
        _.forEach(dir, d => {
            const stat = fs.statSync(unit + `/${d}`)
            list.push({
                filename: d,
                path: unit + `/${d}`,
                date: stat.mtime
            })
        })

        list.sort(function(a,b) {
            if( new Date(b.date) > new Date(a.date)) return - 1
            if( new Date(a.date) < new Date(b.date)) return 1
            return 0
        })

        list.sort(function(a, b) {
            return new Date(a.date) - new Date(b.date)
        })

        list.forEach((d) => {
            const fp = path.join(unit,d['filename'])
            TOPSIDE_OV.push(fp)
        })

        resolve()
    })
}

function topside_ass() {
    return new Promise((resolve) => {
        const unit = path.resolve(filePath + '/Assembly Sequence/TOPSIDE')
        const dir = fs.readdirSync(unit)
        const list = []
        _.forEach(dir, d => {
            const stat = fs.statSync(unit + `/${d}`)
            list.push({
                filename: d,
                path: unit + `/${d}`,
                date: stat.mtime
            })
        })

        list.sort(function(a,b) {
            if( new Date(b.date) > new Date(a.date)) return - 1
            if( new Date(a.date) < new Date(b.date)) return 1
            return 0
        })

        list.sort(function(a, b) {
            return new Date(a.date) - new Date(b.date)
        })

        list.forEach((d) => {
            const fp = path.join(unit,d['filename'])
            TOPSIDE_OV.push(fp)
        })

        resolve()
    })
}

function deckbox_bd() {
    return new Promise((resolve) => {
        const unit = path.resolve(filePath + '/Block/DECKBOX')
        const dir = fs.readdirSync(unit)
        const list = []
        _.forEach(dir, d => {
            const stat = fs.statSync(unit + `/${d}`)
            list.push({
                filename: d,
                path: unit + `/${d}`,
                date: stat.mtime
            })
        })

        list.sort(function(a,b) {
            if( new Date(b.date) > new Date(a.date)) return - 1
            if( new Date(a.date) < new Date(b.date)) return 1
            return 0
        })

        list.sort(function(a, b) {
            return new Date(a.date) - new Date(b.date)
        })

        list.forEach((d) => {
            const fp = path.join(unit,d['filename'])
            DECKBOX_OV.push(fp)
        })

        resolve()
    })
}

function deckbox_ass() {
    return new Promise((resolve) => {
        const unit = path.resolve(filePath + '/Assembly Sequence/DECKBOX')
        const dir = fs.readdirSync(unit)
        const list = []
        _.forEach(dir, d => {
            const stat = fs.statSync(unit + `/${d}`)
            list.push({
                filename: d,
                path: unit + `/${d}`,
                date: stat.mtime
            })
        })

        list.sort(function(a,b) {
            if( new Date(b.date) > new Date(a.date)) return - 1
            if( new Date(a.date) < new Date(b.date)) return 1
            return 0
        })

        list.sort(function(a, b) {
            return new Date(a.date) - new Date(b.date)
        })

        list.forEach((d) => {
            const fp = path.join(unit,d['filename'])
            DECKBOX_OV.push(fp)
        })

        resolve()
    })
}