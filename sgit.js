const git = require ('simple-git')

const USER = 'magicbox12'
const PASS = 'Guseo!1065'
const REPO = 'github.com/magicbox12/magicbox12.git'

const remote = `https://${USER}:${PASS}@${REPO}`

const path = __dirname


git(path).silent(true).clone(remote)