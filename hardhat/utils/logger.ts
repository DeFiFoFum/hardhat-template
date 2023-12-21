import chalk from 'chalk'

const DEFAULTS = {
  verbose: false,
  silent: false,
}

interface LoggerOptions {
  actor?: string
  color?: string
  verbose?: boolean
  silent?: boolean
}

export class Logger {
  actor: string
  color: string
  verbose: boolean
  silent: boolean

  constructor({
    actor = '',
    color = 'white',
    verbose = DEFAULTS.verbose,
    silent = DEFAULTS.silent,
  }: LoggerOptions = {}) {
    this.actor = actor
    this.color = color
    this.verbose = verbose
    this.silent = silent
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose
  }

  setSilent(silent: boolean): void {
    this.silent = silent
  }

  info(msg: string): void {
    if (!DEFAULTS.verbose) return
    this.log(msg, '️  ', 'white')
  }

  success(msg: string): void {
    this.log(msg, '✅', 'green')
  }

  warn(msg: string, error?: Error): void {
    this.log(msg, '⚠️ ', 'yellow')
    if (error) console.error(error)
  }

  error(msg: string, error?: Error): void {
    this.log(msg, '🚨', 'red')
    if (error) console.error(error)
  }

  log(msg: string, emoji: string, color = 'white'): void {
    if (DEFAULTS.silent) return
    let formattedMessage = chalk.keyword(color)(`${emoji}  ${msg}`)
    if (DEFAULTS.verbose) {
      const formattedPrefix = chalk.keyword(this.color)(`[${this.actor}]`)
      formattedMessage = `${formattedPrefix} ${formattedMessage}`
    }
    console.error(formattedMessage)
  }

  logHeader(msg: string, emoji: string, color = 'white'): void {
    this.log(`\n`, '')
    this.log(
      `\n========================================\n${emoji} ${msg}\n========================================`,
      '',
      color
    )
  }
}

export const logger = new Logger()
