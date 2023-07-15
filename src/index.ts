// eslint-disable-next-line @typescript-eslint/no-var-requires
require('pretty-error').start()

import * as core from '@actions/core'
import githubLabelSync, { LabelInfo, Options } from 'github-label-sync'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
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

let configSource!: 'list' | 'repo'
;(async () => {
  try {
    checkInputs()

    let labels: LabelInfo[]
    switch (configSource) {
      case 'list':
        labels = []
        for (const cf of getInput('config-file').split('\n')) {
          console.log(cf)
          if (isURL(cf)) labels.push(...(await readRemoteConfigFile(cf)))
          else labels.push(...readConfigFile(cf))
        }
        break
      case 'repo':
        startGroup('Fetching repo labels...')
        labels = await fetchAllRepoLabels(
          getInput('source-repo'),
          getInput('request-token')
        )
        endGroup()
        break
    }

    // Support prefixing colors with '#'.
    labels = labels.map((label) => ({
      ...label,
      color: label.color.replace(/^#/, '')
    }))

    startGroup('Syncing labels...')
    const options: Options = {
      accessToken: getInput('token'),
      endpoint: process.env.GITHUB_API_URL?.replace(/^https?:\/\//, ''),
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
    const msg: string[] = []
    for (const label of diff) {
      if (msg) msg.push('')
      msg.push(`${label.name} [${label.type}]`)

      const act = label.actual,
        exp = label.expected
      if (act?.name.normalize() !== exp?.name.normalize())
        msg.push(`${act?.name || '☀️ '} → ${exp?.name || '⚰️ '}`)
      if (act?.color.normalize() !== exp?.color.normalize())
        msg.push(
          `${act?.color ? '#' + act?.color : '☀️ '} → ${
            exp?.color ? '#' + exp?.color : '⚰️ '
          }`
        )
      if (act?.description?.normalize() !== exp?.description?.normalize())
        msg.push(`${act?.description || '☀️ '} → ${exp?.description || '⚰️ '}`)
    }
    core.info(msg.join('\n'))
    endGroup()
  } catch (e) {
    log.fatal(JSON.stringify(e))
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

    const resolvedPath = path.resolve(filePath)
    core.debug(`Resolved path: ${resolvedPath}`)

    file = fs.readFileSync(resolvedPath, { encoding: 'utf-8' })
    core.debug(`fs ok: type ${typeof file}`)
    core.debug(file)

    if (!file || typeof file != 'string') throw null
  } catch (e) {
    core.debug(`Actual error: ${e}`)
    throw "Can't access config file."
  }

  const parsed = parseConfigFile(path.extname(filePath).toLowerCase(), file)

  log.success('File parsed successfully.')
  log.info('Parsed config:\n' + JSON.stringify(parsed, null, 2))
  endGroup()
  return parsed
}

function parseConfigFile(
  fileExtension: string,
  unparsedConfig: string
): LabelInfo[] {
  let parsed: LabelInfo[]

  if (['.yaml', '.yml'].includes(fileExtension)) {
    // Parse YAML file
    log.info('Parsing YAML file...')
    parsed = yaml.load(unparsedConfig) as LabelInfo[]
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

async function readRemoteConfigFile(fileURL: string): Promise<LabelInfo[]> {
  startGroup('Reading remote config file...')
  const token = getInput('request-token')

  const headers = token
    ? {
        Authorization: `token ${token}`
      }
    : undefined
  log.info(`Using following URL: ${fileURL}`)

  const { data } = await axios.get(fileURL, { headers })
  if (!data || typeof data !== 'string')
    throw "Can't get remote config file from GitHub API"

  log.success(`Remote file config fetched correctly.`)

  const parsed = parseConfigFile(path.extname(fileURL).toLowerCase(), data)

  log.success('Remote file parsed successfully.')

  try {
    throwConfigError(parsed)
  } catch (e) {
    log.error(JSON.stringify(parsed, null, 2), false)
    throw 'Parsed JSON file is invalid:\n' + e
  }

  log.info('Parsed config:\n' + JSON.stringify(parsed, null, 2))
  endGroup()
  return parsed
}

async function fetchAllRepoLabels(repo: string, token?: string) {
  const labels: LabelInfo[] = []

  let page = 1
  log.info('Fetching page 1...')
  let curr = await fetchRepoLabels(repo, token, page)
  log.info(`${curr.length} labels found.`)

  while (curr.length) {
    labels.push(...curr)
    page++

    log.info(`Fetching page ${page}...`)
    curr = await fetchRepoLabels(repo, token, page)
    log.info(`${curr.length} labels found.`)
  }

  return labels
}

async function fetchRepoLabels(
  repo: string,
  token?: string,
  page = 1
): Promise<LabelInfo[]> {
  startGroup('Getting repo labels...')

  const url = `${process.env.GITHUB_API_URL}/repos/${repo}/labels`,
    headers = token ? { Authorization: `token ${token}` } : undefined,
    params = { page }
  log.info(`Using following URL: ${url}`)

  const { data } = await axios.get(url, { headers, params })
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
  if (!getInput('token')) throw 'The token parameter is required.'

  const configFile = getInput('config-file'),
    sourceRepo = getInput('source-repo')

  if (!!configFile && !!sourceRepo)
    throw "You can't use a config file and a source repo at the same time. Choose one!"

  const sources: ('remote' | 'local')[] = []
  if (sourceRepo) configSource = 'repo'
  else if (configFile) {
    configSource = 'list'
    for (const cf of configFile.split('\n')) {
      if (isURL(cf)) sources.push('remote')
      else sources.push('local')
    }
  } else throw 'You have to either use a config file or a source repo.'

  log.info(
    `Current config mode: ${sources ? sources.join(', ') : configSource}`
  )

  if (sourceRepo && sourceRepo.split('/').length != 2)
    throw 'Source repo should be in the owner/repo format, like EndBug/label-sync!'
  if (sourceRepo && !getInput('request-token'))
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

function isURL(str: string) {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i'
  ) // fragment locator
  return !!pattern.test(str)
}
