require('pretty-error').start()

import * as core from '@actions/core'
import githubLabelSync, { LabelInfo, Options } from 'github-label-sync'
import fs from 'fs'
import path from 'path'
import yaml from 'yamljs'
import axios from 'axios'

const { endGroup, getInput, startGroup } = core
const log = {
  info: (str: string) => core.info('🛈 ' + str),
  success: (str: string) => core.info('✓ ' + str),
  warning: (str: string, showInReport = true) =>
    core[showInReport ? 'warning' : 'info']('⚠ ' + str),
  error: (str: string, showInReport = true) =>
    core[showInReport ? 'error' : 'info']('✗ ' + str),
  fatal: (str: string) => core.setFailed('✗ ' + str)
}
enum ConfigSource {
  local,
  remote,
  repository
}
let configSource!: ConfigSource
;(async () => {
  try {
    checkInputs()

    let labels: LabelInfo[]
    switch (configSource) {
      case ConfigSource.local:
        labels = readConfigFile(getInput('config-file'))
        break
      case ConfigSource.remote:
        labels = await readRemoteConfigFile(
          getInput('config-file'),
          getInput('source-repo')
        )
        break
      case ConfigSource.repository:
        labels = await fetchRepoLabels(
          getInput('source-repo'),
          getInput('source-repo-token')
        )
        break
    }

    startGroup('Syncing labels...')
    const options: Options = {
      accessToken: getInput('token'),
      repo: process.env.GITHUB_REPOSITORY as string,
      labels,

      allowAddedLabels: getInput('delete-other-labels') != 'true',
      dryRun: getInput('dry-run') == 'true'
    }
    core.debug(
      'Running with following config:\n' + JSON.stringify(options, null, 2)
    )
    const diff = await githubLabelSync(options)
    log.success('Sync successful')
    endGroup()

    startGroup('Label diff')
    core.info(JSON.stringify(diff, null, 2))
    endGroup()
  } catch (e) {
    log.fatal(e)
  }
})()

function throwConfigError(value: LabelInfo[]) {
  if (!(value instanceof Array)) throw 'Parsed value should be an array'

  value.forEach((element, index) => {
    if (typeof element != 'object')
      throw `Every entry should be an object (index: ${index})`

    if (typeof element.name != 'string')
      throw `.name should be a string (received: ${typeof element.name}, index: ${index})`
    if (!element.name)
      throw `.name should not be an empty string (index: ${index})`

    if (typeof element.color != 'string')
      throw `.color should be a string (received: ${typeof element.color}, index: ${index})`
    if (!element.color)
      throw `.color should not be an empty string (index: ${index})`

    if (!['string', 'undefined'].includes(typeof element.description))
      throw `.description should be either a string or undefined (received: ${typeof element.description}, index: ${index})`

    if (
      typeof element.aliases != 'undefined' &&
      !(element.aliases instanceof Array)
    )
      throw `.aliases should be either an array or undefined (received: ${typeof element.aliases}, index: ${index})`

    element.aliases?.forEach((alias, aliasIndex) => {
      if (typeof alias != 'string')
        throw `Every alias should be a string (received: ${typeof alias}, element index: ${index}, alias index: ${aliasIndex})`
      if (!alias)
        throw `Aliases shouldn't be empty strings (element index: ${index}, alias index: ${aliasIndex})`
    })
  })
}

function readConfigFile(filePath: string) {
  startGroup('Reading config file...')
  let file: string

  try {
    // Read the file from the given path
    log.info('Reading file...')
    file = fs.readFileSync(path.resolve(filePath), { encoding: 'utf-8' })
    if (!file || typeof file != 'string') throw null
  } catch {
    throw "Can't access config file."
  }

  const parsed = parsConfigFile(path.extname(filePath).toLowerCase(), file)

  log.success('File parsed successfully.')
  log.info('Parsed config:\n' + JSON.stringify(parsed, null, 2))
  endGroup()
  return parsed
}

