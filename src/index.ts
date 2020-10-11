require('pretty-error').start()

import * as core from '@actions/core'
import githubLabelSync, { LabelInfo } from 'github-label-sync'
import fs from 'fs'
import path from 'path'
import yaml from 'yamljs'
import axios from 'axios'

const { endGroup, getInput, startGroup } = core
const log = {
  info: (str: string) => core.info('🛈 ' + str),
  success: (str: string) => core.info('✓ ' + str),
  warning: (str: string, showInReport = true) => core[(showInReport ? 'warning' : 'info')]('⚠ ' + str),
  error: (str: string, showInReport = true) => core[(showInReport ? 'error' : 'info')]('✗ ' + str),
  fatal: (str: string) => core.setFailed('✗ ' + str)
}
let usingLocalFile: boolean

(async () => {
  try {
    checkInputs()

    // @ts-expect-error
    const labels = usingLocalFile
      ? readConfigFile(getInput('config-file'))
      : await fetchRepoLabels(getInput('source-repo'), getInput('source-repo-token'))

    const diff = await githubLabelSync({
      accessToken: getInput('token'),
      repo: process.env.GITHUB_REPOSITORY as string,
      labels,

      allowAddedLabels: getInput('delete-other-labels') != 'true',
      dryRun: getInput('dry-run') == 'true'
    })

    startGroup('Label diff')
    core.info(JSON.stringify(diff, null, 2))
    endGroup()
  } catch (e) { log.fatal(e) }
})()

function isProperConfig(value: any): value is LabelInfo[] {
  return value instanceof Array
    && value.every(element => (
      typeof element == 'object'
      && element.name && typeof element.name == 'string'
      && element.description && typeof element.description == 'string'
      && (
        !element.aliases
        || (
          element.aliases instanceof Array
          && element.aliases.every(alias => alias && typeof alias == 'string')
        )
      )
      && (
        !element.description
        || typeof element.description == 'string'
      )
    ))
}

function readConfigFile(filePath: string) {
  let file: string

  try { // Read the file from the given path
    file = fs.readFileSync(path.resolve(filePath), { encoding: 'utf-8' })
    if (!file || typeof file != 'string') throw null
  } catch {
    throw 'Can\'t access config file.'
  }

  let parsed: LabelInfo[]
  const fileExtension = path.extname(filePath).toLowerCase()

  if (['.yaml', '.yml'].includes(fileExtension)) {
    // Parse YAML file
    parsed = yaml.parse(file)
    if (!isProperConfig(parsed))
      throw `Parsed YAML file is invalid. Parsed: ${JSON.stringify(parsed, null, 2)}`
  } else if (fileExtension == '.json') {
    // Try to parse JSON file
    try {
      parsed = JSON.parse(file)
    } catch {
      throw 'Couldn\'t parse JSON config file, check for syntax errors.'
    }
    if (!isProperConfig(parsed))
      throw `Parsed JSON file is invalid. Parsed: ${JSON.stringify(parsed, null, 2)}`
  } else {
    throw `Invalid file extension: ${fileExtension}`
  }

  return parsed
}

async function fetchRepoLabels(repo: string, token?: string): Promise<LabelInfo[]> {
  startGroup('Getting repo labels...')

  const url = `https://api.github.com/repos/${repo}/labels`,
    headers = token ? { Authorization: `token ${token}` } : undefined
  log.info(`Using following URL: ${url}`)

  const { data } = await axios.get(url, { headers })
  if (!data || !(data instanceof Array))
    throw 'Can\'t get label data from GitHub API'

  log.success(`${data.length} labels fetched.`)
  endGroup()

  return data.map(element => ({
    name: element.name as string,
    color: element.color as string,
    description: element.description as string || undefined,
    // Can't fetch aliases from a source repo
  }))
}

function checkInputs() {
  if (!getInput('token'))
    throw 'The token parameter is required.'

  const configFile = getInput('config-file'),
    sourceRepo = getInput('source-repo')

  if (!!configFile == !!sourceRepo)
    throw 'You can\'t use a config file and a source repo at the same time. Choose one!'

  // config-file: doesn't need evaluation, will be evaluated when parsing
  usingLocalFile = !!configFile

  if (sourceRepo && sourceRepo.split('/').length != 2)
    throw 'Source repo should be in the owner/repo format, like EndBug/label-sync!'
  if (sourceRepo && !getInput('source-repo-token'))
    log.warning('You\'re using a source repo without a token: if your repository is private the action won\'t be able to read the labels.', false)

  if (!['true', 'false'].includes(getInput('delete-other-labels')))
    throw 'The only values you can use for the `delete-other-labels` option are `true` and `false`'
  if (!['true', 'false'].includes(getInput('dry-run')))
    throw 'The only values you can use for the `dry-run` option are `true` and `false`'
}
