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

  info(msg: string): string {
    if (!DEFAULTS.verbose) return msg
    this.log(msg, '️  ', 'white')
    return msg
  }

  success(msg: string): string {
    this.log(msg, '✅', 'green')
    return msg
  }

  warn(msg: string, error?: Error): string {
    this.log(msg, '⚠️ ', 'yellow')
    if (error) console.error(error)
    return msg
  }

  error(msg: string, error?: Error): string {
    this.log(msg, '🚨', 'red')
    if (error) console.error(error)
    return msg
  }

  log(msg: string, emoji: string, color = 'white'): string {
    let formattedMessage = chalk.keyword(color)(`${emoji}  ${msg}`)
    if (DEFAULTS.verbose) {
      const formattedPrefix = chalk.keyword(this.color)(`[${this.actor}]`)
      formattedMessage = `${formattedPrefix} ${formattedMessage}`
    }
    if (DEFAULTS.silent) return formattedMessage
    console.error(formattedMessage)
    return formattedMessage
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