function parsConfigFile(
  fileExtension: string,
  unparsedConfig: string
): LabelInfo[] {
  let parsed: LabelInfo[]

  if (['.yaml', '.yml'].includes(fileExtension)) {
    // Parse YAML file
    log.info('Parsing YAML file...')
    parsed = yaml.parse(unparsedConfig)
    try {
      throwConfigError(parsed)
    } catch (e) {
      log.error(JSON.stringify(parsed, null, 2), false)
      throw 'Parsed YAML file is invalid:\n' + e
    }
  } else if (fileExtension == '.json') {
    // Try to parse JSON file
    log.info('Parsing JSON file...')
    try {
      parsed = JSON.parse(unparsedConfig)
    } catch {
      throw "Couldn't parse JSON config file, check for syntax errors."
    }

    try {
      throwConfigError(parsed)
    } catch (e) {
      log.error(JSON.stringify(parsed, null, 2), false)
      throw 'Parsed JSON file is invalid:\n' + e
    }
  } else {
    throw `Invalid file extension: ${fileExtension}`
  }

  return parsed
}

async function readRemoteConfigFile(
  filePath: string,
  repo: string,
  token?: string
): Promise<LabelInfo[]> {
  startGroup('Reading remote config file ...')

  const branch = await getRemoteBranch(repo, token)
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
    headers = token
      ? {
          Authorization: `token ${token}`,
          accept: 'application/vnd.github.VERSION.raw'
        }
      : { accept: 'application/vnd.github.VERSION.raw' }
  log.info(`Using following URL: ${url}`)

  const { data } = await axios.get(url, { headers })
  if (!data || typeof data !== 'string')
    throw "Can't get remote config file from GitHub API"

  log.success(`${filePath} config fetched from ${repo}.`)

  const parsed = parsConfigFile(path.extname(filePath).toLowerCase(), data)

  log.success('Remote file parsed successfully.')
  log.info('Parsed config:\n' + JSON.stringify(parsed, null, 2))
  endGroup()
  return parsed
}

async function getRemoteBranch(repo: string, token?: string): Promise<string> {
  let sourceRepoBranch = getInput('source-repo-branch')

  if (!sourceRepoBranch) {
    log.info('Determine default branch of remote repo ...')

    const url = `https://api.github.com/repos/${repo}`,
      headers = token ? { Authorization: `token ${token}` } : undefined
    log.info(`Using following URL: ${url}`)

    const { data } = await axios.get(url, { headers })
    if (!data || !(data instanceof Object))
      throw "Can't get remote repo data from GitHub API"

    sourceRepoBranch = data.default_branch

    log.success("Remote's default branch determined")
  }

  log.info(`Using remote branch: ${sourceRepoBranch}`)
  return sourceRepoBranch
}

async function fetchRepoLabels(
  repo: string,
  token?: string
): Promise<LabelInfo[]> {
  startGroup('Getting repo labels...')

  const url = `https://api.github.com/repos/${repo}/labels`,
    headers = token ? { Authorization: `token ${token}` } : undefined
  log.info(`Using following URL: ${url}`)

  const { data } = await axios.get(url, { headers })
  if (!data || !(data instanceof Array))
    throw "Can't get label data from GitHub API"

  log.success(`${data.length} labels fetched.`)
  endGroup()

  return data.map((element) => ({
    name: element.name as string,
    color: element.color as string,
    description: (element.description as string) || undefined
    // Can't fetch aliases from a source repo
  }))
}

function checkInputs() {
  let cb = () => {}

  startGroup('Checking inputs...')
  log.info('Checking inputs...')
  if (!getInput('token')) throw 'The token parameter is required.'

  const configFile = getInput('config-file'),
    sourceRepo = getInput('source-repo')

  if (!!configFile == !!sourceRepo) configSource = ConfigSource.remote
  else if (configFile) configSource = ConfigSource.local
  else configSource = ConfigSource.repository

  if (sourceRepo && sourceRepo.split('/').length != 2)
    throw 'Source repo should be in the owner/repo format, like EndBug/label-sync!'
  if (sourceRepo && !getInput('source-repo-token'))
    cb = () =>
      log.warning(
        "You're using a source repo without a token: if your repository is private the action won't be able to read the labels.",
        false
      )

  if (!['true', 'false'].includes(getInput('delete-other-labels')))
    throw 'The only values you can use for the `delete-other-labels` option are `true` and `false`'
  if (!['true', 'false'].includes(getInput('dry-run')))
    throw 'The only values you can use for the `dry-run` option are `true` and `false`'

  log.success('Inputs are valid')
  endGroup()

  cb()
}
