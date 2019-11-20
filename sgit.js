const git = require ('simple-git')
const fs = require('fs')

const USER = 'magicbox12'
const PASS = 'Guseo!1065'
const REPO = 'github.com/magicbox12/magicbox12.git'

const remote = `https://${USER}:${PASS}@${REPO}`

const path = __dirname

fs.writeFileSync('test.txt','hihihi',{encoding: 'utf8'})

git(path).silent(true).pull(remote).add ( 'README.md')
.commit ( 'README.md updated')
.push ( '-u', 'origin', 'master');